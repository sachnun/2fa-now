"use client";

import { useSyncExternalStore } from "react";
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

function TimeLeft() {
  useCurrentTime();
  const timeLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
  const progress = timeLeft / 30;
  const circumference = 2 * Math.PI * 12;
  const strokeDashoffset = circumference * (1 - progress);
  
  return (
    <div className="h-8 w-8">
      <svg className="h-8 w-8 -rotate-90" viewBox="0 0 28 28">
        <circle
          cx="14"
          cy="14"
          r="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-zinc-800 dark:text-zinc-700"
        />
        <circle
          cx="14"
          cy="14"
          r="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`transition-all duration-1000 ease-linear ${
            timeLeft <= 5 ? "text-red-500" : "text-zinc-400 dark:text-zinc-300"
          }`}
        />
      </svg>
    </div>
  );
}

export default function TOTPCard({
  entry,
  onRemove,
  copied,
  onCopy,
  removing = false,
}: {
  entry: SecretEntry;
  onRemove: () => void;
  copied: boolean;
  onCopy: (code: string) => void;
  removing?: boolean;
}) {
  useCurrentTime();

  const result = generateTOTP(entry.secret);
  const code = "code" in result ? result.code : "";
  const error = "error" in result ? result.error : "";

  if (error) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-red-50 p-4 dark:bg-red-950/30">
        <div>
          <div className="text-sm font-medium text-red-600 dark:text-red-400">
            {entry.label}
          </div>
          <div className="text-xs text-red-500">Invalid secret</div>
        </div>
        <button
          onClick={onRemove}
          className="p-2 text-red-400 hover:text-red-600"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`group relative rounded-lg bg-zinc-900 p-4 transition-colors hover:bg-zinc-800/50 dark:bg-zinc-800 dark:hover:bg-zinc-700/50 ${removing ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        onClick={onRemove}
        disabled={removing}
        className={`absolute right-2 top-2 p-1 text-zinc-600 transition-opacity hover:text-zinc-400 group-hover:opacity-100 ${
          removing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-0'
        }`}
      >
        {removing ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )}
      </button>
      <button
        onClick={() => onCopy(code)}
        disabled={removing}
        className={`w-full text-left ${removing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="mb-1 text-xs text-zinc-400">{entry.label}</div>
        <div className="font-mono text-2xl font-bold tracking-widest text-white">
          {code.slice(0, 3)} {code.slice(3)}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {copied ? (
            <span className="text-zinc-400">Copied</span>
          ) : (
            <span>Click to copy</span>
          )}
        </div>
      </button>
    </div>
  );
}

export { TimeLeft };