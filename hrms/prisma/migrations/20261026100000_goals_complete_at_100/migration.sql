-- A goal at 100% is achieved (the app now enforces this on every save); bring older rows in line.
UPDATE "Goal" SET "status" = 'ACHIEVED' WHERE "progress" >= 100 AND "status" = 'ACTIVE';
