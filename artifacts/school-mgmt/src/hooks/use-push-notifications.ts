import { useState, useEffect } from "react";
import { parentApi } from "@/lib/jwt-api";

type PermState = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const [permState, setPermState] = useState<PermState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  useEffect(() => {
    if (!supported) { setPermState("unsupported"); return; }
    setPermState(Notification.permission as PermState);
    checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const data = await parentApi.get<{ subscribed: boolean }>("/push/status");
      setSubscribed(data.subscribed);
    } catch {}
  }

  async function subscribe(): Promise<boolean> {
    if (!supported) return false;
    setLoading(true);
    try {
      const { publicKey } = await parentApi.get<{ publicKey: string }>("/push/vapid-public-key");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      setPermState(permission as PermState);
      if (permission !== "granted") return false;

      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await parentApi.post("/push/subscribe", {
        endpoint: json.endpoint,
        keys: json.keys,
      });
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe(): Promise<void> {
    setLoading(true);
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await parentApi.del(`/push/unsubscribe`);
          await sub.unsubscribe();
        }
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    } finally {
      setLoading(false);
    }
  }

  return { supported, permState, subscribed, loading, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
