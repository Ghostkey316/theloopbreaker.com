/**
 * Embris In-App Notification System
 *
 * Manages in-app notifications for goal reminders, proactive suggestions,
 * and registration prompts. Stored in localStorage.
 */

const NOTIFICATIONS_KEY = 'embris_notifications_v1';
const MAX_NOTIFICATIONS = 50;

/* ── Types ── */

export type NotificationType = 'goal' | 'suggestion' | 'registration' | 'system' | 'milestone';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionLabel?: string;
  actionSection?: string;
}

/* ── Storage ── */

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ── CRUD ── */

export function getNotifications(): AppNotification[] {
  const raw = storageGet(NOTIFICATIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

export function addNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification {
  const notifications = getNotifications();
  const newNotif: AppNotification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    read: false,
  };
  notifications.unshift(newNotif);
  const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
  storageSet(NOTIFICATIONS_KEY, JSON.stringify(trimmed));
  return newNotif;
}

export function markAsRead(id: string): void {
  const notifications = getNotifications();
  const idx = notifications.findIndex(n => n.id === id);
  if (idx >= 0) {
    notifications[idx].read = true;
    storageSet(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }
}

export function markAllAsRead(): void {
  const notifications = getNotifications();
  notifications.forEach(n => { n.read = true; });
  storageSet(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

export function getUnreadCount(): number {
  return getNotifications().filter(n => !n.read).length;
}

export function clearNotifications(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(NOTIFICATIONS_KEY); } catch { /* ignore */ }
}

/* ── Notification Generators ── */

export function notifyGoalReminder(goalTitle: string): AppNotification {
  return addNotification({
    type: 'goal',
    title: 'Goal Reminder',
    message: `How's your progress on "${goalTitle}"? Check in with Embris to update your status.`,
    actionLabel: 'Open Chat',
    actionSection: 'chat',
  });
}

export function notifySuggestion(suggestion: string): AppNotification {
  return addNotification({
    type: 'suggestion',
    title: 'Embris Suggestion',
    message: suggestion,
    actionLabel: 'Chat with Embris',
    actionSection: 'chat',
  });
}

export function notifyRegistration(): AppNotification {
  return addNotification({
    type: 'registration',
    title: 'Unlock Full Embris',
    message: 'Register on-chain to unlock memory, self-learning, goals, and more. Your companion is waiting to grow with you.',
    actionLabel: 'Register Now',
    actionSection: 'chat',
  });
}

export function notifyMilestone(milestone: string): AppNotification {
  return addNotification({
    type: 'milestone',
    title: 'Milestone Reached',
    message: milestone,
  });
}

export function notifySystem(title: string, message: string): AppNotification {
  return addNotification({
    type: 'system',
    title,
    message,
  });
}
