"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { TOTPCard } from "@/components/TOTPCard";
import { TimeLeft } from "@/components/TimeLeft";
import { SecretForm } from "@/components/SecretForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const STORAGE_KEY = "2fa-history";

interface SecretEntry {
  id: string;
  secret: string;
  label: string;
  createdAt: number;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [history, setHistory] = useState<SecretEntry[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inputError, setInputError] = useState(false);

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
        // Clear localStorage after successful sync
        localStorage.removeItem(STORAGE_KEY);
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

  

  const saveToStorage = useCallback((entries: SecretEntry[]) => {
    // Only save to localStorage if not logged in
    if (!session?.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  }, [session?.user]);

  const addEntry = useCallback(async (secret: string, label: string) => {
    const exists = history.some((entry) => entry.secret === secret);
    if (exists) return;

    setAdding(true);
    
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
      await syncWithServer(newHistory);
    }
    
    setAdding(false);
  }, [history, saveToStorage, session?.user, syncWithServer]);

  const handleSecretSubmit = (secret: string, label: string) => {
    const exists = history.some((entry) => entry.secret === secret);
    if (exists) return;

    addEntry(secret, label);
  };

  const removeEntry = async (id: string) => {
    const newHistory = history.filter((e) => e.id !== id);
    setHistory(newHistory);
    saveToStorage(newHistory);

    // Delete from server if logged in
    if (session?.user) {
      try {
        await fetch(`/api/secrets?id=${encodeURIComponent(id)}`, {
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

  return (
    <ErrorBoundary>
      <div
        className="relative flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950"
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
        <h1 className="mb-8 flex items-center justify-center gap-3 text-4xl font-bold tracking-widest">
          <span className="bg-gradient-to-b from-zinc-600 to-zinc-900 bg-clip-text text-transparent dark:from-zinc-200 dark:to-zinc-500">
            2FA
          </span>
          {mounted && history.length > 0 && <TimeLeft />}
        </h1>

        <SecretForm
          onSubmit={handleSecretSubmit}
          inputError={inputError}
          setInputError={setInputError}
          loading={adding}
        />

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

            {history.length === 0 && (
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
    </ErrorBoundary>
  );
}
