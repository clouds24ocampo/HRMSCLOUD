// Installs the IT corporation structure (data in it-org-data.ts) for an organization. Safe to run again.
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { IT_DEPARTMENTS, IT_POSITIONS } from "@/lib/it-org-data";

// The generic BPO starter positions that nobody holds are archived when the IT structure is installed.
const GENERIC_TO_ARCHIVE = ["Agent", "Team Leader", "Operations Manager"];

export type ItOrgResult = { departments: number; parented: number; positions: number; jobsLinked: number; archived: number };

export async function installItOrganization(organizationId: string, actorId: string | null): Promise<ItOrgResult> {
  const out: ItOrgResult = { departments: 0, parented: 0, positions: 0, jobsLinked: 0, archived: 0 };

  // Departments: create what is missing (a name that already exists is reused, even if archived) and give each its parent.
  const existing = await prisma.department.findMany({ where: { organizationId } });
  const byName = new Map(existing.map((d) => [d.name.toLowerCase(), d]));
  for (const d of IT_DEPARTMENTS) {
    if (byName.has(d.name.toLowerCase())) continue;
    byName.set(d.name.toLowerCase(), await prisma.department.create({ data: { organizationId, name: d.name } }));
    out.departments++;
  }
  for (const d of IT_DEPARTMENTS) {
    const row = byName.get(d.name.toLowerCase())!;
    const parent = d.parent ? byName.get(d.parent.toLowerCase()) : undefined;
    if (parent && !row.parentId && row.id !== parent.id) { await prisma.department.update({ where: { id: row.id }, data: { parentId: parent.id } }); out.parented++; }
  }

  // Positions: skip a title that exists. An existing one without a department gets the right one.
  const havePos = await prisma.position.findMany({ where: { organizationId } });
  const posByTitle = new Map(havePos.map((p) => [p.title.toLowerCase(), p]));
  for (const p of IT_POSITIONS) {
    const dept = byName.get(p.department.toLowerCase())!;
    const found = posByTitle.get(p.title.toLowerCase());
    if (found) {
      if (!found.departmentId) await prisma.position.update({ where: { id: found.id }, data: { departmentId: dept.id } });
      continue;
    }
    posByTitle.set(p.title.toLowerCase(), await prisma.position.create({ data: { organizationId, title: p.title, level: p.level, departmentId: dept.id } }));
    out.positions++;
  }

  // Open jobs point to their position and department, so hiring and the careers page use the right ones.
  const jobs = await prisma.jobPosting.findMany({ where: { organizationId, OR: [{ positionId: null }, { departmentId: null }] } });
  for (const j of jobs) {
    const pos = posByTitle.get(j.title.toLowerCase());
    if (!pos) continue;
    await prisma.jobPosting.update({ where: { id: j.id }, data: { positionId: j.positionId ?? pos.id, departmentId: j.departmentId ?? pos.departmentId } });
    out.jobsLinked++;
  }

  // Generic starter positions that nobody holds and that are not part of this structure.
  const unused = await prisma.position.findMany({ where: { organizationId, archivedAt: null, title: { in: GENERIC_TO_ARCHIVE }, employees: { none: {} } } });
  for (const p of unused) { await prisma.position.update({ where: { id: p.id }, data: { archivedAt: new Date() } }); out.archived++; }

  await audit(actorId, "organization.it_structure_installed", "Organization", organizationId, { ...out }, organizationId);
  return out;
}
