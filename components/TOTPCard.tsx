"use client";

import { useCurrentTime } from "@/hooks/useCurrentTime";
import { useTOTP } from "@/hooks/useTOTP";

interface SecretEntry {
  id: string;
  secret: string;
  label: string;
  createdAt: number;
}

interface TOTPCardProps {
  entry: SecretEntry;
  onRemove: () => void;
  copied: boolean;
  onCopy: (code: string) => void;
}

export function TOTPCard({
  entry,
  onRemove,
  copied,
  onCopy,
}: TOTPCardProps) {
  useCurrentTime();

  const result = useTOTP(entry.secret);
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
    <div className="group relative cursor-pointer rounded-lg bg-zinc-900 p-4 transition-colors hover:bg-zinc-800/50 dark:bg-zinc-800 dark:hover:bg-zinc-700/50">
      <button
        onClick={onRemove}
        className="absolute right-2 top-2 cursor-pointer p-1 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <button
        onClick={() => onCopy(code)}
        className="w-full cursor-pointer text-left"
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