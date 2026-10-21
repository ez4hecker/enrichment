# VPS test deployment with Docker (reached by IP)

**Audience:** an AI agent with root (or sudo) shell access to a fresh Ubuntu 22.04 or 24.04 VPS.
**Goal:** run the whole Enrichment stack with Docker Compose so the internal team can test it at `http://<VPS_IP>/`. There's no domain or HTTPS yet.
**Out of scope:** domains, TLS, CI, backups and scaling. Don't add them unless the user asks.

Read the whole guide first, then work through the steps in order. Each step ends with a **Check**; don't move on until it passes.

---

## 0. Rules for the agent

1. **Secrets.** Never print, `cat`, echo or log API keys, the Postgres password or `RESEARCH_KEY_ENCRYPTION_SECRET`, and never paste them into chat. Write them into `.env` and confirm only "set" or "empty". The **only** credentials you may show the user are the Basic Auth logins you create for testers (step 4).
2. **ASK** the user whenever this guide says ASK. Don't invent values.
3. **The app has open sign-up.** Anyone who reaches it can create an account and spend the OpenAI, LeadOcean and Serper credits. nginx Basic Auth (step 4) is therefore mandatory. Only nginx may publish a port: never add `ports:` to postgres, redis, backend or frontend.
4. **Docker bypasses ufw.** Ports that Docker publishes ignore ufw rules. That's why only nginx publishes a port. If port 80 must be limited to team IPs, use the VPS provider's firewall (see step 6).
5. If a command fails, read the error, fix the cause and re-run. Never skip a failed Check.

### Values to collect (ASK)

| Value | Where it goes | Notes |
|---|---|---|
| `VPS_IP` | `.env` `SITE_ORIGIN` | `curl -4 ifconfig.me` shows it. |
| How the code arrives | step 2 | A git URL (with access), or a tarball the user uploads. |
| `OPENAI_API_KEY` | `.env` | **Required.** The backend won't start without it. |
| `OPENAI_MODEL` | `.env` | **Required.** `.env.example` has the developer's model, so confirm it with the user. |
| `LEADOCEAN_API_KEY` | `.env` | Optional. Without it, Lead Lookup rows get `[Not Found]`. |
| `SERPER_API_KEY` | `.env` | Optional. It enables paid web search for AI Research. |
| `GEMINI_BILLED_API_KEY` | `.env` | Optional. |
| Tester usernames | step 4 | One login per tester, or one shared login. |
| Team IPs (optional) | provider firewall | Only if port 80 should be limited to the team. |

---

## 1. What runs

```
Browser ── http://VPS_IP/ (Basic Auth)
             │
        ┌────▼────┐  the only published port (HTTP_PORT, default 80)
        │  nginx  │
        └────┬────┘
        ┌────▼─────┐  /api/* rewrite (BACKEND_URL=http://backend:3000, fixed at build)
        │ frontend │  Next.js, :3001 inside the network
        └────┬─────┘
        ┌────▼────┐
        │ backend │  Fastify API + job workers, :3000 inside the network
        └─┬─────┬─┘
   ┌──────▼┐   ┌▼──────┐       migrate: one-off container that applies
   │postgres│  │ redis │       backend/infra/postgres/migrations/*.sql
   └────────┘  └───────┘       on every `up`, then exits
```

These are all defined in `docker-compose.yml` at the repo root. Data lives in three named volumes:
- `pgdata`: the database.
- `redisdata`: the job queue.
- `artifacts`: result CSVs.

Rebuilding or recreating containers keeps all three. Only `docker compose down -v` deletes them, and you must **never** run that without the user's explicit approval.

---

## 2. Install Docker and get the code

```bash
apt-get update && apt-get -y upgrade
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version && docker compose version
```

**Check:** both version commands print a version, and Compose is v2.20 or later (needed for `service_completed_successfully`).

Get the code into `/opt/enrichment`:

- **If the user gave a git URL:** `git clone <URL> /opt/enrichment`.
- **If the user is uploading a tarball:** they run this on their PC, inside the repo:
  ```powershell
  cd C:\growthInfi\enrichment
  git archive --format=tar.gz -o enrichment.tgz HEAD
  scp enrichment.tgz root@VPS_IP:/tmp/
  ```
  `git archive` packs only committed files, so `.env` is never included. The htpasswd file is committed, so it is included. Then, on the VPS:
  ```bash
  mkdir -p /opt/enrichment && tar -xzf /tmp/enrichment.tgz -C /opt/enrichment
  ```

**Check:** `ls /opt/enrichment` shows `backend`, `frontend`, `deploy`, `docker-compose.yml` and `.env.example`, and **no** `.env` file.

If the VPS has less than 2 GB of RAM, add swap now, because the frontend build can run out of memory:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 3. Create `.env`

```bash
cd /opt/enrichment
cp .env.example .env
chmod 600 .env
```

Fill these in. Generated values go in without being displayed. The user's API keys go in with `nano .env` or a `sed -i` whose arguments aren't echoed.

