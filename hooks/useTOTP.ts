"use client";

import { useMemo, useEffect, useState } from "react";
import * as OTPAuth from "otpauth";

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

export function useTOTP(secret: string) {
  const [, setTimeWindow] = useState(() => Math.floor(Date.now() / 30000));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeWindow(Math.floor(Date.now() / 30000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return useMemo(() => generateTOTP(secret), [secret]);
}