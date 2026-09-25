import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
import { useBookingRefund, refundError, refundMoney, type DepositRefund } from "../../services/refund";
import { RefundTimeline } from "../../components/RefundProgress";
import { useTranslation } from "react-i18next";

function RecipientForm({ refund, onSubmitted }: { refund: DepositRefund; onSubmitted: (updatedRefund: DepositRefund) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [bank, setBank] = useState(refund.bank_name ?? "");
  const [name, setName] = useState(refund.account_name ?? "");
  const [number, setNumber] = useState(refund.account_number ?? "");
  const [qr, setQr] = useState(refund.qr_image_url ?? "");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () => api.put(`/v1/deposits/bookings/${refund.booking_id}/refund/recipient`, {
      bank_name: bank.trim(), account_name: name.trim(), account_number: number.trim(), qr_image_url: qr || null,
    }),
    onSuccess: async (response) => {
      await Promise.all(["booking-refund", "booking-detail", "my-bookings", "customer-notifications"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      onSubmitted(response.data);
      toast.success(t("refund.submitted"));
    },
    onError: e => setError(refundError(e, t("refund.submitFailed"))),
  });
  async function upload(file?: File) {
    if (!file) return;
    setSelectedFileName(file.name);
    setUploading(true); setError("");
    try { setQr(await uploadImage(file)); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : t("refund.qrFailed")); }
    finally { setUploading(false); }
  }
  function clearSelectedImage() {
    setQr("");
    setSelectedFileName("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function submit(e: FormEvent) { e.preventDefault(); if (!save.isPending && !uploading) { setError(""); save.mutate(); } }
  const busy = uploading || save.isPending;
  return <form onSubmit={submit} className="space-y-6">
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
      <label className="block space-y-1"><span className="font-semibold">{t("refund.bank")}</span><input required minLength={2} maxLength={120} value={bank} onChange={e => setBank(e.target.value)} placeholder={t("refund.bankPlaceholder")} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100" /></label>
      <label className="block space-y-1"><span className="font-semibold">{t("refund.accountNumber")}</span><input required minLength={4} maxLength={50} pattern="[A-Za-z0-9]+" title={t("refund.accountNumberHint")} value={number} onChange={e => setNumber(e.target.value)} autoComplete="off" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100" /></label>
      <label className="block space-y-1"><span className="font-semibold">{t("refund.recipient")}</span><input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder={t("refund.recipientPlaceholder")} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100" /></label>
      <div className="space-y-2"><span className="block font-semibold">{t("refund.qrImage")}</span><input ref={fileInputRef} id="refund-qr-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => void upload(e.target.files?.[0])} className="sr-only" /><div className="flex flex-wrap items-center gap-3"><label htmlFor="refund-qr-file" className="cursor-pointer rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50">Chọn tệp</label><span className="max-w-full truncate text-sm text-slate-500">{uploading ? t("refund.uploading") : selectedFileName || "Chưa chọn tệp"}</span>{(selectedFileName || qr) && !uploading && <button type="button" onClick={clearSelectedImage} className="cursor-pointer text-sm font-bold text-slate-600 underline transition hover:text-red-600">Hủy ảnh đã chọn</button>}</div><span className="block text-xs text-gray-500">{t("refund.qrHelp")}</span></div>
      {qr && <img src={qr} alt={t("refund.qrAlt")} className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-1 object-contain" />}
    </fieldset>
    <p className="text-sm leading-6 text-slate-600">{t("refund.instructions")}</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button disabled={busy || bank.trim().length < 2 || name.trim().length < 2} className="w-full cursor-pointer rounded-xl bg-red-600 p-3 font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{uploading ? t("refund.uploading") : save.isPending ? t("refund.submitting") : t("refund.submit")}</button>
  </form>;
}
export default function BookingRefund() {
  const { t, i18n } = useTranslation();
  const { bookingId = "" } = useParams();
  const q = useBookingRefund(bookingId);
  const [submittedRefund, setSubmittedRefund] = useState<DepositRefund | null>(null);
  return <main className="min-h-screen bg-slate-50 px-4 py-10">
    <Link to={`/account/bookings/${bookingId}`} className="inline-flex text-sm font-bold text-slate-600 transition hover:text-red-600">{t("refund.backToBooking")}</Link>
    <section className="mt-5 space-y-6 rounded-2xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">{t("refund.title")}</h1>
      {q.isLoading ? <p>{t("refund.loading")}</p> : q.isError || !q.data ? <div role="alert"><p>{refundError(q.error, t("refund.loadFailed"))}</p><button onClick={() => void q.refetch()} className="mt-3 font-bold text-red-700 underline">{t("refund.retry")}</button></div> : <>
        <p>{t("refund.summary", { bookingId: q.data.booking_id })} <strong>{refundMoney(q.data.amount, i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN")}</strong></p>
        <p className="text-sm leading-6 text-slate-600">{t("refund.overdue")}</p>
        {q.data.status === "pending" && !submittedRefund ? <RecipientForm key={q.data.id} refund={q.data} onSubmitted={setSubmittedRefund} /> : <RefundTimeline refund={submittedRefund ?? q.data} />}
      </>}
    </section>
  </main>;
}