```bash
cd /opt/enrichment
set_env() { sed -i "s|^$1=.*|$1=$2|" .env; }   # values must not contain "|"

set_env POSTGRES_PASSWORD "$(openssl rand -hex 24)"
set_env RESEARCH_KEY_ENCRYPTION_SECRET "$(openssl rand -hex 32)"
set_env SITE_ORIGIN "http://VPS_IP"          # replace VPS_IP
set_env HTTP_PORT 80
# Then the ASKed values: OPENAI_API_KEY, OPENAI_MODEL, and any of LEADOCEAN_API_KEY, SERPER_API_KEY, GEMINI_BILLED_API_KEY.
```

Leave `SESSION_COOKIE_SECURE=false`. Over plain HTTP the login cookie would otherwise be dropped and every reload would send testers back to the login page. Switch it to `true` only when HTTPS is added.

Optionally set `LEADOCEAN_MAXIMUM_CONCURRENT_REQUESTS=15` (the developer's value; the default is 4). Lower it again if LeadOcean starts returning 429s.

`POSTGRES_PASSWORD` is set when the database is first created. Changing it later in `.env` doesn't change the database's password, so don't change it after the first `up`.

**Check** (shows presence only, never values):

```bash
grep -E '^(POSTGRES_PASSWORD|RESEARCH_KEY_ENCRYPTION_SECRET|SITE_ORIGIN|OPENAI_API_KEY|OPENAI_MODEL|LEADOCEAN_API_KEY|SERPER_API_KEY|GEMINI_BILLED_API_KEY|SESSION_COOKIE_SECURE)=' .env \
  | sed -E 's/^(SITE_ORIGIN|SESSION_COOKIE_SECURE|OPENAI_MODEL)=(.*)/\1=\2/; t; s/=(.+)/=<set>/; s/=$/=<empty>/'
```

`POSTGRES_PASSWORD`, `RESEARCH_KEY_ENCRYPTION_SECRET` and `OPENAI_API_KEY` must show `<set>`. `SITE_ORIGIN` must be `http://<VPS_IP>`, and `SESSION_COOKIE_SECURE` must be `false`.

---

## 4. Tester logins (Basic Auth)

The repo already ships `deploy/nginx/htpasswd` with the team's login (user `tester`; the user has the password). It holds only a bcrypt hash. **Use it as is.** Don't regenerate it or replace it unless the user asks.

**Check:** `ls -l deploy/nginx/htpasswd` shows a regular file (not a directory) whose line starts with `tester:`. If it's missing, ASK the user rather than creating new logins. Docker would otherwise create a *directory* in its place, and nginx would fail.

To add more testers later, append a line per tester and give the user each new password:

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbB NAME "$(openssl rand -base64 12 | tr -d '/+=')" >> deploy/nginx/htpasswd
docker compose restart nginx
```

`htpasswd -nbB` prints only the hash line, so generate the password into a variable first and show it to the user.

---

## 5. Start the stack

```bash
cd /opt/enrichment
docker compose up -d --build
```

The first build takes a few minutes. Startup order is enforced: postgres and redis become healthy, then `migrate` runs and exits 0, then the backend becomes healthy, then the frontend, then nginx.

**Check:**

```bash
docker compose ps -a
```

- `postgres`, `redis`, `backend` and `frontend` show `healthy`. `nginx` shows `running`.
- `migrate` shows `Exited (0)`. `docker compose logs migrate` lists `applying …0001…` through `…0004…`.
- `docker compose logs backend | tail` shows `CSV Enrichment is listening at http://0.0.0.0:3000`.

Then, on the VPS:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/                                   # 401 (Basic Auth)
curl -s -o /dev/null -w '%{http_code}\n' -u 'alice:PASSWORD' http://127.0.0.1/               # 200
curl -s -o /dev/null -w '%{http_code}\n' -u 'alice:PASSWORD' http://127.0.0.1/api/auth/session   # 401 = frontend→backend proxy works
docker compose exec postgres psql -U csv_app -d csv_enrichment -c '\dt'                     # 8 tables
```

The 8 tables are `enrichment_jobs`, `enrichment_job_operation_results`, `custom_operation_definitions`, `app_users`, `user_sessions`, `research_pool_keys`, `research_key_daily_usage` and `company_dossiers`.

---

## 6. Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw --force enable
```

Because of rule 4, ufw doesn't filter port 80 here; Docker opens it itself. ufw still protects SSH and anything else on the host. To limit port 80 to team IPs, **ASK** for the IPs and add the rule in the VPS provider's firewall or security group. Allow 22 from anywhere (or your admin IP) and 80 only from the team IPs.

**Check** from outside the VPS (or ask the user to run these):
- `http://VPS_IP/` prompts for a username and password.
- `curl -m 5 http://VPS_IP:3000/`, `:3001`, `:5432` and `:6379` all fail to connect.
- `docker compose ps` shows a published port only for nginx (`0.0.0.0:80->80/tcp`).

---

## 7. End-to-end acceptance test

In a browser, or have the user do it:

1. Open `http://VPS_IP/` and pass Basic Auth. The app's login page appears.
2. Sign up with an email and a password of 12 or more characters. The dashboard opens.
3. Reload the page. You're still logged in. If you're sent back to login, see Troubleshooting.
4. **New Job:** upload a small CSV (2–5 rows: first name, last name, company or website), map the columns and continue.
5. Run a standard operation (for example Clean Company Name). The job appears in **History** and completes.
6. If `LEADOCEAN_API_KEY` is set: run **Find Person / Company (LeadOcean)** on 2 rows, pick a Match strictness and click Find & append. The result columns are appended.
7. **History → View** shows the results, and **Download CSV** works.
8. `docker compose exec backend ls /data/artifacts` lists `.csv` and `.json` files.

---

## 8. Report back to the user

Include:
- The URL and the tester logins you created.
- Which optional integrations are on: LeadOcean, Serper, Gemini billed.
- The result of every step in section 7.
- That `/opt/enrichment/.env` holds the generated Postgres password and encryption secret, and must be kept. Losing `RESEARCH_KEY_ENCRYPTION_SECRET` makes stored Gemini keys unreadable.
- Anything unfinished, with the exact error.

---

## 9. Day-2 operations

All commands run in `/opt/enrichment`.

| Task | Command |
|---|---|
| Status | `docker compose ps -a` |
| Logs | `docker compose logs -f backend`, and the same with `frontend`, `nginx` or `migrate` |
| Restart one service | `docker compose restart backend` |
| Change a backend setting | Edit `.env`, then `docker compose up -d backend`. This recreates the container with the new env; no rebuild needed. |
| Change `SITE_ORIGIN` | Edit `.env`, then `docker compose up -d --build frontend` (it's baked into the build). |
| Add a tester | Append a line with `docker run --rm httpd:2.4-alpine htpasswd -nbB NAME PASS >> deploy/nginx/htpasswd`, then `docker compose restart nginx` |
| Remove a tester | Delete their line from `deploy/nginx/htpasswd`, then `docker compose restart nginx` |
| Stop everything (data kept) | `docker compose down` |
| Database shell | `docker compose exec postgres psql -U csv_app -d csv_enrichment` |
| Back up the database | `docker compose exec -T postgres pg_dump -U csv_app csv_enrichment > backup-$(date +%F).sql` |

**Deploy a new version:**

```bash
cd /opt/enrichment
# git:      git pull
# tarball:  user uploads a new enrichment.tgz, then:
#           tar -xzf /tmp/enrichment.tgz -C /opt/enrichment    (.env is not in it, so it survives)
docker compose up -d --build
docker compose ps -a        # same Check as step 5; migrate re-applies migrations (idempotent)
docker image prune -f       # optional: free disk space from old images
```

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `up` fails: `set POSTGRES_PASSWORD in .env` | It's empty | Step 3. |
| `migrate` exits non-zero | SQL error, or the password doesn't match an existing `pgdata` volume | `docker compose logs migrate`. If the password was changed after first start, put the original back in `.env`. |
| `backend` unhealthy or restarting; the log says `X must be configured` | A required variable is empty (`OPENAI_API_KEY` or `OPENAI_MODEL`) | Fill it in, then `docker compose up -d backend`. |
| The log shows `relation … does not exist` | Migrations didn't run | Check `docker compose logs migrate`, then `docker compose up -d`. |
| nginx exits: `htpasswd … is a directory` | The file was missing at first start | `docker compose stop nginx && rm -rf deploy/nginx/htpasswd`, restore the file from git (`git checkout deploy/nginx/htpasswd`) or from the tarball, then `docker compose up -d nginx`. |
| Browser shows 502 | The frontend isn't ready yet or crashed | `docker compose ps` and `docker compose logs frontend`. |
| The page loads, but every action fails and `/api/...` returns 500 or 502 | The backend is down, or the frontend was built with the wrong `BACKEND_URL` | Check `docker compose logs backend`, then rebuild the frontend with `docker compose up -d --build frontend`. |
| Logged in, but a reload goes back to login | `SESSION_COOKIE_SECURE=true` over HTTP | Set it to `false`, then `docker compose up -d backend`. |
| Upload fails with 413 | nginx body limit | Raise `client_max_body_size` in `deploy/nginx/default.conf`, then `docker compose restart nginx`. The backend's own limit is 50 MB. |
| The frontend build is killed | Out of memory | Add swap (step 2) and rebuild. |
| Port 80 already in use | A host nginx or apache is running | `systemctl disable --now nginx apache2`, or set `HTTP_PORT` to another port. |
| Lead Lookup says "Lead lookup is not configured" | `LEADOCEAN_API_KEY` is empty | Set it, then `docker compose up -d backend`. |
| LeadOcean 429s in the backend log | Too many requests in flight | Lower `LEADOCEAN_MAXIMUM_CONCURRENT_REQUESTS`. |

---

## Later, when a domain is added (not now)

The simplest route is to swap the nginx service for Caddy, or add certbot to the host. Point DNS at the VPS first. Then:
- Set `SESSION_COOKIE_SECURE=true` and `SITE_ORIGIN=https://DOMAIN`.
- Run `docker compose up -d --build`.
- Open port 443.
- Decide with the user whether Basic Auth stays.
