import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = getClientIP(request);
  const rateLimitResult = rateLimit(ip);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { 
        status: 429,
        headers: {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetTime?.toString() || "",
        },
      }
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const secrets = await prisma.secret.findMany({
    where: { userId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      secret: true,
      label: true,
      createdAt: true,
    },
  });

  const decryptedSecrets = secrets.map(secret => ({
    ...secret,
    secret: decrypt(secret.secret),
  }));

  return NextResponse.json(decryptedSecrets);
}

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const rateLimitResult = rateLimit(ip);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { 
        status: 429,
        headers: {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetTime?.toString() || "",
        },
      }
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { secrets } = body as { secrets: { secret: string; label: string; createdAt: number }[] };

  if (!Array.isArray(secrets)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Batch upsert operations with encryption
  const encryptedSecrets = secrets.map(item => ({
    ...item,
    secret: encrypt(item.secret),
  }));

  // Use transaction for batch operations
  await prisma.$transaction(async (tx) => {
    for (const item of encryptedSecrets) {
      await tx.secret.upsert({
        where: {
          userId_secret: {
            userId: userId,
            secret: item.secret,
          },
        },
        update: {
          label: item.label,
        },
        create: {
          userId: userId,
          secret: item.secret,
          label: item.label,
          createdAt: new Date(item.createdAt),
        },
      });
    }
  });

  // Return all secrets
  const allSecrets = await prisma.secret.findMany({
    where: { userId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      secret: true,
      label: true,
      createdAt: true,
    },
  });

  const decryptedSecrets = allSecrets.map(secret => ({
    ...secret,
    secret: decrypt(secret.secret),
  }));

  return NextResponse.json(decryptedSecrets);
}

export async function DELETE(request: Request) {
  const ip = getClientIP(request);
  const rateLimitResult = rateLimit(ip);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { 
        status: 429,
        headers: {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetTime?.toString() || "",
        },
      }
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  // Verify the secret belongs to the user before deleting
  const secret = await prisma.secret.findFirst({
    where: {
      id: id,
      userId: userId,
    },
  });

  if (!secret) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  await prisma.secret.delete({
    where: { id: id },
  });

  return NextResponse.json({ success: true });
}
