import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
import { useBookingRefund, refundError, refundMoney, type DepositRefund } from "../../services/refund";
import { RefundTimeline } from "../../components/RefundProgress";
import { useTranslation } from "react-i18next";

function RecipientForm({ refund }: { refund: DepositRefund }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [bank, setBank] = useState(refund.bank_name ?? "");
  const [name, setName] = useState(refund.account_name ?? "");
  const [number, setNumber] = useState(refund.account_number ?? "");
  const [qr, setQr] = useState(refund.qr_image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () => api.put(`/v1/deposits/bookings/${refund.booking_id}/refund/recipient`, {
      bank_name: bank.trim(), account_name: name.trim(), account_number: number.trim(), qr_image_url: qr || null,
    }),
    onSuccess: async () => {
      await Promise.all(["booking-refund", "booking-detail", "my-bookings", "customer-notifications"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(t("refund.submitted"));
      navigate(`/account/bookings/${refund.booking_id}`, { replace: true });
    },
    onError: e => setError(refundError(e, t("refund.submitFailed"))),
  });
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true); setError("");
    try { setQr(await uploadImage(file)); }
    catch { setError(t("refund.qrFailed")); }
    finally { setUploading(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); if (!save.isPending && !uploading) { setError(""); save.mutate(); } }
  const busy = uploading || save.isPending;
  return <form onSubmit={submit} className="space-y-5">
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
      <label className="block space-y-1"><span className="font-semibold">{t("refund.bank")}</span><input required minLength={2} maxLength={120} value={bank} onChange={e => setBank(e.target.value)} placeholder={t("refund.bankPlaceholder")} className="w-full rounded-xl border p-3" /></label>
      <label className="block space-y-1"><span className="font-semibold">{t("refund.accountNumber")}</span><input required minLength={4} maxLength={50} pattern="[A-Za-z0-9]+" title={t("refund.accountNumberHint")} value={number} onChange={e => setNumber(e.target.value)} autoComplete="off" className="w-full rounded-xl border p-3" /></label>
      <label className="block space-y-1"><span className="font-semibold">{t("refund.recipient")}</span><input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder={t("refund.recipientPlaceholder")} className="w-full rounded-xl border p-3" /></label>
      <label className="block space-y-1"><span className="font-semibold">{t("refund.qrImage")}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => void upload(e.target.files?.[0])} className="block w-full text-sm" /><span className="text-xs text-gray-500">{t("refund.qrHelp")}</span></label>
      {qr && <div className="space-y-2"><img src={qr} alt={t("refund.qrAlt")} className="h-44 w-44 rounded-xl border object-contain" /><button type="button" onClick={() => setQr("")} className="text-sm text-red-600">{t("refund.removeQr")}</button></div>}
    </fieldset>
    <p className="text-sm text-gray-600">{t("refund.instructions")}</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button disabled={busy || bank.trim().length < 2 || name.trim().length < 2} className="w-full rounded-xl bg-emerald-700 p-3 font-bold text-white disabled:opacity-50">{uploading ? t("refund.uploading") : save.isPending ? t("refund.submitting") : t("refund.submit")}</button>
  </form>;
}
export default function BookingRefund() {
  const { t, i18n } = useTranslation();
  const { bookingId = "" } = useParams();
  const q = useBookingRefund(bookingId);
  return <main className="mx-auto w-full max-w-2xl px-4 py-8">
    <Link to={`/account/bookings/${bookingId}`} className="text-sm text-gray-600 underline">{t("refund.backToBooking")}</Link>
    <section className="mt-5 space-y-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold">{t("refund.title")}</h1>
      {q.isLoading ? <p>{t("refund.loading")}</p> : q.isError || !q.data ? <div role="alert"><p>{refundError(q.error, t("refund.loadFailed"))}</p><button onClick={() => void q.refetch()} className="mt-3 text-blue-700 underline">{t("refund.retry")}</button></div> : <>
        <p>{t("refund.summary", { bookingId: q.data.booking_id })} <strong>{refundMoney(q.data.amount, i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN")}</strong></p>
        <p className="text-sm text-gray-600">{t("refund.overdue")}</p>
        {q.data.status === "pending" ? <RecipientForm key={q.data.id} refund={q.data} /> : <RefundTimeline refund={q.data} />}
      </>}
    </section>
  </main>;
}
