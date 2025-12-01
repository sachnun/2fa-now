"use client";

import { useMemo } from "react";
import { useCurrentTime } from "@/hooks/useCurrentTime";

export function TimeLeft() {
  const currentTime = useCurrentTime();
  const timeLeft = useMemo(() => 30 - (Math.floor(currentTime / 1000) % 30), [currentTime]);
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