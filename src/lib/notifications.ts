import { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import app, { db } from './firebase';

export interface AppNotification {
  id: string;
  type: 'surplus_new' | 'surplus_claimed' | 'courier_dispatched' | 'courier_arrived' | 'ngo_request' | 'general';
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  linkTab?: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'foodlink_notifications_v1';
const PUSH_TOKEN_KEY = 'foodlink_fcm_token';

// Sample initial notifications to populate for rich experience
const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-init-1',
    type: 'surplus_new',
    title: '🍲 Fresh Surplus Listing in Mumbai',
    body: 'Taj Grand Banquets listed 85 portions of Biryani & Dal Makhani. Available for 2 hours.',
    timestamp: Date.now() - 1000 * 60 * 12,
    read: false,
    linkTab: 'browse',
  },
  {
    id: 'notif-init-2',
    type: 'ngo_request',
    title: '📢 Urgent NGO Meal Request',
    body: 'Akshaya Patra Shelter posted an urgent request for 80 hot dinners for children.',
    timestamp: Date.now() - 1000 * 60 * 35,
    read: false,
    linkTab: 'requests',
  },
  {
    id: 'notif-init-3',
    type: 'courier_dispatched',
    title: '🚴 Courier En Route',
    body: 'Rahul Verma accepted the rescue run from Spice Symphony. ETA ~14 mins.',
    timestamp: Date.now() - 1000 * 60 * 90,
    read: true,
    linkTab: 'courier',
  },
];

// Helper to play subtle audible chime for critical alerts
export function playAlertChime() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch {
    // AudioContext blocked or unsupported
  }
}

export function getStoredNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveStoredNotifications(notifs: AppNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, 50)));
  } catch (err) {
    console.error('Failed to save notifications', err);
  }
}

// Request Push Notification permission & register FCM token
export async function requestPushPermission(userId?: string): Promise<{ granted: boolean; token?: string }> {
  if (!('Notification' in window)) {
    return { granted: false };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { granted: false };
    }

    let token: string | undefined = undefined;

    // Check if Firebase messaging is supported in this browser
    const supported = await isSupported().catch(() => false);
    if (supported) {
      try {
        const messaging = getMessaging(app);
        token = await getToken(messaging, {
          vapidKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuTlUhNpEdGQvW0gi5G95odwQ4', // standard web push key
        }).catch((err) => {
          console.warn('FCM getToken note (using browser notification fallback):', err.message);
          return undefined;
        });

        if (token) {
          localStorage.setItem(PUSH_TOKEN_KEY, token);
          if (userId) {
            await updateDoc(doc(db, 'users', userId), {
              fcmTokens: arrayUnion(token),
              pushNotificationsEnabled: true,
              lastPushRegisteredAt: new Date().toISOString(),
            }).catch(() => {});
          }
        }
      } catch (fcmErr) {
        console.warn('Firebase Messaging init fallback:', fcmErr);
      }
    }

    return { granted: true, token };
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return { granted: false };
  }
}

// Trigger a browser & in-app push notification
export function triggerPushNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification {
  const newNotif: AppNotification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    read: false,
  };

  // Add to local store
  const current = getStoredNotifications();
  const updated = [newNotif, ...current];
  saveStoredNotifications(updated);

  // Play audio alert
  playAlertChime();

  // Show native OS notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(newNotif.title, {
        body: newNotif.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge.png',
      });
    } catch {
      // Background worker might be handling
    }
  }

  // Dispatch custom window event so all open tabs and components react
  window.dispatchEvent(new CustomEvent('foodlink_new_notification', { detail: newNotif }));

  return newNotif;
}

// Hook for components to manage notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(getStoredNotifications);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    return 'Notification' in window ? Notification.permission : 'denied';
  });

  useEffect(() => {
    const handleNewNotif = () => {
      setNotifications(getStoredNotifications());
    };

    window.addEventListener('foodlink_new_notification', handleNewNotif);
    window.addEventListener('storage', handleNewNotif);

    // Setup FCM foreground listener if supported
    isSupported().then((supported) => {
      if (supported) {
        try {
          const messaging = getMessaging(app);
          onMessage(messaging, (payload) => {
            const title = payload.notification?.title || payload.data?.title || 'FoodLink Surplus Alert';
            const body = payload.notification?.body || payload.data?.body || 'New surplus activity reported.';
            triggerPushNotification({
              type: 'general',
              title,
              body,
              linkTab: payload.data?.linkTab || 'browse',
            });
          });
        } catch {
          // Foreground listener setup
        }
      }
    });

    return () => {
      window.removeEventListener('foodlink_new_notification', handleNewNotif);
      window.removeEventListener('storage', handleNewNotif);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveStoredNotifications(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveStoredNotifications(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveStoredNotifications([]);
  }, []);

  const enableNotifications = useCallback(async (userId?: string) => {
    const res = await requestPushPermission(userId);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    return res.granted;
  }, []);

  return {
    notifications,
    unreadCount,
    permission,
    markAsRead,
    markAllAsRead,
    clearAll,
    enableNotifications,
  };
}
