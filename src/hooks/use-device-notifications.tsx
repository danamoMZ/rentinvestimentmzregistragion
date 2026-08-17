import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

const SEEN_KEY = "ri-device-notified";

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* ignore */
  }
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    return existing ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  } catch {
    return null;
  }
}

async function showDeviceNotification(row: NotificationRow) {
  const payload = {
    type: "SHOW_NOTIFICATION" as const,
    title: row.title || "RENT INVESTIMENT",
    body: row.body ?? "",
    tag: row.id,
    url: "/app/notifications",
  };

  const registration = await ensureRegistration();
  if (registration) {
    try {
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: payload.tag,
        data: { url: payload.url },
      });
      return;
    } catch {
      registration.active?.postMessage(payload);
      return;
    }
  }

  try {
    new Notification(payload.title, { body: payload.body, icon: "/favicon.png", tag: payload.tag });
  } catch {
    /* ignore */
  }
}

/**
 * Mostra os avisos da plataforma na aba de notificações do telemóvel/computador.
 * Funciona com a app aberta ou instalada no ecrã inicial (PWA).
 */
export function useDeviceNotifications() {
  const { userId } = useSession();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const seenRef = useRef<string[]>([]);
  const primedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    seenRef.current = readSeen();
    void ensureRegistration();
  }, []);

  const enable = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await ensureRegistration();
      await showDeviceNotification({
        id: `welcome-${Date.now()}`,
        title: "Notificações ativadas",
        body: "Vai receber os avisos da RENT INVESTIMENT neste dispositivo.",
        created_at: new Date().toISOString(),
      });
    }
    return result;
  }, []);

  useEffect(() => {
    if (!userId || permission !== "granted") return;
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, created_at")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (cancelled || !data) return;
      const rows = data as NotificationRow[];

      // Primeira passagem: marca o histórico como visto para não inundar o utilizador.
      if (!primedRef.current) {
        primedRef.current = true;
        const known = new Set(seenRef.current);
        const merged = [...seenRef.current, ...rows.filter((r) => !known.has(r.id)).map((r) => r.id)];
        seenRef.current = merged;
        writeSeen(merged);
        return;
      }

      const known = new Set(seenRef.current);
      const fresh = rows.filter((r) => !known.has(r.id)).reverse();
      if (fresh.length === 0) return;

      for (const row of fresh) {
        await showDeviceNotification(row);
      }
      const merged = [...seenRef.current, ...fresh.map((r) => r.id)];
      seenRef.current = merged;
      writeSeen(merged);
    };

    void check();
    const interval = window.setInterval(() => void check(), 30000);

    const channel = supabase
      .channel(`device-notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => void check())
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [userId, permission]);

  return { permission, enable };
}
