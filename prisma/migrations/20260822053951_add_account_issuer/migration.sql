-- AlterTable
ALTER TABLE "account" ADD COLUMN     "issuer" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account"("issuer", "accountId");
