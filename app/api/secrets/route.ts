import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { rateLimit, getClientIP } from "@/lib/rateLimit";

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
        }
      }
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secrets = await prisma.secret.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      secret: true,
      label: true,
      createdAt: true,
    },
  });

  // Decrypt secrets before sending to client
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
        }
      }
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { secrets } = body as { secrets: { secret: string; label: string; createdAt: number }[] };

  if (!Array.isArray(secrets)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Batch upsert operations with encryption
  const userId = session.user.id;
  const operations = secrets.map(item => {
    const encryptedSecret = encrypt(item.secret);
    return prisma.secret.upsert({
      where: {
        userId_secret: {
          userId,
          secret: encryptedSecret,
        },
      },
      update: {
        label: item.label,
      },
      create: {
        userId,
        secret: encryptedSecret,
        label: item.label,
        createdAt: new Date(item.createdAt),
      },
    });
  });

  await prisma.$transaction(operations);

  // Return all secrets
  const allSecrets = await prisma.secret.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      secret: true,
      label: true,
      createdAt: true,
    },
  });

  // Decrypt secrets before sending to client
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
        }
      }
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await prisma.secret.deleteMany({
    where: {
      id: id,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ success: true });
}
