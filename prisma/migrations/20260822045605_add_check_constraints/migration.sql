ALTER TABLE "Ticket" ADD CONSTRAINT ticket_daily_seq CHECK ("dailySeq" BETWEEN 1 AND 3);
ALTER TABLE "Card"   ADD CONSTRAINT card_rarity      CHECK ("rarity" BETWEEN 1 AND 4);
ALTER TABLE "Habit"  ADD CONSTRAINT habit_days_count CHECK (cardinality("daysOfWeek") BETWEEN 1 AND 7);
