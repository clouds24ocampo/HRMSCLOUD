# Deploy online (one VPS)

> The steps below use Caddy for HTTPS and need ports 80/443 free. If nginx already runs other sites on the server, follow **Shared server: nginx already owns ports 80/443** further down instead.

Needs: a Linux VPS with Docker, and a domain whose DNS **A record** points at the VPS IP. Ports 80 and 443 open.

1. Get only the app onto the server. A sparse clone leaves out `worksync-kit/`, `docs/` and the AI tooling, which the server does not need (the Docker image is built from `hrms/` alone). `git pull` and the auto-updater below keep working with it:
   `git clone --filter=blob:none --sparse https://github.com/clouds24ocampo/HRMSCLOUD.git && cd HRMSCLOUD && git sparse-checkout set hrms`
2. `cp .env.production.example .env.production`, then set `DOMAIN` and `DB_PASSWORD` (use `openssl rand -hex 24`: letters and digits only, because it is placed in a connection URL).
3. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
4. Open `https://<DOMAIN>/register` and create the company. This is the only company: registration closes right after.
5. Phones need HTTPS for GPS and the camera: Caddy gets the certificate automatically.

Notes
- Only the proxy in front (Caddy or nginx) is public. The app listens on `127.0.0.1:3300` and Postgres stays on the private Docker network (the app trusts `X-Forwarded-For` from the proxy, so never publish port 3300 on a public address).
- Data lives in the Docker volumes `pgdata` (database) and `storage` (uploaded documents, payment proofs). Back both up.
  Database: `docker compose -f docker-compose.prod.yml --env-file .env.production exec db pg_dump -U hrms hrms > backup.sql`
- Update: pull the new code and rerun step 3. Migrations run on start.
- Tests only: `ALLOW_MULTIPLE_ORGS=true` lets many companies register. Never set it in production.
- Health: `GET /api/health` returns `{"status":"ok"}` (503 when the database is unreachable). Docker uses it to mark the app healthy, and Caddy only starts once it is. Point an uptime monitor at `https://<DOMAIN>/api/health`.
- Back up both volumes on a schedule (for example a nightly cron running the `pg_dump` above, plus a copy of the `storage` volume), keep copies off the server, and test a restore before you rely on it.

## Shared server: nginx already owns ports 80/443
If the VPS already hosts other sites behind nginx, do not stop nginx and do not enable Caddy. Run HRMS on the loopback port and add one nginx site. (Caddy mode is `COMPOSE_PROFILES=caddy` in `.env.production`, only for a server where nothing else uses 80/443.)

1. Make sure port 3300 is free: `ss -tlnp | grep 3300` should print nothing. If it is taken, set `APP_PORT=<free port>` in `.env.production` and use the same port in the nginx file.
2. Start the app: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`, then `curl -s http://127.0.0.1:3300/api/health` must print `{"status":"ok"}`.
3. Add the nginx site and HTTPS:
   ```bash
   cp deploy/nginx-worksync-hrms.conf /etc/nginx/sites-available/worksync-hrms
   ln -s /etc/nginx/sites-available/worksync-hrms /etc/nginx/sites-enabled/worksync-hrms
   nginx -t && systemctl reload nginx          # reload only if the test passes: other sites keep running
   certbot --nginx -d worksync-hrms.cloudandecho.tech
   ```
4. Open `https://worksync-hrms.cloudandecho.tech/register`.

The build is heavy (about 2 GB of RAM while compiling). On a shared server check `free -h` and `df -h` first, and watch the other sites during the first build.

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
