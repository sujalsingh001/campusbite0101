import API from "@/lib/api";
import {
  auth,
  debugFirebaseLog,
  useFirebaseOrders as firebaseUseFirebaseOrders,
  useRailwayFallback as firebaseUseRailwayFallback,
} from "@/lib/firebase";
import {
  createOrder as createFirebaseOrder,
  getOrders as getFirebaseOrders,
  saveUserNotificationToken as saveFirebaseNotificationToken,
  subscribeToOrdersRealtime as subscribeFirebaseOrdersRealtime,
  updateOrderStatus as updateFirebaseOrderStatus,
} from "@/lib/firestoreOrders";

const RAILWAY_POLL_INTERVAL_MS = 5000;

const UI_STATUS_BY_RAILWAY_STATUS = {
  new: "pending",
  pending: "pending",
  placed: "pending",
  preparing: "preparing",
  ready: "completed",
  completed: "completed",
  cancelled: "cancelled",
};

const RAILWAY_STATUS_BY_UI_STATUS = {
  pending: "placed",
  preparing: "preparing",
  completed: "ready",
  cancelled: "cancelled",
};

export const ORDER_SOURCES = Object.freeze({
  FIREBASE: "firebase",
  RAILWAY: "railway",
});

export const USE_FIREBASE_ORDERS = firebaseUseFirebaseOrders;
export const USE_RAILWAY_FALLBACK = firebaseUseRailwayFallback;

function getActiveCanteenId(activeUser) {
  return activeUser?.canteen_id || activeUser?.canteenId || "";
}

function getBackendToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem("campusbite_token") || "";
}

function hasBackendToken() {
  return Boolean(getBackendToken());
}

function deriveStudentAuidFromEmail(email) {
  return (email || "").trim().split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
}

async function ensureStudentBackendTokenForCheckout(activeUser) {
  if (hasBackendToken()) {
    return true;
  }

  const email = activeUser?.email || auth.currentUser?.email || "";
  const auid = (
    activeUser?.auid
    || activeUser?.studentAuid
    || deriveStudentAuidFromEmail(email)
    || ""
  ).trim();

  if (!auid) {
    return false;
  }

  try {
    const response = await API.post("/auth/student/temporary-login", { auid });
    const token = response.data?.token;
    if (!token || typeof window === "undefined") {
      return Boolean(token);
    }

    localStorage.setItem("campusbite_token", token);
    debugFirebaseLog("Checkout backend session bootstrapped", { auid });
    return true;
  } catch (error) {
    debugFirebaseLog("Checkout backend session bootstrap failed", {
      auid,
      status: error?.response?.status || "",
      message: error?.message || String(error),
    });
    return false;
  }
}

function canUseRailwayFallback(options = {}) {
  if (!USE_RAILWAY_FALLBACK || !hasBackendToken()) {
    return false;
  }

  return options.role === "student" || options.role === "canteen_staff";
}

function normalizeRailwayStatus(status) {
  return UI_STATUS_BY_RAILWAY_STATUS[(status || "").toLowerCase()] || "pending";
}

function toRailwayStatus(status) {
  return RAILWAY_STATUS_BY_UI_STATUS[(status || "").toLowerCase()] || "placed";
}

function toDate(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeItem(item) {
  return {
    item_id: item?.item_id || item?.id || "",
    name: item?.name || "",
    qty: Number(item?.qty || 0),
    price: Number(item?.price || 0),
    image: item?.image || "",
  };
}

function buildDisplayFields(order = {}) {
  const items = Array.isArray(order.items) ? order.items.map(normalizeItem) : [];
  const quantity = Number(
    order.quantity
    ?? items.reduce((sum, item) => sum + Number(item.qty || 0), 0)
    ?? 0,
  );
  const totalAmount = Number(
    order.totalAmount
    ?? order.total
    ?? items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 0)), 0)
    ?? 0,
  );
  const itemName = order.itemName || items.map((item) => item.name).filter(Boolean).join(", ");

  return {
    items,
    quantity,
    totalAmount,
    itemName,
  };
}

