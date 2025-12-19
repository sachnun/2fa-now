"use client";

import { useState, useEffect, useCallback, use } from "react";

interface OTPData {
  label: string;
  otp: string;
  timeLeft: number;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<OTPData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(30);
  const [copied, setCopied] = useState(false);

  const fetchOTP = useCallback(async () => {
    try {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Share link tidak valid atau sudah di-revoke");
        } else {
          setError("Gagal mengambil OTP");
        }
        return;
      }
      const json = await res.json();
      setData(json);
      setTimeLeft(json.timeLeft);
      setError(null);
    } catch {
      setError("Gagal mengambil OTP");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOTP();
  }, [fetchOTP]);

  useEffect(() => {
    if (!data) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchOTP();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data, fetchOTP]);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copyToClipboard = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.otp);
    setCopied(true);
  };

  const progress = timeLeft / 30;
  const circumference = 2 * Math.PI * 12;
  const strokeDashoffset = circumference * (1 - progress);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-texture pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.04]" />

      <main className="relative w-full max-w-sm px-6 py-12">
        <h1 className="mb-8 flex items-center justify-center gap-3 text-4xl font-bold tracking-widest">
          <span className="bg-gradient-to-b from-zinc-600 to-zinc-900 bg-clip-text text-transparent dark:from-zinc-200 dark:to-zinc-500">
            2FA
          </span>
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
        </h1>

        <button
          onClick={copyToClipboard}
          className="group w-full cursor-pointer rounded-lg bg-zinc-900 p-6 text-left transition-colors hover:bg-zinc-800/50 dark:bg-zinc-800 dark:hover:bg-zinc-700/50"
        >
          <div className="mb-2 text-sm text-zinc-400">{data.label}</div>
          <div className="font-mono text-4xl font-bold tracking-widest text-white">
            {data.otp.slice(0, 3)} {data.otp.slice(3)}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            {copied ? (
              <span className="text-zinc-400">Copied</span>
            ) : (
              <span>Click to copy</span>
            )}
          </div>
        </button>


      </main>
    </div>
  );
}
