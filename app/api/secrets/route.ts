import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  return NextResponse.json(secrets);
}

export async function POST(request: Request) {
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

  await prisma.$transaction(
    secrets.map((item) =>
      prisma.secret.upsert({
        where: {
          userId_secret: {
            userId,
            secret: item.secret,
          },
        },
        update: {
          label: item.label,
        },
        create: {
          user: { connect: { id: userId } },
          secret: item.secret,
          label: item.label,
          createdAt: new Date(item.createdAt),
        },
      })
    )
  );

  const allSecrets = await prisma.secret.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      secret: true,
      label: true,
      createdAt: true,
    },
  });

  return NextResponse.json(allSecrets);
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { secret, label } = body as { secret: string; label: string };

  if (!secret || !label) {
    return NextResponse.json({ error: "Secret and label required" }, { status: 400 });
  }

  const updated = await prisma.secret.updateMany({
    where: {
      userId: session.user.id,
      secret: secret,
    },
    data: {
      label: label,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (!secret) {
    return NextResponse.json({ error: "Secret required" }, { status: 400 });
  }

  await prisma.secret.deleteMany({
    where: {
      userId: session.user.id,
      secret: secret,
    },
  });

  return NextResponse.json({ success: true });
}
