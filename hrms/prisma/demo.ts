// Opt-in sample company for trying the system. Fully separate from real organizations: its own name, its own people.
//   npm run demo:seed     create it (does nothing if it already exists)
//   npm run demo:remove   delete it and everything in it
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db-client";
import { DEFAULT_LEAVE_TYPES, DEFAULT_STAMP_TYPES, DEPARTMENT_SUGGESTIONS, positionSuggestionsFor, shiftPresetFor } from "../src/lib/defaults";
import { ensureTemplates } from "../src/lib/checklists";
import { ROLES } from "../src/lib/roles";
import { addDays, dayKey } from "../src/lib/time";
import { PACK, PACK_VERSION } from "../src/lib/ph/pack";
import { standardHolidays } from "../src/lib/ph/holidays";
import { leavePresetsFor } from "../src/lib/ph/leaves";
import { wipeOrgs } from "../e2e/helpers";

const TAG = "DEMO-SAMPLE";
export const DEMO_PASSWORD = "Demo-Pass-12345";
const TZ = "Asia/Manila";
const mail = (n: string) => `${n}@demo.test`;

async function seed() {
  if (await db.organization.findFirst({ where: { name: { contains: TAG } } })) return console.log("Demo company already exists. Run demo:remove first to rebuild it.");
  const roles = await db.role.findMany();
  if (roles.length < 4) throw new Error("Roles missing. Run: npm run db:seed");
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const org = await db.organization.create({ data: { name: `Sample Company (${TAG})`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  const id = org.id;
  // The sample runs on the Philippine rules so every screen has something to show.
  await db.orgSettings.create({ data: { organizationId: id, statutoryProfile: "PHILIPPINES" } });
  await db.timeStampType.createMany({ data: DEFAULT_STAMP_TYPES.map((t) => ({ ...t, organizationId: id })) });
  await db.leaveType.createMany({ data: DEFAULT_LEAVE_TYPES.map((t) => ({ ...t, organizationId: id })) });
  await db.shiftTemplate.createMany({ data: shiftPresetFor("bpo-it").map((s) => ({ ...s, organizationId: id })) });
  await db.department.createMany({ data: DEPARTMENT_SUGGESTIONS["bpo-it"].slice(0, 3).map((name) => ({ name, organizationId: id })) });
  const positions = positionSuggestionsFor("bpo-it");
  await db.position.createMany({ data: positions.map((p) => ({ ...p, organizationId: id })) });
  await ensureTemplates(db, id);

  const [dept, shift, stampIn, stampOut] = await Promise.all([
    db.department.findFirstOrThrow({ where: { organizationId: id, name: "Operations" } }),
    db.shiftTemplate.findFirstOrThrow({ where: { organizationId: id, startTime: "08:00" } }),
    db.timeStampType.findFirstOrThrow({ where: { organizationId: id, key: "TIME_IN" } }),
    db.timeStampType.findFirstOrThrow({ where: { organizationId: id, key: "TIME_OUT" } }),
  ]);
  const hired = new Date("2025-01-06T00:00:00Z");
  const person = async (key: string, first: string, last: string, roleKey: string, managerId?: string) => {
    const user = await db.user.create({ data: { organizationId: id, email: mail(key), name: `${first} ${last}`, passwordHash: hash, roleId: role(roleKey) } });
    const e = await db.employee.create({ data: { organizationId: id, userId: user.id, employeeNo: `DEMO-${key}`, firstName: first, lastName: last, email: mail(key), departmentId: dept.id, managerId, hireDate: hired } });
    await db.employmentHistory.create({ data: { organizationId: id, employeeId: e.id, change: "HIRED", effectiveFrom: hired, departmentName: dept.name } });
    await db.regularSchedule.create({ data: { organizationId: id, employeeId: e.id, shiftId: shift.id, workDays: [1, 2, 3, 4, 5], effectiveFrom: hired } });
    await db.compensation.create({ data: { organizationId: id, employeeId: e.id, payType: "MONTHLY", rateCents: 2_500_000, effectiveFrom: hired } });
    return e;
  };
  const staff = [await person("admin", "Ana", "Admin", ROLES.SUPER_ADMIN), await person("hr", "Hannah", "Reyes", ROLES.HR_ADMIN)];
  const mgr = await person("manager", "Mark", "Santos", ROLES.MANAGER);
  staff.push(mgr);
  const emps = [await person("emp1", "Ella", "Cruz", ROLES.EMPLOYEE, mgr.id), await person("emp2", "Ben", "Lopez", ROLES.EMPLOYEE, mgr.id)];

  // Ten working days of time stamps: normal days, one late, one overtime, one absence, so DTR and reports have something to show.
  const today = dayKey(new Date(), TZ);
  const days: string[] = [];
  for (let k = addDays(today, -1); days.length < 10; k = addDays(k, -1)) {
    const wd = new Date(`${k}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(k);
  }
  const at = (day: string, hm: string) => new Date(`${day}T${hm}:00+08:00`);
  const stamp = async (employeeId: string, day: string, inHm: string, outHm: string) => {
    await db.timeEvent.create({ data: { organizationId: id, employeeId, type: "IN", stampTypeId: stampIn.id, at: at(day, inHm), gpsStatus: "OK", lat: 14.5995, lng: 120.9842, accuracy: 20 } });
    await db.timeEvent.create({ data: { organizationId: id, employeeId, type: "OUT", stampTypeId: stampOut.id, at: at(day, outHm), gpsStatus: "OK", lat: 14.5995, lng: 120.9842, accuracy: 20 } });
  };
  for (const [i, d] of days.entries()) {
    if (i === 3) continue; // Ella absent
    await stamp(emps[0].id, d, i === 5 ? "08:40" : "08:00", i === 7 ? "19:30" : "17:00");
  }
  for (const s of staff) for (const d of days) await stamp(s.id, d, "08:00", "17:00");
  for (const [i, d] of days.entries()) if (i !== 9) await stamp(emps[1].id, d, "07:55", "17:05");

  // Philippine rules, tax profiles, this year's holidays fixed by law, and a wage order.
  await db.statutoryRule.createMany({
    data: PACK.map((r) => ({ organizationId: id, agency: r.agency, code: r.code, kind: r.kind, sector: r.sector, name: r.name, params: r.params as object, effectiveFrom: new Date(`${r.effectiveFrom}T00:00:00Z`), effectiveTo: r.effectiveTo ? new Date(`${r.effectiveTo}T00:00:00Z`) : null, legalBasis: r.legalBasis, note: r.note ?? null, packVersion: PACK_VERSION })),
  });
  const everyone = await db.employee.findMany({ where: { organizationId: id }, select: { id: true, employeeNo: true } });
  await db.employeeTaxProfile.createMany({ data: everyone.map((e, i) => ({ organizationId: id, employeeId: e.id, sector: "PRIVATE" as const, wageBasis: "FIVE_DAY_261" as const, wageRegion: "NCR", tin: `000-000-000-00${i + 1}`, effectiveFrom: hired })) });
  await db.holiday.createMany({ data: standardHolidays(Number(today.slice(0, 4))).map((h) => ({ organizationId: id, date: new Date(`${h.date}T00:00:00Z`), name: h.name, type: h.type })), skipDuplicates: true });
  await db.wageOrder.create({ data: { organizationId: id, region: "NCR", orderNo: "SAMPLE (not a real wage order)", dailyMinimumCents: 69500, effectiveFrom: hired } });
  await db.leaveType.createMany({ data: leavePresetsFor("PRIVATE").map((l) => ({ organizationId: id, name: l.name, annualDays: l.annualDays, paid: l.paid })), skipDuplicates: true });

  console.log(`Demo company ready. Sign in at http://localhost:3300/login with password ${DEMO_PASSWORD}`);
  for (const k of ["admin", "hr", "manager", "emp1", "emp2"]) console.log(`  ${mail(k)}`);
}

(process.argv[2] === "remove" ? wipeOrgs(TAG).then(() => console.log("Demo company removed.")) : seed()).finally(() => db.$disconnect());
