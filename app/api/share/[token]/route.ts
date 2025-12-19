import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as OTPAuth from "otpauth";

function generateTOTP(secret: string): { otp: string; timeLeft: number } | null {
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    return {
      otp: totp.generate(),
      timeLeft: Math.ceil(totp.remaining() / 1000),
    };
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const share = await prisma.sharedSecret.findUnique({
    where: { token },
    include: {
      secret: {
        select: {
          secret: true,
          label: true,
        },
      },
    },
  });

  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = generateTOTP(share.secret.secret);

  if (!result) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 500 });
  }

  return NextResponse.json({
    label: share.secret.label,
    otp: result.otp,
    timeLeft: result.timeLeft,
  });
}