function normalizeRailwayOrder(order = {}) {
  const display = buildDisplayFields(order);
  const orderId = order.orderId || order.order_id || "";

  return {
    id: order.id || orderId,
    orderId,
    userId: order.userId || order.student_auid || "",
    userEmail: order.userEmail || "",
    phoneNumber: order.phoneNumber || "",
    studentAuid: order.studentAuid || order.student_auid || "",
    canteenId: order.canteenId || order.canteen_id || "",
    canteenName: order.canteenName || order.canteen_name || "",
    tokenNumber: order.tokenNumber || order.token_number || (orderId ? orderId.slice(-4).toUpperCase() : ""),
    transactionId: order.transactionId || order.utr || "N/A",
    paymentMethod: order.paymentMethod || order.payment_method || "none",
    paymentStatus: order.paymentStatus || order.payment_status || "",
    priority: Boolean(order.priority),
    status: normalizeRailwayStatus(order.status),
    createdAt: toDate(order.createdAt || order.created_at),
    updatedAt: toDate(order.updatedAt || order.updated_at),
    ...display,
  };
}

function normalizeRailwayOrders(orders) {
  if (!Array.isArray(orders)) {
    return [];
  }

  return orders.map(normalizeRailwayOrder);
}

function createPollingSubscription(load, onData, onError) {
  let active = true;
  let inFlight = false;

  const poll = async () => {
    if (!active || inFlight) {
      return;
    }

    inFlight = true;
    try {
      const data = await load();
      if (active) {
        onData(data);
      }
    } catch (error) {
      if (active && typeof onError === "function") {
        onError(error);
      }
    } finally {
      inFlight = false;
    }
  };

  void poll();
  const intervalId = window.setInterval(() => {
    void poll();
  }, RAILWAY_POLL_INTERVAL_MS);

  return () => {
    active = false;
    window.clearInterval(intervalId);
  };
}

async function fetchRailwayStudentOrders() {
  debugFirebaseLog("Fetching Railway student orders");
  const response = await API.get("/orders/my");
  return normalizeRailwayOrders(response.data);
}

async function fetchRailwayStudentOrder(orderId) {
  debugFirebaseLog("Fetching Railway student order", { orderId });
  const response = await API.get(`/orders/${orderId}`);
  return normalizeRailwayOrder(response.data);
}

async function fetchRailwayCanteenOrders() {
  debugFirebaseLog("Fetching Railway canteen orders");
  const response = await API.get("/staff/orders");
  return normalizeRailwayOrders(response.data);
}

async function createRailwayOrder(order) {
  debugFirebaseLog("Creating Railway order", {
    canteenId: order?.canteenId || "",
    userId: order?.userId || "",
  });
  const response = await API.post("/orders", {
    canteen_id: order.canteenId,
    items: (order.items || []).map((item) => ({
      item_id: item.item_id,
      name: item.name,
      qty: item.qty,
      price: item.price,
    })),
    payment_method: order.paymentMethod || "none",
    utr: order.paymentMethod === "qr" ? order.transactionId : undefined,
    submitted_amount: order.totalAmount,
    payment_session_id: order.paymentMethod === "qr" ? (order.paymentSessionId || order.refId || "") : undefined,
    payment_session_started_at: order.paymentMethod === "qr" ? (order.paymentSessionStartedAt || "") : undefined,
  });

  const payload = response.data?.order || {};
  return {
    orderId: response.data?.order_id || payload.order_id || payload.orderId || "",
    order: normalizeRailwayOrder(payload),
  };
}

async function updateRailwayOrderStatus(orderId, status) {
  debugFirebaseLog("Updating Railway order status", {
    orderId,
    status,
  });
  const response = await API.patch(`/staff/orders/${orderId}/status`, {
    status: toRailwayStatus(status),
  });

  return normalizeRailwayOrder(response.data);
}

function getRailwayOrderFetcher(filters = {}, role = "") {
  if (filters.orderId && role === "student") {
    return () => fetchRailwayStudentOrder(filters.orderId);
  }

  if (role === "student") {
    return fetchRailwayStudentOrders;
  }

  if (role === "canteen_staff") {
    return fetchRailwayCanteenOrders;
  }

  return async () => [];
}

function createRailwayRealtimeSubscription(filters, onData, onError, role) {
  return createPollingSubscription(
    getRailwayOrderFetcher(filters, role),
    onData,
    onError,
  );
}

