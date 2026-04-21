import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
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
  return (status || "pending").toLowerCase();
}

function formatOrderDoc(snapshot) {
  const data = snapshot.data();
  return {
    orderId: snapshot.id,
    ...data,
    status: normalizeStatus(data?.status),
    createdAt: data?.createdAt?.toDate ? data.createdAt.toDate() : null,
    updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate() : null,
  };
}

export async function saveUserOrder(uid, order) {
  const userOrderRef = doc(userOrdersCollection(uid));
  const orderId = userOrderRef.id;
  const canteenOrderRef = doc(db, "canteenOrders", orderId);
  const timestamp = serverTimestamp();
  const tokenNumber = order.tokenNumber || orderId.slice(-4).toUpperCase();
  const orderDoc = {
    orderId,
    userId: uid,
    userEmail: order.userEmail || "",
    phoneNumber: order.phoneNumber || "",
    itemName: order.itemName || "",
    quantity: order.quantity || 0,
    totalAmount: order.totalAmount || 0,
    transactionId: order.transactionId || "N/A",
    status: normalizeStatus(order.status),
    items: order.items || [],
    canteenId: order.canteenId || "",
    canteenName: order.canteenName || "",
    tokenNumber,
    paymentMethod: order.paymentMethod || "none",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const batch = writeBatch(db);
  batch.set(userDoc(uid), {
    email: order.userEmail || "",
    phoneNumber: order.phoneNumber || "",
    phoneVerified: Boolean(order.phoneNumber),
    updatedAt: timestamp,
  }, { merge: true });
  batch.set(userOrderRef, orderDoc);
  batch.set(canteenOrderRef, orderDoc);
  await batch.commit();
  return orderId;
}

export async function updateOrderStatus(orderId, userId, status) {
  const normalizedStatus = normalizeStatus(status);
  const timestamp = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(doc(db, "canteenOrders", orderId), {
    status: normalizedStatus,
    updatedAt: timestamp,
  }, { merge: true });
  batch.set(doc(db, "users", userId, "orders", orderId), {
    status: normalizedStatus,
    updatedAt: timestamp,
  }, { merge: true });
  await batch.commit();
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
