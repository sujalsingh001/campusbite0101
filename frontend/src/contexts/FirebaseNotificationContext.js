import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getToken, onMessage } from "firebase/messaging";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseMessaging } from "@/lib/firebase";
import {
  getOrderDataSource,
  ORDER_SOURCES,
  saveOrderNotificationToken,
  subscribeToStudentOrders,
} from "@/lib/ordersDataSource";
import API, { getApiUrl } from "@/lib/api";

const NotificationContext = createContext(null);

const STATUS_MESSAGES = {
  preparing: "Your order is being prepared 🍳",
  completed: "Your order is ready for pickup ✅",
  cancelled: "Your order was cancelled ❌",
};

function buildOrderUrl(orderId) {
  return `/student/order/${orderId}`;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
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
  const activeUser = currentUser?.role === "student"
    ? currentUser
    : (user?.role === "student" ? user : null);
  const serviceWorkerRef = useRef(null);
  const orderStatusesRef = useRef(new Map());
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pushSubscribedRef = useRef(false);
  const orderSource = getOrderDataSource({
    role: activeUser?.role || user?.role,
    firebaseUid: activeUser?.uid,
  });

  useEffect(() => {
    if (loading || typeof window === "undefined") {
      return undefined;
    }

    if (orderSource !== ORDER_SOURCES.FIREBASE || !activeUser?.uid) {
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

      await saveOrderNotificationToken(activeUser, {
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
            await saveOrderNotificationToken(activeUser, {
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
  }, [activeUser, activeUser?.email, activeUser?.uid, loading, orderSource]);

  useEffect(() => {
    if (loading || orderSource !== ORDER_SOURCES.RAILWAY) {
      return undefined;
    }

    if (!user || user.role !== "student") {
      return undefined;
    }

    const token = localStorage.getItem("campusbite_token");
    if (!token) {
      return undefined;
    }

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const url = `${getApiUrl("/notifications/stream")}?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected") {
            return;
          }

          if (data.type !== "order_status") {
            return;
          }

          notifyOrderStatus(serviceWorkerRef.current, {
            orderId: data.order_id,
            tokenNumber: data.token_number,
            status: (data.status || "").toLowerCase() === "ready" ? "completed" : (data.status || "").toLowerCase(),
            canteenName: data.canteen_name || "",
          });
        } catch (error) {
          console.error("Notification parse error:", error);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        reconnectTimerRef.current = window.setTimeout(connectSSE, 3000);
      };
    };

    const subscribeToPush = async () => {
      if (pushSubscribedRef.current) {
        return;
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        serviceWorkerRef.current = registration;

        const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          return;
        }

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }

        await API.post("/push/subscribe", {
          subscription: subscription.toJSON(),
        });

        pushSubscribedRef.current = true;
      } catch (error) {
        console.error("Push subscription failed:", error);
      }
    };

    connectSSE();
    void subscribeToPush();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [loading, orderSource, user]);

  useEffect(() => {
    if (loading || !activeUser?.uid) {
      return undefined;
    }

    orderStatusesRef.current = new Map();

    const unsubscribe = subscribeToStudentOrders(
      activeUser,
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
  }, [activeUser?.role, activeUser?.uid, loading]);

  const value = useMemo(() => ({}), []);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
