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

## Deploy from GitHub (optional, replaces copying files by hand)
`.github/workflows/deploy.yml` updates the server after CI passes. Nothing secret is stored in the repo: put it in GitHub under **Settings > Secrets and variables > Actions** (the **Secrets** tab for secrets, the **Variables** tab for variables).

| Kind | Name | Value |
|---|---|---|
| Secret | `VPS_HOST` | the VPS IP address |
| Secret | `VPS_USER` | the SSH user (for example `root`) |
| Secret | `VPS_SSH_KEY` | the private key of a deploy-only key pair (see below) |
| Secret | `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <VPS-IP>` run from your computer |
| Secret | `DB_PASSWORD` | the database password (letters and digits only). It must equal the one the database was first created with |
| Variable | `DOMAIN` | `worksync-hrms.cloudandecho.tech` |
| Variable | `AUTO_DEPLOY` | `true` to deploy on every green push to main; leave unset to deploy only by hand |

Optional variables: `VPS_APP_DIR` (default `HRMSCLOUD`), `SESSION_TTL_HOURS`, `REGISTER_LIMIT_PER_HOUR`, `DOCUMENT_MAX_MB`, `TURN_URL`; optional secrets `TURN_USER`, `TURN_PASS`.

Deploy key: on your computer run `ssh-keygen -t ed25519 -f deploy_key -N ""`, append `deploy_key.pub` to `~/.ssh/authorized_keys` on the server, paste the contents of `deploy_key` into `VPS_SSH_KEY`, then delete both local files. The server must already have the project cloned (see the steps above). Run it by hand from the **Actions > deploy > Run workflow** button.
