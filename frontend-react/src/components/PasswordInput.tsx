import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes } from "react";

export default function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return <span className="relative block">
    <input {...props} type={visible ? "text" : "password"} className={`${className} pr-12`} />
    <button type="button" onClick={() => setVisible(current => !current)} aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={visible} title={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="absolute bottom-0 right-1 flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600">
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </span>;
}
