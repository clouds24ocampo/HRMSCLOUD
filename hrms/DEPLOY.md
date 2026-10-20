# Deploy online (one VPS)

Needs: a Linux VPS with Docker, and a domain whose DNS **A record** points at the VPS IP. Ports 80 and 443 open.

1. Copy the project to the server (git clone or scp).
2. `cp .env.production.example .env.production`, then set `DOMAIN` and `DB_PASSWORD` (use `openssl rand -hex 24`: letters and digits only, because it is placed in a connection URL).
3. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
4. Open `https://<DOMAIN>/register` and create the company. This is the only company: registration closes right after.
5. Phones need HTTPS for GPS and the camera: Caddy gets the certificate automatically.

Notes
- Only Caddy is published. The app and Postgres stay on the private Docker network (the app trusts `X-Forwarded-For` from Caddy, so never publish port 3300).
- Data lives in the Docker volumes `pgdata` (database) and `storage` (uploaded documents, payment proofs). Back both up.
  Database: `docker compose -f docker-compose.prod.yml --env-file .env.production exec db pg_dump -U hrms hrms > backup.sql`
- Update: pull the new code and rerun step 3. Migrations run on start.
- Tests only: `ALLOW_MULTIPLE_ORGS=true` lets many companies register. Never set it in production.
- Health: `GET /api/health` returns `{"status":"ok"}` (503 when the database is unreachable). Docker uses it to mark the app healthy, and Caddy only starts once it is. Point an uptime monitor at `https://<DOMAIN>/api/health`.
- Back up both volumes on a schedule (for example a nightly cron running the `pg_dump` above, plus a copy of the `storage` volume), keep copies off the server, and test a restore before you rely on it.

## Automatic updates from GitHub
The server pulls: it checks GitHub every 5 minutes and updates itself to the latest commit of `main`. Nothing is stored in GitHub secrets. All settings stay in `hrms/.env.production` on the server (create it as in step 2 above).

One-time setup on the VPS, after the first manual deploy (steps 1-3 above):

```bash
apt-get install -y git curl
chmod +x ~/HRMSCLOUD/hrms/scripts/auto-update.sh
crontab -e     # add this line:
*/5 * * * * ~/HRMSCLOUD/hrms/scripts/auto-update.sh >> /var/log/hrms-update.log 2>&1
```

What `hrms/scripts/auto-update.sh` does on each run:
1. Fetches `origin/main`. If there is nothing new, it exits quietly.
2. Waits until GitHub CI is green for that exact commit (tests, lint, types, audit). A failed or still-running CI means no deploy yet.
3. Fast-forwards the server to the commit and runs `docker compose up -d --build`.
4. Waits up to 6 minutes for `/api/health`. If the new version never becomes healthy it returns to the previous commit and does not retry the broken one until a newer commit arrives.

Watch it with `tail -f /var/log/hrms-update.log`. To deploy right now, run the script by hand. To skip the CI wait, put `REQUIRE_CI=false` in front of the cron command.

Notes
- Do not edit tracked files on the server; the update refuses to overwrite local changes and logs a message instead. Keep `.env.production` as the only local file.
- A rollback does not undo database migrations. Keep migrations backward compatible, and back up before risky ones.
- The script reads the public repo and CI status without a token. If the repo is made private, give the server a read-only deploy key and set `REPO` / use `REQUIRE_CI=false`.
