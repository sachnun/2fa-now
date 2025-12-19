-- CreateTable
CREATE TABLE "SharedSecret" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedSecret_token_key" ON "SharedSecret"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SharedSecret_secretId_key" ON "SharedSecret"("secretId");

-- AddForeignKey
ALTER TABLE "SharedSecret" ADD CONSTRAINT "SharedSecret_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE;
