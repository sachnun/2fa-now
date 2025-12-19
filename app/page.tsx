"use client";

import { useState, useEffect, useSyncExternalStore, useRef, useCallback, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import * as OTPAuth from "otpauth";
import jsQR from "jsqr";

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
  shareToken?: string | null;
}

async function decodeQRFromImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      resolve(code?.data || null);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
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

const PLACEHOLDERS = [
  "Secret key",
  "otpauth:// URI",
  "Paste QR image",
];

function AnimatedPlaceholder({ show }: { show: boolean }) {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!show) return;
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % PLACEHOLDERS.length);
        setIsAnimating(false);
      }, 200);
    }, 2500);
    return () => clearInterval(interval);
  }, [show]);

  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center px-4 overflow-hidden">
      <span
        className={`font-mono text-sm text-zinc-400 dark:text-zinc-600 transition-all duration-200 ${
          isAnimating ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {PLACEHOLDERS[index]}
      </span>
    </div>
  );
}

function TimeLeft() {
  const now = useCurrentTime();
  const timeLeft = 30 - (Math.floor(now / 1000) % 30);
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

function TOTPCard({
  entry,
  onRemove,
  onUpdateLabel,
  copied,
  onCopy,
  onShare,
  onRevokeShare,
  isLoggedIn,
}: {
  entry: SecretEntry;
  onRemove: () => void;
  onUpdateLabel: (newLabel: string) => void;
  copied: boolean;
  onCopy: (code: string) => void;
  onShare: () => void;
  onRevokeShare: () => void;
  isLoggedIn: boolean;
}) {
  const now = useCurrentTime();
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(entry.label);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const periodKey = Math.floor(now / 30000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => generateTOTP(entry.secret), [entry.secret, periodKey]);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditing]);

  const handleSaveLabel = () => {
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== entry.label) {
      onUpdateLabel(trimmed);
    } else {
      setEditLabel(entry.label);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveLabel();
    } else if (e.key === "Escape") {
      setEditLabel(entry.label);
      setIsEditing(false);
    }
  };
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
        {deleteConfirm ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-red-500">Delete?</span>
            <button
              onClick={() => { setDeleteConfirm(false); onRemove(); }}
              className="p-1 text-red-500 hover:text-red-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="p-1 text-zinc-400 hover:text-zinc-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-2 text-red-400 hover:text-red-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="group relative cursor-pointer rounded-lg bg-zinc-900 p-4 transition-colors hover:bg-zinc-800/50 dark:bg-zinc-800 dark:hover:bg-zinc-700/50">
      {deleteConfirm ? (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <span className="text-xs text-zinc-500">Delete?</span>
          <button
            onClick={() => { setDeleteConfirm(false); onRemove(); }}
            className="p-1 text-red-500 hover:text-red-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button
            onClick={() => setDeleteConfirm(false)}
            className="p-1 text-zinc-500 hover:text-zinc-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity sm:group-hover:opacity-100">
          {isLoggedIn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (entry.shareToken) {
                  onRevokeShare();
                } else {
                  onShare();
                }
              }}
              className={`cursor-pointer p-1 transition-colors ${
                entry.shareToken
                  ? "text-green-500 hover:text-green-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
              title={entry.shareToken ? "Sharing active" : "Share OTP"}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setDeleteConfirm(true)}
            className="cursor-pointer p-1 text-zinc-600 hover:text-zinc-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <button
        onClick={() => onCopy(code)}
        className="w-full cursor-pointer text-left"
      >
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleSaveLabel}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="mb-1 w-full bg-transparent text-xs text-zinc-400 outline-none border-b border-zinc-600 focus:border-zinc-400"
          />
        ) : (
          <div
            className="group/label mb-1 text-xs text-zinc-400 active:text-zinc-300 hover:text-zinc-300 inline-flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {entry.label}
            <svg className="h-3 w-3 opacity-0 transition-opacity group-hover/label:opacity-100 group-active/label:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </div>
        )}
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

