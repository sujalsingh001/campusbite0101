import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getToken, onMessage } from "firebase/messaging";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseMessaging } from "@/lib/firebase";
import {
  saveUserNotificationToken,
  subscribeToUserOrders,
} from "@/lib/firestoreOrders";

const NotificationContext = createContext(null);

const STATUS_MESSAGES = {
  preparing: "Your order is being prepared 🍳",
  completed: "Your order is ready for pickup ✅",
  cancelled: "Your order was cancelled ❌",
};

function buildOrderUrl(orderId) {
  return `/student/order/${orderId}`;
}

async function showBrowserNotification(registration, order) {
  const message = STATUS_MESSAGES[order.status];
  if (!message || typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const options = {
    body: message,
    tag: `order-${order.orderId}-${order.status}`,
    requireInteraction: order.status === "completed" || order.status === "cancelled",
    data: {
      url: buildOrderUrl(order.orderId),
      order_id: order.orderId,
      status: order.status,
    },
  };

  if (registration?.showNotification) {
    await registration.showNotification("CampusBite", options);
    return;
  }

  new Notification("CampusBite", options);
}

function notifyOrderStatus(registration, order) {
  const message = STATUS_MESSAGES[order.status];
  if (!message) {
    return;
  }

  toast(message, {
    description: order.canteenName || "CampusBite",
    duration: 6000,
  });

  showBrowserNotification(registration, order).catch(() => {});
}

function readMessagePayload(payload) {
  const data = payload?.data || {};
  const status = (data.status || "").toLowerCase();
  const message = STATUS_MESSAGES[status] || payload?.notification?.body || "";
  const orderId = data.orderId || data.order_id || "";

  if (!message) {
    return null;
  }

  return {
    orderId,
    status,
    canteenName: data.canteenName || data.canteen_name || "",
    message,
  };
}

export function NotificationProvider({ children }) {
  const { user, currentUser, loading } = useAuth();
  const activeUser = currentUser || (user?.role === "student" ? user : null);
  const serviceWorkerRef = useRef(null);
  const orderStatusesRef = useRef(new Map());

  useEffect(() => {
    if (loading || !activeUser?.uid || typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    let unsubscribeMessage = () => {};

    async function setupNotifications() {
      let permission = typeof Notification === "undefined" ? "default" : Notification.permission;

      if ("serviceWorker" in navigator) {
        try {
          serviceWorkerRef.current = await navigator.serviceWorker.register("/sw.js");
        } catch (error) {
          console.error("Service worker registration failed", error);
        }
      }

      if (typeof Notification !== "undefined" && permission === "default") {
        try {
          permission = await Notification.requestPermission();
        } catch (error) {
          console.error("Notification permission request failed", error);
        }
      }

      await saveUserNotificationToken(activeUser.uid, {
        email: activeUser.email || "",
        notificationPermission: permission,
        notificationPermissionAt: new Date().toISOString(),
      });

      const messaging = await getFirebaseMessaging();
      if (!messaging || cancelled) {
        return;
      }

      const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
      if (permission === "granted" && vapidKey) {
        try {
          const fcmToken = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: serviceWorkerRef.current || undefined,
          });

          if (!cancelled && fcmToken) {
            await saveUserNotificationToken(activeUser.uid, {
              email: activeUser.email || "",
              fcmToken,
              notificationPermission: permission,
              notificationPermissionAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("FCM token setup failed", error);
        }
      }

      unsubscribeMessage = onMessage(messaging, (payload) => {
        const messageData = readMessagePayload(payload);
        if (!messageData) {
          return;
        }

        toast(messageData.message, {
          description: messageData.canteenName || "CampusBite",
          duration: 6000,
        });

        showBrowserNotification(serviceWorkerRef.current, {
          orderId: messageData.orderId,
          status: messageData.status,
          canteenName: messageData.canteenName,
        }).catch(() => {});
      });
    }

    setupNotifications();

    return () => {
      cancelled = true;
      unsubscribeMessage();
    };
  }, [activeUser?.email, activeUser?.uid, loading]);

  useEffect(() => {
    if (loading || !activeUser?.uid) {
      return undefined;
    }

    orderStatusesRef.current = new Map();

    const unsubscribe = subscribeToUserOrders(
      activeUser.uid,
      (orders) => {
        const nextStatuses = new Map();

        orders.forEach((order) => {
          const previousStatus = orderStatusesRef.current.get(order.orderId);
          nextStatuses.set(order.orderId, order.status);

          if (previousStatus && previousStatus !== order.status) {
            notifyOrderStatus(serviceWorkerRef.current, order);
          }
        });

        orderStatusesRef.current = nextStatuses;
      },
      (error) => {
        console.error("Order notification listener failed", error);
      },
    );

    return () => {
      orderStatusesRef.current = new Map();
      unsubscribe();
    };
  }, [activeUser?.uid, loading]);

  const value = useMemo(() => ({}), []);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
