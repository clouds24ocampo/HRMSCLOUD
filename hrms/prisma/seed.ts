import { db } from "../src/lib/db-client";
import { ROLE_SEED } from "../src/lib/roles";

async function main() {
  for (const r of ROLE_SEED) {
    await db.role.upsert({ where: { key: r.key }, update: { name: r.name }, create: r });
  }
  console.log(`Roles ready: ${ROLE_SEED.map((r) => r.key).join(", ")}`);
}

main().finally(() => db.$disconnect());
