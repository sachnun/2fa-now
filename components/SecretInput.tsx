"use client";

import { useRef, FormEvent } from "react";
import * as OTPAuth from "otpauth";

interface SecretEntry {
  id: string;
  secret: string;
  label: string;
  createdAt: number;
}

const totpCache = new Map<string, { code: string; timeLeft: number; timestamp: number }>();

function generateTOTP(secret: string): { code: string; timeLeft: number } | { error: string } {
  if (!secret.trim()) {
    return { code: "", timeLeft: 30 };
  }

  try {
    const now = Date.now();
    const timeWindow = Math.floor(now / 30000); // 30-second windows
    const cacheKey = `${secret}-${timeWindow}`;
    
    const cached = totpCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < 1000) {
      return cached;
    }

    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const result = { code: totp.generate(), timeLeft: Math.ceil(totp.remaining() / 1000), timestamp: now };
    totpCache.set(cacheKey, result);
    
    // Clean old cache entries
    if (totpCache.size > 100) {
      const cutoff = now - 60000; // 1 minute ago
      for (const [key, value] of totpCache.entries()) {
        if (value.timestamp < cutoff) {
          totpCache.delete(key);
        }
      }
    }

    return result;
  } catch {
    return { error: "Invalid secret" };
  }
}

function parseInput(input: string): { secret: string; label: string } {
  const trimmed = input.trim();

  if (trimmed.startsWith("otpauth://")) {
    try {
      const totp = OTPAuth.URI.parse(trimmed);
      return {
        secret: totp.secret.base32,
        label: totp.label || totp.issuer || "",
      };
    } catch {
      return { secret: trimmed, label: "" };
    }
  }

  return { secret: trimmed.replace(/\s/g, "").toUpperCase(), label: "" };
}

interface SecretInputProps {
  input: string;
  setInput: (value: string) => void;
  inputError: boolean;
  setInputError: (value: boolean) => void;
  onSubmit: (e: FormEvent) => void;
  pendingSecret: { secret: string; label: string } | null;
  labelInput: string;
  setLabelInput: (value: string) => void;
  onLabelSubmit: (e: FormEvent) => void;
  onCancelPending: () => void;
  history: SecretEntry[];
}

export default function SecretInput({
  input,
  setInput,
  inputError,
  setInputError,
  onSubmit,
  pendingSecret,
  labelInput,
  setLabelInput,
  onLabelSubmit,
  onCancelPending,
  history,
}: SecretInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const parsed = parseInput(input);
    if (!parsed.secret) return;

    // Validate secret before saving
    const result = generateTOTP(parsed.secret);
    if ("error" in result) {
      setInputError(true);
      return;
    }

    const exists = history.some((entry) => entry.secret === parsed.secret);
    if (exists) {
      setInput("");
      return;
    }

    onSubmit(e);
  };

  const handleLabelSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!pendingSecret) return;
    onLabelSubmit(e);
  };

  return (
    <>
      {pendingSecret ? (
        <form onSubmit={handleLabelSubmit} className="mb-4">
          <input
            ref={labelInputRef}
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Name (e.g. GitHub, Google)"
            className="mb-2 w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-zinc-600"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            >
              Add
            </button>
            <button
              type="button"
              onClick={onCancelPending}
              className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (inputError) setInputError(false);
            }}
            placeholder="Secret key or otpauth:// URI"
            className={`mb-4 w-full rounded-lg border bg-white px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 ${
              inputError
                ? "border-red-500 focus:border-red-500 dark:border-red-500 dark:focus:border-red-500"
                : "border-zinc-200 focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            }`}
          />
        </form>
      )}
    </>
  );
}