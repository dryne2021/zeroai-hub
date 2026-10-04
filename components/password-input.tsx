"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete = "current-password",
  required = true,
}: {
  id: string;
  name?: string;
  value?: string;
  onChange?: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name ?? id}
        type={show ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        {...(onChange ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) } : {})}
        className="input pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-muted hover:bg-paper hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
