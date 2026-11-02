// Installs the IT corporation departments and positions for the first organization (same as the button on the Organization page).
//   npm run org:seed
import { db } from "../src/lib/db-client";
import { installItOrganization } from "../src/lib/it-org";

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization yet. Register one first.");
  console.log(await installItOrganization(org.id, null));
}
main().then(() => db.$disconnect(), (e) => { console.error(e); process.exit(1); });
