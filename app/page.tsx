"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import * as OTPAuth from "otpauth";

function useCurrentTime() {
  return useSyncExternalStore(
    (callback) => {
      const id = setInterval(callback, 1000);
      return () => clearInterval(id);
    },
    () => Date.now(),
    () => Date.now()
  );
}

function generateTOTP(secret: string): { code: string; timeLeft: number } | { error: string } {
  if (!secret.trim()) {
    return { code: "", timeLeft: 30 };
  }

  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret.trim().replace(/\s/g, "").toUpperCase()),
    });

    return { code: totp.generate(), timeLeft: Math.ceil(totp.remaining() / 1000) };
  } catch {
    return { error: "Invalid secret" };
  }
}

export default function Home() {
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);

  useCurrentTime();

  const result = generateTOTP(secret);
  const code = "code" in result ? result.code : "";
  const timeLeft = "timeLeft" in result ? result.timeLeft : 30;
  const error = "error" in result ? result.error : "";

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copyToClipboard = async () => {
    if (code) {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full max-w-sm px-6">
        <h1 className="mb-6 text-center text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          2FA
        </h1>

        <input
          type="text"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Secret key"
          className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-zinc-600"
        />

        {error && <p className="mb-4 text-center text-sm text-red-500">{error}</p>}

        {code ? (
          <button
            onClick={copyToClipboard}
            className="w-full rounded-lg bg-zinc-900 p-5 transition-colors hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <div className="font-mono text-3xl font-bold tracking-widest text-white">
              {code.slice(0, 3)} {code.slice(3)}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-zinc-400">
              {copied ? (
                <span>Copied</span>
              ) : (
                <>
                  <span>{timeLeft}s</span>
                  <span className="text-zinc-600">·</span>
                  <span>Click to copy</span>
                </>
              )}
            </div>
          </button>
        ) : (
          !error && (
            <div className="flex justify-center py-8">
              <svg
                className="h-8 w-8 text-zinc-300 dark:text-zinc-700"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 1C8.676 1 6 3.676 6 7v2H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4zm0 10a2 2 0 0 1 1 3.732V18a1 1 0 1 1-2 0v-1.268A2 2 0 0 1 12 13z" />
              </svg>
            </div>
          )
        )}
      </main>
    </div>
  );
}
