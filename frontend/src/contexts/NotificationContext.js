import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const connectSSE = useCallback(() => {
    if (!user || user.role !== 'student') return;

    const token = localStorage.getItem('campusbite_token');
    if (!token) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${process.env.REACT_APP_BACKEND_URL}/api/notifications/stream?token=${token}`;
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
            // Vibrate on mobile if supported
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
        // ignore parse errors for keepalive
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      // Reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(connectSSE, 3000);
    };
  }, [user]);

  useEffect(() => {
    connectSSE();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connectSSE]);

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
