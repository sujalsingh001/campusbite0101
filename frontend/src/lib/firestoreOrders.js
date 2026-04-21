import {
  collection,
  doc,
  Timestamp,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import API from "@/lib/api";
import { db } from "@/lib/firebase";

function userDoc(uid) {
  return doc(db, "users", uid);
}

function userOrdersCollection(uid) {
  return collection(userDoc(uid), "orders");
}

function canteenOrdersCollection() {
  return collection(db, "canteenOrders");
}

function normalizeStatus(status) {
  const normalized = (status || "pending").toLowerCase();
  if (normalized === "placed") return "pending";
  if (normalized === "ready") return "completed";
  return normalized;
}

function toFirestoreTimestamp(value) {
  if (!value) {
    return serverTimestamp();
  }

  if (typeof value?.toDate === "function") {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Timestamp.fromDate(value);
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }

  return serverTimestamp();
}

function formatOrderDoc(snapshot) {
  const data = snapshot.data();
  const createdAt = data?.createdAt?.toDate
    ? data.createdAt.toDate()
    : typeof data?.createdAt === "string"
      ? new Date(data.createdAt)
      : null;
  const updatedAt = data?.updatedAt?.toDate
    ? data.updatedAt.toDate()
    : typeof data?.updatedAt === "string"
      ? new Date(data.updatedAt)
      : null;

  return {
    orderId: snapshot.id,
    ...data,
    status: normalizeStatus(data?.status),
    createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
    updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
  };
}

export async function saveUserOrder(uid, order) {
  const generatedOrderRef = doc(userOrdersCollection(uid));
  const orderId = order.orderId || order.order_id || generatedOrderRef.id;
  const userOrderRef = doc(userOrdersCollection(uid), orderId);
  const canteenOrderRef = doc(db, "canteenOrders", orderId);
  const items = Array.isArray(order.items) ? order.items : [];
  const derivedQuantity = items.reduce((sum, item) => sum + Number(item?.qty || 0), 0);
  const derivedItemName = order.itemName || items.map((item) => item?.name).filter(Boolean).join(", ");
  const paymentMethod = (order.paymentMethod || order.payment_method || "none").toLowerCase();
  const status = normalizeStatus(order.status);
  const tokenNumber = order.tokenNumber || order.token_number || orderId.slice(-4).toUpperCase();
  const orderDoc = {
    orderId,
    userId: uid,
    studentAuid: order.studentAuid || order.student_auid || "",
    userEmail: order.userEmail || "",
    phoneNumber: order.phoneNumber || "",
    itemName: derivedItemName,
    quantity: Number(order.quantity || derivedQuantity || 0),
    totalAmount: Number(order.totalAmount || order.total || 0),
    transactionId: order.transactionId || order.utr || "N/A",
    status,
    paymentStatus: order.paymentStatus || order.payment_status || (paymentMethod === "qr" ? "paid" : "unpaid"),
    priority: Boolean(order.priority),
    items,
    canteenId: order.canteenId || order.canteen_id || "",
    canteenName: order.canteenName || order.canteen_name || "",
    tokenNumber,
    paymentMethod,
    createdAt: toFirestoreTimestamp(order.createdAt || order.created_at),
    updatedAt: toFirestoreTimestamp(order.updatedAt || order.updated_at || order.createdAt || order.created_at),
  };

  const batch = writeBatch(db);
  batch.set(userDoc(uid), {
    email: order.userEmail || "",
    auid: order.studentAuid || order.student_auid || uid,
    phoneNumber: order.phoneNumber || "",
    phoneVerified: Boolean(order.phoneNumber),
    updatedAt: toFirestoreTimestamp(order.updatedAt || order.updated_at || order.createdAt || order.created_at),
  }, { merge: true });
  batch.set(userOrderRef, orderDoc);
  batch.set(canteenOrderRef, orderDoc);
  await batch.commit();
  return orderId;
}

export async function updateOrderStatus(orderId, userId, status) {
  const normalizedStatus = normalizeStatus(status);
  const backendStatus = normalizedStatus === "completed" ? "ready" : normalizedStatus;
  const { data } = await API.patch(`/staff/orders/${orderId}/status`, { status: backendStatus });
  const mirroredStatus = normalizeStatus(data?.status || backendStatus);
  const timestamp = toFirestoreTimestamp(data?.updated_at || data?.updatedAt || new Date().toISOString());
  const orderUpdate = {
    status: mirroredStatus,
    updatedAt: timestamp,
  };

  if (typeof data?.token_number !== "undefined") {
    orderUpdate.tokenNumber = data.token_number;
  }
  if (typeof data?.payment_status !== "undefined") {
    orderUpdate.paymentStatus = data.payment_status;
  }
  if (typeof data?.payment_method !== "undefined") {
    orderUpdate.paymentMethod = data.payment_method;
  }
  if (typeof data?.priority !== "undefined") {
    orderUpdate.priority = data.priority;
  }
  if (typeof data?.canteen_id !== "undefined") {
    orderUpdate.canteenId = data.canteen_id;
  }
  if (typeof data?.canteen_name !== "undefined") {
    orderUpdate.canteenName = data.canteen_name;
  }
  if (typeof data?.student_auid !== "undefined") {
    orderUpdate.studentAuid = data.student_auid;
  }
  if (Array.isArray(data?.items)) {
    orderUpdate.items = data.items;
  }
  if (typeof data?.total !== "undefined") {
    orderUpdate.totalAmount = data.total;
  }

  const batch = writeBatch(db);
  batch.set(doc(db, "canteenOrders", orderId), orderUpdate, { merge: true });
  batch.set(doc(db, "users", userId, "orders", orderId), orderUpdate, { merge: true });
  await batch.commit();
  return orderUpdate;
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

export function subscribeToUserOrders(uid, onData, onError) {
  const ordersQuery = query(userOrdersCollection(uid), orderBy("createdAt", "desc"));
  return onSnapshot(
    ordersQuery,
    (snapshot) => onData(snapshot.docs.map(formatOrderDoc)),
    onError,
  );
}

export function subscribeToUserOrder(uid, orderId, onData, onError) {
  const orderDoc = doc(db, "users", uid, "orders", orderId);
  return onSnapshot(
    orderDoc,
    (snapshot) => onData(snapshot.exists() ? formatOrderDoc(snapshot) : null),
    onError,
  );
}

export function subscribeToCanteenOrders(canteenId, onData, onError) {
  const ordersQuery = query(canteenOrdersCollection(), orderBy("createdAt", "desc"));
  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const allOrders = snapshot.docs.map(formatOrderDoc);
      onData(
        canteenId
          ? allOrders.filter((order) => order.canteenId === canteenId)
          : allOrders,
      );
    },
    onError,
  );
}
