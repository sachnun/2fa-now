import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const secret = await prisma.secret.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      share: true,
    },
  });

  if (!secret) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  if (secret.share) {
    return NextResponse.json({ token: secret.share.token });
  }

  const share = await prisma.sharedSecret.create({
    data: {
      secretId: id,
    },
  });

  return NextResponse.json({ token: share.token });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const secret = await prisma.secret.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!secret) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  await prisma.sharedSecret.deleteMany({
    where: {
      secretId: id,
    },
  });

  return NextResponse.json({ success: true });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const secret = await prisma.secret.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      share: true,
    },
  });

  if (!secret) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  if (!secret.share) {
    return NextResponse.json({ token: null });
  }

  return NextResponse.json({ token: secret.share.token });
}
