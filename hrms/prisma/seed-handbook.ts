// Installs the IT company handbook for the first organization (the same thing the button on the Handbook page does).
//   npm run handbook:seed
import { db } from "../src/lib/db-client";
import { installItHandbook } from "../src/lib/handbook";

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization yet. Register one first.");
  console.log(await installItHandbook(org.id, org.name, null));
}
main().then(() => db.$disconnect(), (e) => { console.error(e); process.exit(1); });
