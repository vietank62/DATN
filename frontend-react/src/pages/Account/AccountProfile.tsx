import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, KeyRound, Mail, Phone, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
import type { User } from "../../types/auth";

type ProfileFormProps = {
  initialUser: User;
};

type ProfilePayload = {
  name: string;
  phone: string;
  avatar?: string | null;
  password?: string;
};

function ProfileForm({ initialUser }: ProfileFormProps) {
  const { setUser } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState(initialUser.name);
  const [phone, setPhone] = useState(initialUser.phone ?? "");
  const [avatar, setAvatar] = useState(initialUser.avatar ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const updateProfile = useMutation({
    mutationFn: (payload: ProfilePayload) =>
      api.put<User>("/v1/users/me", payload).then((response) => response.data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      localStorage.setItem("auth:user", JSON.stringify(updatedUser));
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("profile.updated"));
    },
    onError: () => {
      toast.error(t("profile.updateFailed"));
    },
  });

  const handleAvatarChange = async (file?: File) => {
    if (!file) {
      return;
    }

    try {
      setIsUploading(true);
      const imageUrl = await uploadImage(file);
      setAvatar(imageUrl);
      toast.success(t("profile.avatarUploaded"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("profile.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !phone.trim()) {
      toast.error(t("profile.required"));
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error(t("profile.passwordMin"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }

    const payload: ProfilePayload = {
      name: name.trim(),
      phone: phone.trim(),
      avatar: avatar || null,
    };

    if (newPassword) {
      payload.password = newPassword;
    }

    updateProfile.mutate(payload);
  };

  const avatarLetter = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <main className="min-h-screen bg-amber-50/40 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-7">
          <p className="text-sm font-semibold text-amber-700">{t("profile.kicker")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            {t("profile.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t("profile.description")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
          <section className="border-b border-slate-100 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={t("profile.avatar")}
                    className="h-full w-full rounded-full border-4 border-amber-100 object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-amber-100 bg-amber-600 text-4xl font-bold text-white">
                    {avatarLetter}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-amber-500 text-white shadow-lg ring-2 ring-amber-200 transition hover:bg-amber-600 focus-within:ring-4 focus-within:ring-amber-300">
                  <Camera size={17} />
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={isUploading}
                    onChange={(event) => void handleAvatarChange(event.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-lg font-bold text-slate-900">{t("profile.avatar")}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {t("profile.avatarHelp")}
                </p>
                {isUploading && <p className="mt-2 text-sm font-medium text-amber-700">{t("profile.uploading")}</p>}
              </div>
            </div>
          </section>

          <section className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
            <label className="block sm:col-span-2">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <UserRound size={16} /> {t("profile.fullName")}
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                placeholder={t("profile.fullNamePlaceholder")}
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Phone size={16} /> {t("profile.phone")}
              </span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                placeholder={t("profile.phonePlaceholder")}
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Mail size={16} /> Email
              </span>
              <input
                value={initialUser.email}
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500 outline-none"
              />
              <span className="mt-2 block text-xs text-slate-500">{t("profile.emailLocked")}</span>
            </label>
          </section>

          <section className="border-t border-slate-100 bg-slate-50/70 p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-2 text-amber-700"><KeyRound size={20} /></div>
              <div>
                <h2 className="font-bold text-slate-900">{t("profile.changePassword")}</h2>
                <p className="text-sm text-slate-500">{t("profile.changePasswordHelp")}</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">{t("profile.newPassword")}</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  placeholder={t("profile.passwordMinimum")}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">{t("profile.confirmPassword")}</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  placeholder={t("profile.confirmPasswordPlaceholder")}
                />
              </label>
            </div>
          </section>

          <div className="flex justify-end border-t border-slate-100 p-6 sm:px-8">
            <button
              type="submit"
              disabled={updateProfile.isPending || isUploading}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} />
              {updateProfile.isPending ? t("profile.saving") : t("profile.save")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function AccountProfile() {
  const { t } = useTranslation();
  const profileQuery = useQuery<User>({
    queryKey: ["account-profile"],
    queryFn: () => api.get<User>("/v1/users/me").then((response) => response.data),
  });

  if (profileQuery.isLoading) {
    return <div className="min-h-screen bg-amber-50/40" />;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-amber-50/40 px-4">
        <p className="rounded-xl bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          {t("profile.loadFailed")}
        </p>
      </main>
    );
  }

  return <ProfileForm key={profileQuery.data.userId} initialUser={profileQuery.data} />;
}
