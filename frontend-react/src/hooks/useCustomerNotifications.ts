import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

export type CustomerNotification = {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  bookingId?: number | null;
  conversationId?: number | null;
};

type NotificationSnapshot = {
  items: CustomerNotification[];
  unreadCount: number;
};

export function useCustomerNotifications(userId: number | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery<NotificationSnapshot>({
    queryKey: ["customer-notifications", userId],
    queryFn: ({ signal }) => api.get("/v1/notifications/snapshot", { signal })
      .then(response => response.data),
    enabled: userId !== undefined,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: "always",
    // Recovery path if a proxy blocks streaming.
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (userId === undefined) return;
    let disposed = false;
    let controller: AbortController;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const queryKey = ["customer-notifications", userId];
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };
    const connect = async () => {
      controller = new AbortController();
      const armWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => controller.abort(), 12_000);
      };
      armWatchdog();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let delay = 100;
      try {
        // Axios interceptors retain Bearer authentication and single-flight refresh.
        const response = await api.get<ReadableStream<Uint8Array>>("/v1/notifications/stream", {
          adapter: "fetch", responseType: "stream", timeout: 0,
          signal: controller.signal, headers: { Accept: "text/event-stream" },
        });
        reader = response.data.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!disposed) {
          const { value, done } = await reader.read();
          if (done) break;
          armWatchdog();
          failures = 0;
          buffer += decoder.decode(value, { stream: true });
          let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            const event = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (event.startsWith("event: notifications\n")) refresh();
          }
        }
      } catch {
        delay = Math.min(1000 * 2 ** failures++, 15_000);
      } finally {
        clearTimeout(watchdog);
        await reader?.cancel().catch(() => undefined);
        reader?.releaseLock();
        if (!disposed) reconnect = setTimeout(() => void connect(), delay);
      }
    };
    const resume = () => {
      if (document.visibilityState === "hidden") return;
      refresh();
      // Restart any stalled connection; never create overlapping streams.
      controller.abort();
    };
    void connect();
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      clearTimeout(reconnect);
      clearTimeout(watchdog);
      controller.abort();
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      queryClient.removeQueries({ queryKey, exact: true });
    };
  }, [queryClient, userId]);

  return query;
}
