import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MessageCircle, Send } from "lucide-react";
import { api } from "../../services/api";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";

type RelatedBooking = {
  bookingId: number;
  date: string;
  time: string;
  status: string;
};

type Conversation = {
  id: number;
  restaurant?: { id: number; name: string; image_url?: string | null } | null;
  customer?: { id: number; name: string; avatar?: string | null } | null;
  last_message?: string | null;
  unread_count: number;
  related_bookings: RelatedBooking[];
};

type ChatMessage = {
  id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ChatPage() {
  const { restaurantId } = useParams<{ restaurantId?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasCreatedConversation = useRef(false);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const conversationsQuery = useQuery<Conversation[]>({
    queryKey: ["chat-conversations"],
    queryFn: () => api.get("/v1/chat/conversations/me").then((response) => response.data),
    refetchInterval: 10_000,
  });
  const conversations = conversationsQuery.data ?? [];
  const requestedConversationId = Number(searchParams.get("conversation")) || null;
  const activeConversationId =
    selectedConversationId
    ?? requestedConversationId
    ?? conversations[0]?.id
    ?? null;
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const messagesQuery = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", activeConversationId],
    queryFn: () =>
      api
        .get(`/v1/chat/conversations/${activeConversationId}/messages`, {
          params: { limit: 50, offset: 0 },
        })
        .then((response) => response.data),
    enabled: Boolean(activeConversationId),
    refetchInterval: 5_000,
  });
  const createConversation = useMutation({
    mutationFn: (id: number) =>
      api.post("/v1/chat/conversations", { restaurant_id: id }).then((response) => response.data as Conversation),
    onSuccess: (conversation) => {
      setSelectedConversationId(conversation.id);
      queryClient.setQueryData<Conversation[]>(["chat-conversations"], (current) => {
        const conversations = current ?? [];
        const existing = conversations.find((item) => item.id === conversation.id);

        return existing
          ? conversations
          : [conversation, ...conversations];
      });
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: () => toast.error("Không thể mở cuộc trò chuyện với nhà hàng."),
  });
  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      api
        .post(`/v1/chat/conversations/${activeConversationId}/messages`, { content })
        .then((response) => response.data as ChatMessage),
    onSuccess: () => {
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["chat-messages", activeConversationId] });
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: () => toast.error("Không thể gửi tin nhắn."),
  });

  const markConversationRead = useCallback(
    async (conversationId: number) => {
      await api.put(`/v1/chat/conversations/${conversationId}/read`);

      queryClient.setQueryData<Conversation[]>(
        ["chat-conversations"],
        (current) =>
          current?.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, unread_count: 0 }
              : conversation,
          ),
      );
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    [queryClient],
  );

  useEffect(() => {
    if (
      user?.role === "customer"
      && restaurantId
      && !hasCreatedConversation.current
    ) {
      hasCreatedConversation.current = true;
      createConversation.mutate(Number(restaurantId));
    }
  }, [createConversation, restaurantId, user?.role]);

  useEffect(() => {
    if (activeConversationId && messagesQuery.data) {
      void markConversationRead(activeConversationId);
    }
  }, [activeConversationId, markConversationRead, messagesQuery.dataUpdatedAt]);

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    const content = message.trim();

    if (content) {
      sendMessage.mutate(content);
    }
  };

  const getConversationTitle = (conversation: Conversation) =>
    user?.role === "manager"
      ? conversation.customer?.name ?? "Thực khách"
      : conversation.restaurant?.name ?? "Nhà hàng";
  const bookingsLink = user?.role === "manager" ? "/manager/bookings" : "/account/bookings";

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <aside className={`${activeConversation ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-gray-100 md:w-80`}>
        <div className="border-b border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-amber-700" />
            <h1 className="font-bold text-gray-900">Tin nhắn</h1>
          </div>
          <p className="mt-1 text-xs text-gray-500">Trao đổi trực tiếp với {user?.role === "manager" ? "thực khách" : "nhà hàng"}.</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversationsQuery.isLoading && <p className="p-5 text-center text-sm text-gray-400">Đang tải...</p>}
          {!conversationsQuery.isLoading && conversations.length === 0 && (
            <p className="p-5 text-center text-sm leading-6 text-gray-500">
              Chưa có cuộc trò chuyện nào.
            </p>
          )}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelectedConversationId(conversation.id)}
              className={`flex w-full cursor-pointer items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition ${
                conversation.id === activeConversationId ? "bg-amber-50" : "hover:bg-gray-50"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
                {getConversationTitle(conversation).charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-800">{getConversationTitle(conversation)}</span>
                <span className="mt-0.5 block truncate text-xs text-gray-500">{conversation.last_message || "Bắt đầu cuộc trò chuyện"}</span>
              </span>
              {conversation.unread_count > 0 && conversation.id !== activeConversationId && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {conversation.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      <section className={`${activeConversation ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {activeConversation ? (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <div>
                <h2 className="font-bold text-gray-900">{getConversationTitle(activeConversation)}</h2>
                <p className="text-xs text-gray-500">Trao đổi trực tiếp trên TableNow</p>
              </div>
              {activeConversation.related_bookings.length > 0 && (
                <Link to={bookingsLink} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100">
                  Xem đơn đặt bàn ({activeConversation.related_bookings.length})
                </Link>
              )}
              <button type="button" onClick={() => setSelectedConversationId(null)} className="ml-2 cursor-pointer text-xs font-semibold text-gray-500 md:hidden">Danh sách</button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
              {messagesQuery.data?.map((chatMessage) => {
                const isMine = chatMessage.sender_id === user?.userId;
                return (
                  <div key={chatMessage.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${isMine ? "rounded-br-md bg-amber-600 text-white" : "rounded-bl-md bg-white text-gray-800"}`}>
                      {!isMine && <p className="mb-1 text-xs font-bold text-amber-800">{chatMessage.sender_name}</p>}
                      <p className="whitespace-pre-wrap leading-6">{chatMessage.content}</p>
                      <p className={`mt-1 text-right text-[10px] ${isMine ? "text-amber-100" : "text-gray-400"}`}>{formatTime(chatMessage.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleSend} className="flex gap-2 border-t border-gray-100 p-3">
              <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Nhập tin nhắn..." className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white" />
              <button type="submit" disabled={sendMessage.isPending || !message.trim()} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" /> Gửi
              </button>
            </form>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <MessageCircle className="h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-semibold text-gray-600">Chọn một cuộc trò chuyện để bắt đầu.</p>
          </div>
        )}
      </section>
    </div>
  );
}
