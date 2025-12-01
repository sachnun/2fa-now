"use client";

import { useRef, useState } from "react";
import * as OTPAuth from "otpauth";

interface SecretFormProps {
  onSubmit: (secret: string, label: string) => void;
  inputError: boolean;
  setInputError: (error: boolean) => void;
  loading?: boolean;
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

export function SecretForm({ onSubmit, inputError, setInputError, loading = false }: SecretFormProps) {
  const [input, setInput] = useState("");
  const [pendingSecret, setPendingSecret] = useState<{ secret: string; label: string } | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const parsed = parseInput(input);
    if (!parsed.secret) return;

    // Validate secret before saving
    try {
      const totp = new OTPAuth.TOTP({
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(parsed.secret),
      });
      totp.generate(); // Test if secret is valid
    } catch {
      setInputError(true);
      return;
    }

    if (parsed.label) {
      onSubmit(parsed.secret, parsed.label);
      setInput("");
    } else {
      setPendingSecret(parsed);
      setInput("");
    }
  };

  const handleLabelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSecret || loading) return;

    const label = labelInput.trim() || "Unnamed";
    onSubmit(pendingSecret.secret, label);
    setPendingSecret(null);
    setLabelInput("");
  };

  const cancelPending = () => {
    setPendingSecret(null);
    setLabelInput("");
    inputRef.current?.focus();
  };

  return pendingSecret ? (
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
          disabled={loading}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          {loading ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={cancelPending}
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
  );
}