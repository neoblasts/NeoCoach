export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

export function sendNotification(title, body) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    // Some browsers require a service worker for notifications
  }
}