import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function ordersCollection(uid) {
  return collection(db, "users", uid, "orders");
}

function formatOrderDoc(snapshot) {
  const data = snapshot.data();
  return {
    orderId: snapshot.id,
    ...data,
    createdAt: data?.createdAt?.toDate ? data.createdAt.toDate() : null,
  };
}

export async function saveUserOrder(uid, order) {
  const docRef = await addDoc(ordersCollection(uid), {
    ...order,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeToUserOrders(uid, onData, onError) {
  const ordersQuery = query(ordersCollection(uid), orderBy("createdAt", "desc"));
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
