-- Company rule: only time worked and On Trip count as working hours. Every other pause (breaks, meal, bio break, and
-- all issues such as weather, calamity, power outage, system issue, clinic) is deducted. The DTR engine enforces this;
-- the flag is aligned here so Settings shows it truthfully.
UPDATE "TimeStampType" SET "paid" = false WHERE "kind" = 'PAUSE' AND "key" <> 'ON_TRIP';
UPDATE "TimeStampType" SET "paid" = true WHERE "kind" = 'PAUSE' AND "key" = 'ON_TRIP';
