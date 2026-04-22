import { createContext, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import API, { getApiUrl } from '@/lib/api';

const NotificationContext = createContext(null);

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pushSubscribedRef = useRef(false);

  // ── SSE Connection (existing, unchanged) ──
  const connectSSE = useCallback(() => {
    if (!user || user.role !== 'student') return;

    const token = localStorage.getItem('campusbite_token');
    if (!token) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${getApiUrl("/notifications/stream")}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') return;

        if (data.type === 'order_status') {
          if (data.status === 'preparing') {
            toast(`Order #${data.token_number} is being prepared`, {
              description: `${data.canteen_name} kitchen is working on it`,
              duration: 6000,
              className: 'notification-toast-preparing',
            });
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          } else if (data.status === 'ready') {
            toast(`Order #${data.token_number} is READY!`, {
              description: `Collect from ${data.canteen_name} counter now`,
              duration: 10000,
              className: 'notification-toast-ready',
            });
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
          }
        }
      } catch (e) {
        console.error('Notification parse error:', e);
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      reconnectTimerRef.current = setTimeout(connectSSE, 3000);
    };
  }, [user]);

  // ── Web Push Subscription ──
  const subscribeToPush = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    if (pushSubscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported in this browser');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('VAPID public key not configured');
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      await API.post('/push/subscribe', {
        subscription: subscription.toJSON(),
      });

      pushSubscribedRef.current = true;
      console.log('Push notification subscription active');
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  }, [user]);

  useEffect(() => {
    connectSSE();
    subscribeToPush();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connectSSE, subscribeToPush]);

  const value = useMemo(() => ({}), []);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