async function withRailwayFallback(primaryOperation, fallbackOperation, context, options = {}) {
  try {
    return await primaryOperation();
  } catch (error) {
    debugFirebaseLog("Firebase order operation failed", {
      context,
      message: error?.message || String(error),
      role: options.role || "",
    });

    if (!canUseRailwayFallback(options) || typeof fallbackOperation !== "function") {
      throw error;
    }

    debugFirebaseLog("Using Railway fallback", {
      context,
      role: options.role || "",
    });
    return fallbackOperation();
  }
}

function createFirebaseSubscriptionWithRailwayFallback(filters, onData, onError, options = {}) {
  let unsubscribePrimary = () => {};
  let unsubscribeFallback = () => {};
  let usingFallback = false;
  const handleSubscriptionError = (error) => {
    debugFirebaseLog("Firebase realtime subscription failed", {
      role: options.role || "",
      message: error?.message || String(error),
    });

    if (!canUseRailwayFallback(options) || usingFallback) {
      if (typeof onError === "function") {
        onError(error);
      }
      return;
    }

    usingFallback = true;
    unsubscribeFallback = createRailwayRealtimeSubscription(
      filters,
      onData,
      (fallbackError) => {
        if (typeof onError === "function") {
          onError(fallbackError || error);
        }
      },
      options.role,
    );
  };

  try {
    unsubscribePrimary = subscribeFirebaseOrdersRealtime(
      filters,
      onData,
      handleSubscriptionError,
    );
  } catch (error) {
    handleSubscriptionError(error);
  }

  return () => {
    unsubscribePrimary();
    unsubscribeFallback();
  };
}

export function getOrderDataSource({ role, firebaseUid, canteenId = "" } = {}) {
  if (role === "student" && hasBackendToken()) {
    return ORDER_SOURCES.RAILWAY;
  }

  if (USE_FIREBASE_ORDERS) {
    if (role === "canteen_staff" && (!firebaseUid || !canteenId) && USE_RAILWAY_FALLBACK) {
      return ORDER_SOURCES.RAILWAY;
    }

    if (role === "student" && !firebaseUid && hasBackendToken()) {
      return ORDER_SOURCES.RAILWAY;
    }

    return ORDER_SOURCES.FIREBASE;
  }

  if (role === "student") {
    return hasBackendToken() ? ORDER_SOURCES.RAILWAY : ORDER_SOURCES.FIREBASE;
  }

  if (role === "canteen_staff") {
    return ORDER_SOURCES.RAILWAY;
  }

  return firebaseUid ? ORDER_SOURCES.FIREBASE : ORDER_SOURCES.RAILWAY;
}

export async function getOrders(filters = {}, options = {}) {
  const source = options.source || getOrderDataSource({
    role: options.role,
    firebaseUid: options.activeUser?.uid,
    canteenId: getActiveCanteenId(options.activeUser),
  });

  if (source === ORDER_SOURCES.FIREBASE) {
    return withRailwayFallback(
      () => getFirebaseOrders(filters),
      () => getRailwayOrderFetcher(filters, options.role)(),
      "getOrders",
      options,
    );
  }

  return getRailwayOrderFetcher(filters, options.role)();
}

export async function createOrder(order, options = {}) {
  const source = options.source || getOrderDataSource({
    role: options.role || "student",
    firebaseUid: options.activeUser?.uid,
    canteenId: getActiveCanteenId(options.activeUser),
  });
  if (source === ORDER_SOURCES.FIREBASE) {
    return withRailwayFallback(
      async () => {
        const orderId = await createFirebaseOrder(order);
        return {
          orderId,
          order: await getFirebaseOrders({ orderId }),
        };
      },
      () => createRailwayOrder(order),
      "createOrder",
      options,
    );
  }

  return createRailwayOrder(order);
}

export async function updateOrderStatus(orderId, status, options = {}) {
  const source = options.source || getOrderDataSource({
    role: options.role,
    firebaseUid: options.activeUser?.uid,
    canteenId: getActiveCanteenId(options.activeUser),
  });

  if (source === ORDER_SOURCES.FIREBASE) {
    return withRailwayFallback(
      () => updateFirebaseOrderStatus(orderId, status),
      () => updateRailwayOrderStatus(orderId, status),
      "updateOrderStatus",
      options,
    );
  }

  return updateRailwayOrderStatus(orderId, status);
}

export async function prepareOrder(activeUser, orderId) {
  return updateOrderStatus(orderId, "preparing", {
    activeUser,
    role: "canteen_staff",
  });
}

