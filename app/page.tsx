"use client";

import { useState, useEffect, useSyncExternalStore, useRef, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
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

const STORAGE_KEY = "2fa-history";

interface SecretEntry {
  id: string;
  secret: string;
  label: string;
  createdAt: number;
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

function generateTOTP(secret: string): { code: string; timeLeft: number } | { error: string } {
  if (!secret.trim()) {
    return { code: "", timeLeft: 30 };
  }

  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    return { code: totp.generate(), timeLeft: Math.ceil(totp.remaining() / 1000) };
  } catch {
    return { error: "Invalid secret" };
  }
}

function TOTPCard({
  entry,
  onRemove,
  copied,
  onCopy,
}: {
  entry: SecretEntry;
  onRemove: () => void;
  copied: boolean;
  onCopy: (code: string) => void;
}) {
  useCurrentTime();

  const result = generateTOTP(entry.secret);
  const code = "code" in result ? result.code : "";
  const timeLeft = "timeLeft" in result ? result.timeLeft : 30;
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
    <div className="group relative rounded-lg bg-zinc-900 p-4 transition-colors dark:bg-zinc-800">
      <button
        onClick={onRemove}
        className="absolute right-2 top-2 p-1 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <button
        onClick={() => onCopy(code)}
        className="w-full text-left"
      >
        <div className="mb-1 text-xs text-zinc-400">{entry.label}</div>
        <div className="font-mono text-2xl font-bold tracking-widest text-white">
          {code.slice(0, 3)} {code.slice(3)}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          {copied ? (
            <span className="text-zinc-400">Copied</span>
          ) : (
            <>
              <span className={timeLeft <= 5 ? "text-red-400" : ""}>{timeLeft}s</span>
              <span>·</span>
              <span>Click to copy</span>
            </>
          )}
        </div>
      </button>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [history, setHistory] = useState<SecretEntry[]>([]);
  const [input, setInput] = useState("");
  const [pendingSecret, setPendingSecret] = useState<{ secret: string; label: string } | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
    setMounted(true);
  }, []);

  // Sync with server when logged in
  const syncWithServer = useCallback(async (localHistory: SecretEntry[]) => {
    if (!session?.user) return;

    setSyncing(true);
    try {
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secrets: localHistory.map((h) => ({
            secret: h.secret,
            label: h.label,
            createdAt: h.createdAt,
          })),
        }),
      });

      if (res.ok) {
        const serverSecrets = await res.json();
        const merged: SecretEntry[] = serverSecrets.map((s: { id: string; secret: string; label: string; createdAt: string }) => ({
          id: s.id,
          secret: s.secret,
          label: s.label,
          createdAt: new Date(s.createdAt).getTime(),
        }));
        setHistory(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
    } catch {
      // ignore sync errors
    } finally {
      setSyncing(false);
    }
  }, [session?.user]);

  // Fetch from server on login
  useEffect(() => {
    if (status === "authenticated" && mounted) {
      syncWithServer(history);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, mounted]);

  // Focus label input when pending
  useEffect(() => {
    if (pendingSecret && !pendingSecret.label) {
      labelInputRef.current?.focus();
    }
  }, [pendingSecret]);

  const saveToStorage = useCallback((entries: SecretEntry[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, []);

  const addEntry = useCallback((secret: string, label: string) => {
    const exists = history.some((entry) => entry.secret === secret);
    if (exists) return;

    const newEntry: SecretEntry = {
      id: crypto.randomUUID(),
      secret,
      label,
      createdAt: Date.now(),
    };

    const newHistory = [newEntry, ...history];
    setHistory(newHistory);
    saveToStorage(newHistory);

    // Sync if logged in
    if (session?.user) {
      syncWithServer(newHistory);
    }
  }, [history, saveToStorage, session?.user, syncWithServer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const parsed = parseInput(input);
    if (!parsed.secret) return;

    const exists = history.some((entry) => entry.secret === parsed.secret);
    if (exists) {
      setInput("");
      return;
    }

    if (parsed.label) {
      addEntry(parsed.secret, parsed.label);
      setInput("");
    } else {
      setPendingSecret(parsed);
      setInput("");
    }
  };

  const handleLabelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSecret) return;

    const label = labelInput.trim() || "Unnamed";
    addEntry(pendingSecret.secret, label);
    setPendingSecret(null);
    setLabelInput("");
  };

  const cancelPending = () => {
    setPendingSecret(null);
    setLabelInput("");
    inputRef.current?.focus();
  };

  const removeEntry = async (id: string) => {
    const entry = history.find((e) => e.id === id);
    const newHistory = history.filter((e) => e.id !== id);
    setHistory(newHistory);
    saveToStorage(newHistory);

    // Delete from server if logged in
    if (session?.user && entry) {
      try {
        await fetch(`/api/secrets?secret=${encodeURIComponent(entry.secret)}`, {
          method: "DELETE",
        });
      } catch {
        // ignore
      }
    }
  };

  const copyToClipboard = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
  };

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  const focusInput = () => {
    if (!pendingSecret) {
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950"
      onClick={focusInput}
    >
      <div className="bg-texture pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.04]" />
      
      {/* Auth button */}
      <div className="absolute right-4 top-4 z-10">
        {status === "loading" ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        ) : session?.user ? (
          <div className="flex items-center gap-2">
            {syncing && (
              <svg className="h-4 w-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 rounded-full bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="h-5 w-5 rounded-full" />
              )}
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("github")}
            className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Login
          </button>
        )}
      </div>

      <main className="relative w-full max-w-sm px-6 py-12">
        <h1 className="mb-8 text-center text-4xl font-bold tracking-widest">
          <span className="bg-gradient-to-b from-zinc-600 to-zinc-900 bg-clip-text text-transparent dark:from-zinc-200 dark:to-zinc-500">
            2FA
          </span>
        </h1>

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
              onChange={(e) => setInput(e.target.value)}
              placeholder="Secret key or otpauth:// URI"
              autoFocus
              className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-zinc-600"
            />
          </form>
        )}

        {mounted && (
          <div className="space-y-3">
            {history.map((entry) => (
              <TOTPCard
                key={entry.id}
                entry={entry}
                onRemove={() => removeEntry(entry.id)}
                copied={copied === entry.id}
                onCopy={(code) => copyToClipboard(code, entry.id)}
              />
            ))}

            {history.length === 0 && !pendingSecret && (
              <div className="flex justify-center py-8">
                <svg
                  className="h-8 w-8 text-zinc-300 dark:text-zinc-700"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 1C8.676 1 6 3.676 6 7v2H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4zm0 10a2 2 0 0 1 1 3.732V18a1 1 0 1 1-2 0v-1.268A2 2 0 0 1 12 13z" />
                </svg>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
