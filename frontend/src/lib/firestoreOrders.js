import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  auth,
  db,
  debugFirebaseLog,
  firebaseCollections,
  functions,
} from "@/lib/firebase";

const UI_STATUS_BY_FIREBASE_STATUS = {
  new: "pending",
  pending: "pending",
  placed: "pending",
  preparing: "preparing",
  ready: "completed",
  completed: "completed",
  cancelled: "cancelled",
};

const FIREBASE_STATUS_BY_UI_STATUS = {
  pending: "new",
  new: "new",
  preparing: "preparing",
  completed: "completed",
  ready: "completed",
  cancelled: "cancelled",
};

function ordersCollection() {
  return collection(db, firebaseCollections.orders);
}

function orderDoc(orderId) {
  return doc(db, firebaseCollections.orders, orderId);
}

function userDoc(uid) {
  return doc(db, firebaseCollections.users, uid);
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

function normalizeStatus(status) {
  return UI_STATUS_BY_FIREBASE_STATUS[(status || "").toLowerCase()] || "pending";
}

function toFirebaseStatus(status) {
  return FIREBASE_STATUS_BY_UI_STATUS[(status || "").toLowerCase()] || "new";
}

function toDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDisplayFields(data = {}) {
  const items = Array.isArray(data.items) ? data.items.map(normalizeItem) : [];
  const quantity = Number(
    data.quantity
    ?? items.reduce((sum, item) => sum + Number(item.qty || 0), 0)
    ?? 0,
  );
  const totalAmount = Number(
    data.totalAmount
    ?? items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 0)), 0)
    ?? 0,
  );
  const itemName = data.itemName || items.map((item) => item.name).filter(Boolean).join(", ");

  return {
    items,
    quantity,
    totalAmount,
    itemName,
  };
}

function formatOrder(orderId, data = {}) {
  const display = buildDisplayFields(data);

  return {
    id: data.id || orderId,
    orderId: data.orderId || orderId,
    userId: data.userId || "",
    userEmail: data.userEmail || "",
    phoneNumber: data.phoneNumber || "",
    canteenId: data.canteenId || "",
    canteenName: data.canteenName || "",
    tokenNumber: data.tokenNumber || orderId.slice(-4).toUpperCase(),
    transactionId: data.transactionId || "N/A",
    paymentMethod: data.paymentMethod || "none",
    paymentStatus: data.paymentStatus || "",
    priority: Boolean(data.priority),
    studentAuid: data.studentAuid || data.userEmail || "",
    status: normalizeStatus(data.status),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    ...display,
  };
}

function buildRealtimeQuery(filters = {}) {
  const constraints = [];

  if (filters.userId) {
    constraints.push(where("userId", "==", filters.userId));
  }

  if (filters.canteenId) {
    constraints.push(where("canteenId", "==", filters.canteenId));
  }

  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(filters.limitCount || 200));

  return query(ordersCollection(), ...constraints);
}

async function callOrderStatusFunction(functionName, payload) {
  debugFirebaseLog("Calling Firebase order function", {
    functionName,
    orderId: payload?.orderId || "",
    newStatus: payload?.newStatus || "",
  });
  const callable = httpsCallable(functions, functionName);
  const response = await callable(payload);
  return response.data?.order || null;
}

export async function getOrders(filters = {}) {
  debugFirebaseLog("Fetching Firebase orders", filters);
  if (filters.orderId) {
    const snapshot = await getDoc(orderDoc(filters.orderId));
    if (!snapshot.exists()) {
      return null;
    }

    const order = formatOrder(snapshot.id, snapshot.data());
    if (filters.userId && order.userId !== filters.userId) {
      return null;
    }
    if (filters.canteenId && order.canteenId !== filters.canteenId) {
      return null;
    }
    return order;
  }

  const snapshot = await getDocs(buildRealtimeQuery(filters));
  const orders = snapshot.docs.map((entry) => formatOrder(entry.id, entry.data()));

  if (!Array.isArray(filters.statuses) || filters.statuses.length === 0) {
    return orders;
  }

  const allowed = new Set(filters.statuses.map(normalizeStatus));
  return orders.filter((order) => allowed.has(order.status));
}

