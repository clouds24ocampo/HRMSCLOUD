# Deploy online (one VPS)

Needs: a Linux VPS with Docker, and a domain whose DNS **A record** points at the VPS IP. Ports 80 and 443 open.

1. Copy the project to the server (git clone or scp).
2. `cp .env.production.example .env.production`, then set `DOMAIN` and a long random `DB_PASSWORD`.
3. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
4. Open `https://<DOMAIN>/register` and create the company. This is the only company: registration closes right after.
5. Phones need HTTPS for GPS and the camera: Caddy gets the certificate automatically.

Notes
- Only Caddy is published. The app and Postgres stay on the private Docker network (the app trusts `X-Forwarded-For` from Caddy, so never publish port 3300).
- Data lives in the Docker volumes `pgdata` (database) and `storage` (uploaded documents, payment proofs). Back both up.
  Database: `docker compose -f docker-compose.prod.yml --env-file .env.production exec db pg_dump -U hrms hrms > backup.sql`
- Update: pull the new code and rerun step 3. Migrations run on start.
- Tests only: `ALLOW_MULTIPLE_ORGS=true` lets many companies register. Never set it in production.
