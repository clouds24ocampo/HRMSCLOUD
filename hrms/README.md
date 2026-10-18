# HRMS (localhost)

## Run
1. `docker compose up -d` (Postgres)
2. `npm install`
3. `npx prisma migrate deploy && npm run db:seed` (tables + roles)
4. `npm run dev` (starts Docker, the database and the app in one go), open http://localhost:3300 and click **Register your organization** (you become its Super Administrator; registration closes after the first company). Going online: see [DEPLOY.md](DEPLOY.md)

Copy `.env.example` to `.env` first and set a real `DB_PASSWORD` (also in `DATABASE_URL`).

## Philippine payroll
SSS/GSIS, PhilHealth, Pag-IBIG, BIR withholding, 13th month, de minimis, DOLE premium pay and the remittance/BIR reports run from dated rules you can edit. See [PH-COMPLIANCE.md](PH-COMPLIANCE.md) for what is and is not covered.

## Documentation & Guides
- **Master System Guide**: [MASTER-SYSTEM-GUIDE.md](MASTER-SYSTEM-GUIDE.md) (All tabs, features, workflows, and testing manual)
- **WorkSync Guide**: [WORKSYNC-GUIDE.md](WORKSYNC-GUIDE.md) (Task and project management)
- **Philippine Compliance**: [PH-COMPLIANCE.md](PH-COMPLIANCE.md) (Statutory computations and tax rules)
- **Testing Checklist**: [TESTING-GUIDE.md](TESTING-GUIDE.md) (Manual QA scripts)

## Test it
Optional sample company: `npm run demo:seed` (remove: `npm run demo:remove`).

## Check
`npm run typecheck && npm run lint && npm test && npx playwright test`
