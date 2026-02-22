/**
 * Embris Notification System (Mobile)
 * In-app notification center for Embris events.
 * Uses AsyncStorage for persistence.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATIONS_KEY = "@embris_notifications_v1";
const PREFS_KEY = "@embris_notification_prefs_v1";

export interface EmbrisNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "milestone";
  read: boolean;
  timestamp: number;
}

export interface NotificationPreferences {
  enabled: boolean;
  milestones: boolean;
  goals: boolean;
  system: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  milestones: true,
  goals: true,
  system: true,
};

export async function getNotifications(): Promise<EmbrisNotification[]> {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addNotification(
  title: string,
  message: string,
  type: EmbrisNotification["type"] = "info"
): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.enabled) return;

  const notifications = await getNotifications();
  notifications.unshift({
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    message,
    type,
    read: false,
    timestamp: Date.now(),
  });

  await AsyncStorage.setItem(
    NOTIFICATIONS_KEY,
    JSON.stringify(notifications.slice(0, 50))
  );
}

export async function markAsRead(id: string): Promise<void> {
  const notifications = await getNotifications();
  const notif = notifications.find((n) => n.id === id);
  if (notif) {
    notif.read = true;
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }
}

export async function markAllAsRead(): Promise<void> {
  const notifications = await getNotifications();
  notifications.forEach((n) => (n.read = true));
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

export async function clearNotifications(): Promise<void> {
  await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
}

export async function getUnreadCount(): Promise<number> {
  const notifications = await getNotifications();
  return notifications.filter((n) => !n.read).length;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const data = await AsyncStorage.getItem(PREFS_KEY);
    return data ? { ...DEFAULT_PREFS, ...JSON.parse(data) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function updateNotificationPreferences(
  updates: Partial<NotificationPreferences>
): Promise<void> {
  const current = await getNotificationPreferences();
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...updates }));
}

// Auto-generate milestone notifications
export async function checkMilestones(totalMessages: number): Promise<void> {
  const milestones = [10, 25, 50, 100, 250, 500, 1000];
  if (milestones.includes(totalMessages)) {
    await addNotification(
      "Milestone Reached! 🎉",
      `You've exchanged ${totalMessages} messages with Embris. Your AI companion grows with every conversation.`,
      "milestone"
    );
  }
}
