import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useLocation } from "../../hooks/useLocation";

type SuggestedRestaurant = {
  id: number;
  name: string;
  image_url?: string | null;
  district?: string | null;
  city?: string | null;
  rating?: number | null;
  price_avg?: number | null;
  available_seats?: number | null;
};

type MenuPreview = {
  restaurant_id: number;
  restaurant_name: string;
  dishes: Array<{ id: number; name: string; price?: number | null; category?: string | null }>;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  restaurants?: SuggestedRestaurant[];
  menu?: MenuPreview | null;
};

const QUICK_PROMPTS = [
  "Tìm nhà hàng buffet",
  "Hướng dẫn đặt bàn",
  "Cách hủy đơn đặt bàn",
  "Cách hoàn cọc",
];

const getChatImageUrl = (url?: string | null) => {
  if (!url) {
    return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400";
  }

  return url.includes("res.cloudinary.com")
    ? url.replace("/upload/", "/upload/f_auto,q_auto,w_400/")
    : url;
};

export function TableNowChatbot() {
  const navigate = useNavigate();
  const { city } = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Xin chào! Mình là trợ lý TableNow. Mình có thể giúp bạn tìm nhà hàng phù hợp.",
    },
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isOpen]);

  const sendMessage = async (message: string) => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isSending) {
      return;
    }

    setInput("");
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmedMessage,
      },
    ]);
    setIsSending(true);

    try {
      const response = await api.post<{
        message: string;
        restaurants: SuggestedRestaurant[];
        menu?: MenuPreview | null;
      }>("/v1/assistant/chat", {
        message: trimmedMessage,
        city,
        history: messages
          .filter((chatMessage) => chatMessage.role === "user")
          .slice(-4)
          .map((chatMessage) => chatMessage.content),
      });

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.data.message,
          restaurants: response.data.restaurants,
          menu: response.data.menu,
        },
      ]);
    } catch {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Mình chưa thể kết nối dữ liệu nhà hàng. Bạn vui lòng thử lại sau ít phút.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <section className="mb-4 flex h-[min(650px,calc(100vh-7rem))] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-red-100 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-red-600 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-600 p-2"><Bot size={20} /></div>
              <div>
                <h2 className="text-sm font-bold">Trợ lý TableNow</h2>
                <p className="text-xs text-gray-300">Gợi ý nhà hàng tức thì</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="cursor-pointer rounded-lg p-1 text-gray-300 hover:bg-white/10 hover:text-white" aria-label="Đóng chatbot">
              <X size={20} />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-red-50/40 p-4">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-md bg-red-600 px-4 py-3 text-sm leading-6 text-white" : "max-w-[92%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm leading-6 text-gray-700 shadow-sm"}>
                  {message.content}
                  {message.restaurants && message.restaurants.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.restaurants.map((restaurant) => (
                        <button key={restaurant.id} type="button" onClick={() => navigate(`/restaurant/${restaurant.id}`)} className="flex w-full cursor-pointer gap-3 rounded-xl border border-gray-100 bg-gray-50 p-2 text-left transition hover:border-red-300 hover:bg-red-50">
                          <img src={getChatImageUrl(restaurant.image_url)} alt="" loading="lazy" className="h-12 w-14 rounded-lg object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-gray-800">{restaurant.name}</span>
                            <span className="mt-1 block truncate text-[11px] text-gray-500">{restaurant.district}, {restaurant.city}</span>
                            <span className="mt-1 block text-[11px] font-semibold text-amber-600">★ {restaurant.rating ?? 0}</span>
                            {restaurant.available_seats != null && <span className="mt-1 block text-[11px] font-semibold text-emerald-700">Còn {restaurant.available_seats} chỗ</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {message.menu && message.menu.dishes.length > 0 && (
                    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="mb-2 text-xs font-bold text-gray-800">Thực đơn gợi ý</p>
                      <div className="space-y-1.5">
                        {message.menu.dishes.map((dish) => (
                          <div key={dish.id} className="flex items-start justify-between gap-3 text-[11px] text-gray-600">
                            <span className="min-w-0 truncate">{dish.name}</span>
                            {dish.price != null && <span className="shrink-0 font-semibold text-red-700">{dish.price.toLocaleString("vi-VN")}đ</span>}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => navigate(`/restaurant/${message.menu?.restaurant_id}`)} className="mt-3 cursor-pointer text-xs font-semibold text-red-700 hover:text-red-800">
                        Xem thực đơn đầy đủ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSending && <div className="w-fit rounded-2xl rounded-bl-md bg-white px-4 py-3 text-xs text-gray-500 shadow-sm">Đang tìm nhà hàng...</div>}
          </div>

          <div className="border-t border-gray-100 bg-white p-3">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} className="shrink-0 cursor-pointer rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 transition hover:bg-red-100">
                  <Sparkles className="mr-1 inline" size={12} />{prompt}
                </button>
              ))}
            </div>
            <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); void sendMessage(input); }}>
              <input maxLength={2000} aria-label="Câu hỏi cho trợ lý TableNow" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Nhập câu hỏi của bạn..." className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100" />
              <button type="submit" disabled={isSending || !input.trim()} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-red-600 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Gửi tin nhắn">
                <Send size={17} />
              </button>
            </form>
          </div>
        </section>
      )}

      <button type="button" onClick={() => setIsOpen((open) => !open)} className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-500/30 transition hover:scale-105 hover:bg-red-700" aria-label="Mở trợ lý TableNow">
        {isOpen ? <X size={24} /> : <MessageCircle size={25} />}
      </button>
    </div>
  );
}