export default function Home() {
  const { data: session, status } = useSession();
  const [history, setHistory] = useState<SecretEntry[]>([]);
  const [input, setInput] = useState("");
  const [pendingSecret, setPendingSecret] = useState<{ secret: string; label: string } | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [inputError, setInputError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const localStorageLoadedRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {}
    }
    localStorageLoadedRef.current = true;
    setMounted(true);
  }, []);

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
        const merged: SecretEntry[] = serverSecrets.map((s: { id: string; secret: string; label: string; createdAt: string; shareToken?: string | null }) => ({
          id: s.id,
          secret: s.secret,
          label: s.label,
          createdAt: new Date(s.createdAt).getTime(),
          shareToken: s.shareToken,
        }));
        setHistory(merged);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {} finally {
      setSyncing(false);
    }
  }, [session?.user]);

  const historyRef = useRef<SecretEntry[]>([]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    if (status === "authenticated" && mounted && localStorageLoadedRef.current) {
      const timer = setTimeout(() => {
        syncWithServer(historyRef.current);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [status, mounted, syncWithServer]);

  useEffect(() => {
    if (pendingSecret && !pendingSecret.label) {
      labelInputRef.current?.focus();
    }
  }, [pendingSecret]);

  const saveToStorage = useCallback((entries: SecretEntry[]) => {
    if (!session?.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  }, [session?.user]);

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

    if (session?.user) {
      syncWithServer(newHistory);
    }
  }, [history, saveToStorage, session?.user, syncWithServer]);

  const processOtpInput = useCallback((inputValue: string) => {
    const parsed = parseInput(inputValue);
    if (!parsed.secret) return;

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

    if (parsed.label) {
      addEntry(parsed.secret, parsed.label);
      setInput("");
    } else {
      setPendingSecret(parsed);
      setInput("");
    }
  }, [history, addEntry]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const qrData = await decodeQRFromImage(file);
        if (qrData) {
          processOtpInput(qrData);
        } else {
          setInputError(true);
        }
        return;
      }
    }
  }, [processOtpInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    processOtpInput(input);
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

    if (session?.user && entry) {
      try {
        await fetch(`/api/secrets?secret=${encodeURIComponent(entry.secret)}`, {
          method: "DELETE",
        });
      } catch {}
    }
  };

  const copyToClipboard = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
  };

  const updateLabel = async (id: string, newLabel: string) => {
    const entry = history.find((e) => e.id === id);
    if (!entry) return;

    const newHistory = history.map((e) =>
      e.id === id ? { ...e, label: newLabel } : e
    );
    setHistory(newHistory);
    saveToStorage(newHistory);

    if (session?.user) {
      try {
        await fetch("/api/secrets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: entry.secret, label: newLabel }),
        });
      } catch {}
    }
  };

  const [shareModal, setShareModal] = useState<{ id: string; token: string } | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const createShare = async (id: string) => {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/secrets/${id}/share`, { method: "POST" });
      if (res.ok) {
        const { token } = await res.json();
        setHistory((prev) =>
          prev.map((e) => (e.id === id ? { ...e, shareToken: token } : e))
        );
        setShareModal({ id, token });
      }
    } catch {} finally {
      setShareLoading(false);
    }
  };

  const revokeShare = async (id: string) => {
    try {
      const res = await fetch(`/api/secrets/${id}/share`, { method: "DELETE" });
      if (res.ok) {
        setHistory((prev) =>
          prev.map((e) => (e.id === id ? { ...e, shareToken: null } : e))
        );
        setShareModal(null);
      }
    } catch {}
  };

  const openShareModal = (id: string) => {
    const entry = history.find((e) => e.id === id);
    if (entry?.shareToken) {
      setShareModal({ id, token: entry.shareToken });
    } else {
      createShare(id);
    }
  };

  const copyShareLink = async () => {
    if (!shareModal) return;
    const url = `${window.location.origin}/share/${shareModal.token}`;
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  };

  const exportConfig = () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      secrets: history.map((h) => ({
        secret: h.secret,
        label: h.label,
        createdAt: h.createdAt,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `2fa-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importConfig = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const secrets = data.secrets as { secret: string; label: string; createdAt: number }[];
        if (!Array.isArray(secrets)) return;

        const existingSecrets = new Set(history.map((h) => h.secret));
        const newEntries: SecretEntry[] = [];

        for (const s of secrets) {
          if (!s.secret || existingSecrets.has(s.secret)) continue;
          const result = generateTOTP(s.secret);
          if ("error" in result) continue;

          existingSecrets.add(s.secret);
          newEntries.push({
            id: crypto.randomUUID(),
            secret: s.secret,
            label: s.label || "Imported",
            createdAt: s.createdAt || Date.now(),
          });
        }

        if (newEntries.length > 0) {
          const newHistory = [...newEntries, ...history];
          setHistory(newHistory);
          saveToStorage(newHistory);

          if (session?.user) {
            syncWithServer(newHistory);
          }
        }
      } catch {}
    };
    input.click();
  };

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-texture pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.04]" />
      
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {mounted && (
          <>
            <button
              onClick={importConfig}
              className="flex items-center gap-1.5 rounded-full bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              title="Import config"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import
            </button>
            {history.length > 0 && (
              <button
                onClick={exportConfig}
                className="flex items-center gap-1.5 rounded-full bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                title="Export config"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export
              </button>
            )}
          </>
        )}
        {status === "loading" ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        ) : session?.user ? (
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 rounded-full bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {syncing ? (
              <svg className="h-5 w-5 animate-spin text-zinc-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="h-5 w-5 rounded-full" />
            ) : null}
            Logout
          </button>
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
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="relative">
              <AnimatedPlaceholder show={!input} />
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (inputError) setInputError(false);
                }}
                onPaste={handlePaste}
                className={`w-full rounded-lg border bg-white px-4 py-3 font-mono text-sm text-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100 ${
                  inputError
                    ? "border-red-500 focus:border-red-500 dark:border-red-500 dark:focus:border-red-500"
                    : "border-zinc-200 focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
                }`}
              />
            </div>
          </form>
        )}

        {mounted && (
          <div className="space-y-3">
            {history.map((entry) => (
              <TOTPCard
                key={entry.id}
                entry={entry}
                onRemove={() => removeEntry(entry.id)}
                onUpdateLabel={(newLabel) => updateLabel(entry.id, newLabel)}
                copied={copied === entry.id}
                onCopy={(code) => copyToClipboard(code, entry.id)}
                onShare={() => openShareModal(entry.id)}
                onRevokeShare={() => revokeShare(entry.id)}
                isLoggedIn={!!session?.user}
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

      {shareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShareModal(null)}>
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
              <input
                type="text"
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareModal.token}`}
                className="flex-1 bg-transparent text-xs text-zinc-700 outline-none dark:text-zinc-300"
              />
              <button
                onClick={copyShareLink}
                className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              >
                {shareCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => revokeShare(shareModal.id)}
                className="rounded-lg px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Revoke
              </button>
              <button
                onClick={() => setShareModal(null)}
                className="flex-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {shareLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        </div>
      )}
    </div>
  );
}
