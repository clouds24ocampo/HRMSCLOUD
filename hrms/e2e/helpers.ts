import { db } from "../src/lib/db-client";

// Deletes every row of the test organizations whose name contains `stamp`.
// Works for every table that has an organizationId column, so new modules are cleaned up without editing this file.
// Foreign keys and the payroll lock are switched off for this transaction only (needs the database owner, which we are locally).
export async function wipeOrgs(stamp: string | number) {
  const ids = (await db.organization.findMany({ where: { name: { contains: String(stamp) } }, select: { id: true } })).map((o) => o.id);
  if (!ids.length) return;
  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
      const q = (sql: string) => tx.$executeRawUnsafe(sql, ids);
      // Child tables without an organizationId of their own.
      await q(`DELETE FROM "PayslipLine" WHERE "payslipId" IN (SELECT "id" FROM "Payslip" WHERE "organizationId" = ANY($1::text[]))`);
      await q(`DELETE FROM "Session" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "organizationId" = ANY($1::text[]))`);
      const tables = await tx.$queryRawUnsafe<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organizationId' AND table_name <> 'Organization'`,
      );
      for (const t of tables) await q(`DELETE FROM "${t.table_name}" WHERE "organizationId" = ANY($1::text[])`);
      await q(`DELETE FROM "Organization" WHERE "id" = ANY($1::text[])`);
    },
    { timeout: 60_000 },
  );
}
