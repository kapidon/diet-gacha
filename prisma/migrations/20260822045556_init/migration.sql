-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateTable
CREATE TABLE "ShareLink" (
    "userId" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysOfWeek" "Weekday"[],
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitLogId" TEXT NOT NULL,
    "earnedDate" DATE NOT NULL,
    "dailySeq" INTEGER NOT NULL,
    "earnedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "flavorText" TEXT NOT NULL,
    "rarity" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "imagePath" TEXT,
    "knowledge" TEXT,
    "sourceUrl" TEXT,
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GachaResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "ticketId" TEXT NOT NULL,
    "drawnAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streakAtDraw" INTEGER NOT NULL,

    CONSTRAINT "GachaResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "firstResultId" TEXT NOT NULL,
    "viaHabitId" TEXT NOT NULL,
    "discoveryRank" INTEGER NOT NULL,
    "personalReward" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_shareId_key" ON "ShareLink"("shareId");

-- CreateIndex
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Habit_id_userId_key" ON "Habit"("id", "userId");

-- CreateIndex
CREATE INDEX "HabitLog_userId_date_idx" ON "HabitLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HabitLog_habitId_date_key" ON "HabitLog"("habitId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HabitLog_id_userId_date_key" ON "HabitLog"("id", "userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_habitLogId_key" ON "Ticket"("habitLogId");

-- CreateIndex
CREATE INDEX "Ticket_userId_consumedAt_idx" ON "Ticket"("userId", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_habitLogId_userId_earnedDate_key" ON "Ticket"("habitLogId", "userId", "earnedDate");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_userId_earnedDate_dailySeq_key" ON "Ticket"("userId", "earnedDate", "dailySeq");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_id_userId_key" ON "Ticket"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GachaResult_ticketId_key" ON "GachaResult"("ticketId");

-- CreateIndex
CREATE INDEX "GachaResult_userId_drawnAt_idx" ON "GachaResult"("userId", "drawnAt");

-- CreateIndex
CREATE UNIQUE INDEX "GachaResult_ticketId_userId_key" ON "GachaResult"("ticketId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GachaResult_id_userId_cardId_key" ON "GachaResult"("id", "userId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_firstResultId_key" ON "UserCard"("firstResultId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_firstResultId_userId_cardId_key" ON "UserCard"("firstResultId", "userId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_userId_cardId_key" ON "UserCard"("userId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_cardId_discoveryRank_key" ON "UserCard"("cardId", "discoveryRank");

-- AddForeignKey
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_habitId_userId_fkey" FOREIGN KEY ("habitId", "userId") REFERENCES "Habit"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_habitLogId_userId_earnedDate_fkey" FOREIGN KEY ("habitLogId", "userId", "earnedDate") REFERENCES "HabitLog"("id", "userId", "date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaResult" ADD CONSTRAINT "GachaResult_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaResult" ADD CONSTRAINT "GachaResult_ticketId_userId_fkey" FOREIGN KEY ("ticketId", "userId") REFERENCES "Ticket"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_firstResultId_userId_cardId_fkey" FOREIGN KEY ("firstResultId", "userId", "cardId") REFERENCES "GachaResult"("id", "userId", "cardId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_viaHabitId_userId_fkey" FOREIGN KEY ("viaHabitId", "userId") REFERENCES "Habit"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
