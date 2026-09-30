import { toast } from "@/components/ui/use-toast";

export function notificationsSupported() {
  return typeof window !== "undefined";
}

export async function requestNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") return true;
    try {
      const result = await Notification.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export function sendNotification(title, body) {
  if (typeof window === "undefined") return;

  // 1. Desktop OS Native Notification (Windows Toast via Electron)
  if (window.electronAPI?.showNotification) {
    try {
      window.electronAPI.showNotification({ title, body });
    } catch (e) {
      console.warn("[Notifications] Electron native notification error:", e);
    }
  }

  // 2. HTML5 Web Notification (Browser)
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch (e) {
      console.warn("[Notifications] HTML5 notification error:", e);
    }
  } else if ("Notification" in window && Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        try {
          new Notification(title, { body });
        } catch {}
      }
    });
  }

  // 3. In-app Toast Notification
  try {
    toast({
      title: title || "NeoCoach Focus",
      description: body || "",
    });
  } catch (e) {
    console.warn("[Notifications] Toast error:", e);
  }
}