export async function createOrder(order) {
  const firebaseUid = auth.currentUser?.uid || "";
  const orderUserId = firebaseUid || order.userId || "";
  debugFirebaseLog("Creating Firebase order", {
    canteenId: order?.canteenId || "",
    userId: orderUserId,
  });
  if (!orderUserId) {
    throw new Error("Login required");
  }
  const orderRef = doc(ordersCollection());
  const display = buildDisplayFields(order);
  const tokenNumber = order.tokenNumber || orderRef.id.slice(-4).toUpperCase();
  const orderDocData = {
    id: orderRef.id,
    orderId: orderRef.id,
    userId: orderUserId,
    userEmail: order.userEmail || "",
    phoneNumber: order.phoneNumber || "",
    studentAuid: order.studentAuid || order.userEmail || "",
    items: display.items,
    itemName: display.itemName,
    quantity: display.quantity,
    totalAmount: display.totalAmount,
    transactionId: order.transactionId || "N/A",
    status: toFirebaseStatus(order.status),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    canteenId: order.canteenId || "",
    canteenName: order.canteenName || "",
    tokenNumber,
    paymentMethod: order.paymentMethod || "none",
    paymentStatus: order.paymentStatus || "",
    priority: Boolean(order.priority),
  };

  await setDoc(orderRef, orderDocData);

  if (orderUserId) {
    await setDoc(userDoc(orderUserId), {
      email: order.userEmail || "",
      phoneNumber: order.phoneNumber || "",
      phoneVerified: Boolean(order.phoneNumber),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return orderRef.id;
}

export async function updateOrderStatus(orderId, userIdOrStatus, maybeStatus) {
  const nextStatus = maybeStatus || userIdOrStatus;
  const normalizedStatus = toFirebaseStatus(nextStatus);
  let functionName = "updateOrderStatus";
  if (normalizedStatus === "preparing") {
    functionName = "markPreparing";
  } else if (normalizedStatus === "cancelled") {
    functionName = "cancelOrder";
  }

  const order = await callOrderStatusFunction(functionName, {
    orderId,
    newStatus: normalizedStatus,
  });

  if (!order) {
    return getOrders({ orderId });
  }

  return formatOrder(order.id || order.orderId || orderId, order);
}

export async function saveUserNotificationToken(uid, data) {
  const update = {
    updatedAt: serverTimestamp(),
  };

  if (data?.email) {
    update.email = data.email;
  }
  if (typeof data?.fcmToken === "string" && data.fcmToken) {
    update.fcmToken = data.fcmToken;
  }
  if (typeof data?.notificationPermission === "string") {
    update.notificationPermission = data.notificationPermission;
  }
  if (typeof data?.notificationPermissionAt === "string") {
    update.notificationPermissionAt = data.notificationPermissionAt;
  }

  await setDoc(userDoc(uid), update, { merge: true });
}

export function subscribeToOrdersRealtime(filters, onData, onError) {
  debugFirebaseLog("Subscribing to Firebase orders", filters);
  if (filters?.orderId) {
    return onSnapshot(
      orderDoc(filters.orderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          onData(null);
          return;
        }

        const order = formatOrder(snapshot.id, snapshot.data());
        if (filters.userId && order.userId !== filters.userId) {
          onData(null);
          return;
        }
        if (filters.canteenId && order.canteenId !== filters.canteenId) {
          onData(null);
          return;
        }

        onData(order);
      },
      onError,
    );
  }

  return onSnapshot(
    buildRealtimeQuery(filters),
    (snapshot) => {
      const orders = snapshot.docs.map((entry) => formatOrder(entry.id, entry.data()));

      if (!Array.isArray(filters?.statuses) || filters.statuses.length === 0) {
        onData(orders);
        return;
      }

      const allowed = new Set(filters.statuses.map(normalizeStatus));
      onData(orders.filter((order) => allowed.has(order.status)));
    },
    onError,
  );
}

export async function saveUserOrder(uid, order) {
  return createOrder({
    ...order,
    userId: uid,
  });
}

export function subscribeToUserOrders(uid, onData, onError) {
  return subscribeToOrdersRealtime(
    { userId: uid },
    onData,
    onError,
  );
}

export function subscribeToUserOrder(uid, orderId, onData, onError) {
  return subscribeToOrdersRealtime(
    { userId: uid, orderId },
    onData,
    onError,
  );
}

export function subscribeToCanteenOrders(canteenId, onData, onError) {
  return subscribeToOrdersRealtime(
    { canteenId },
    onData,
    onError,
  );
}
