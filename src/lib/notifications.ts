export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission {
  if (!notificationsSupported()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

export function sendNotification(title: string, body?: string, tag?: string) {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    new Notification(title, { body, tag, icon: "/favicon.ico" });
    return true;
  } catch {
    return false;
  }
}
