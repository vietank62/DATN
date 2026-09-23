import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

type Message = { id: number; senderId: number; content: string; createdAt: string };
export default function ChatPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { user } = useAuth(); const queryClient = useQueryClient(); const [content, setContent] = useState("");
  const messages = useQuery<Message[]>({ queryKey: ["chat", restaurantId], queryFn: () => api.get(`/v1/chat/restaurants/${restaurantId}/messages`).then(response => response.data), enabled: Boolean(restaurantId), refetchInterval: 10_000 });
  const send = useMutation({ mutationFn: () => api.post(`/v1/chat/restaurants/${restaurantId}/messages`, { content }), onSuccess: () => { setContent(""); queryClient.invalidateQueries({ queryKey: ["chat", restaurantId] }); } });
  return <main className="mx-auto min-h-[70vh] max-w-3xl px-4 py-8"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-200 px-5 py-4"><h1 className="font-bold text-slate-900">Nhắn tin với nhà hàng</h1><p className="mt-1 text-sm text-slate-500">Trao đổi trực tiếp về đơn đặt bàn hoặc yêu cầu hỗ trợ.</p></header><div className="min-h-80 space-y-3 bg-slate-50 p-5">{messages.isLoading && <p className="text-sm text-slate-500">Đang tải tin nhắn...</p>}{messages.isError && <p className="text-sm text-red-600">Chưa thể tải hội thoại. Vui lòng thử lại.</p>}{messages.data?.length === 0 && <p className="text-sm text-slate-500">Chưa có tin nhắn. Hãy gửi yêu cầu của bạn cho nhà hàng.</p>}{messages.data?.map(message => <div key={message.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${message.senderId === user?.userId ? "ml-auto bg-red-600 text-white" : "bg-white text-slate-700 shadow-sm"}`}><p>{message.content}</p><p className={`mt-1 text-[10px] ${message.senderId === user?.userId ? "text-red-100" : "text-slate-400"}`}>{new Date(message.createdAt).toLocaleString("vi-VN")}</p></div>)}</div><form onSubmit={event => { event.preventDefault(); if (content.trim()) send.mutate(); }} className="flex gap-2 border-t border-slate-200 p-4"><textarea value={content} onChange={event => setContent(event.target.value)} maxLength={2000} rows={2} placeholder="Nhập tin nhắn..." className="min-h-11 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500" /><button disabled={send.isPending || !content.trim()} className="inline-flex h-11 items-center gap-2 self-end rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} /> Gửi</button></form></section></main>;
}