export async function cancelOrder(activeUser, orderId) {
  return updateOrderStatus(orderId, "cancelled", {
    activeUser,
    role: "canteen_staff",
  });
}

export function subscribeToOrdersRealtime(filters, onData, onError, options = {}) {
  const source = options.source || getOrderDataSource({
    role: options.role,
    firebaseUid: options.activeUser?.uid,
    canteenId: getActiveCanteenId(options.activeUser),
  });

  if (source === ORDER_SOURCES.FIREBASE) {
    return createFirebaseSubscriptionWithRailwayFallback(
      filters,
      onData,
      onError,
      options,
    );
  }

  return createRailwayRealtimeSubscription(filters, onData, onError, options.role);
}

export function subscribeToStudentOrders(activeUser, onData, onError) {
  const role = activeUser?.role || "student";
  const source = getOrderDataSource({
    role,
    firebaseUid: activeUser?.uid,
    canteenId: getActiveCanteenId(activeUser),
  });

  if (canUseRailwayFallback({ activeUser, role })) {
    return createRailwayRealtimeSubscription({}, onData, onError, role);
  }

  if (source === ORDER_SOURCES.FIREBASE) {
    return createFirebaseSubscriptionWithRailwayFallback(
      { userId: activeUser?.uid },
      onData,
      onError,
      { activeUser, role },
    );
  }

  return createRailwayRealtimeSubscription({}, onData, onError, role);
}

export function subscribeToStudentOrder(activeUser, orderId, onData, onError) {
  const role = activeUser?.role || "student";
  const source = getOrderDataSource({
    role,
    firebaseUid: activeUser?.uid,
    canteenId: getActiveCanteenId(activeUser),
  });

  if (canUseRailwayFallback({ activeUser, role })) {
    return createRailwayRealtimeSubscription({ orderId }, onData, onError, role);
  }

  if (source === ORDER_SOURCES.FIREBASE) {
    return createFirebaseSubscriptionWithRailwayFallback(
      { userId: activeUser?.uid, orderId },
      onData,
      onError,
      { activeUser, role },
    );
  }

  return createRailwayRealtimeSubscription({ orderId }, onData, onError, role);
}

export function subscribeToCanteenOrders(activeUser, onData, onError) {
  const role = activeUser?.role || "canteen_staff";
  const source = getOrderDataSource({
    role,
    firebaseUid: activeUser?.uid,
    canteenId: getActiveCanteenId(activeUser),
  });
  const canteenId = getActiveCanteenId(activeUser);

  if (source === ORDER_SOURCES.FIREBASE) {
    return createFirebaseSubscriptionWithRailwayFallback(
      { canteenId },
      onData,
      onError,
      { activeUser, role },
    );
  }

  return createRailwayRealtimeSubscription({}, onData, onError, role);
}

export async function createStudentOrder(activeUser, order) {
  await ensureStudentBackendTokenForCheckout(activeUser);
  const checkoutEmail = activeUser?.email || auth.currentUser?.email || "";
  const checkoutAuid = (
    activeUser?.auid
    || activeUser?.studentAuid
    || deriveStudentAuidFromEmail(checkoutEmail)
    || ""
  );

  if (!hasBackendToken()) {
    throw new Error("Checkout session unavailable. Please log out and sign in again.");
  }

  return createOrder(
    {
      ...order,
      userId: order.userId || activeUser?.uid || auth.currentUser?.uid || "",
      userEmail: order.userEmail || checkoutEmail,
      phoneNumber: order.phoneNumber || activeUser?.phoneNumber || "",
      studentAuid: order.studentAuid || checkoutAuid,
    },
    {
      activeUser,
      role: "student",
      source: ORDER_SOURCES.RAILWAY,
    },
  );
}

export async function updateCanteenOrderStatus(activeUser, orderId, status) {
  return updateOrderStatus(orderId, status, {
    activeUser,
    role: "canteen_staff",
  });
}

export async function saveOrderNotificationToken(activeUser, data) {
  const source = getOrderDataSource({
    role: activeUser?.role || "student",
    firebaseUid: activeUser?.uid,
  });

  if (source !== ORDER_SOURCES.FIREBASE || !activeUser?.uid) {
    return;
  }

  await saveFirebaseNotificationToken(activeUser.uid, data);
}
