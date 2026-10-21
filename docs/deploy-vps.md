# VPS test deployment with Docker (reached by IP)

**Audience:** an AI agent with root (or sudo) shell access to a fresh Ubuntu 22.04 or 24.04 VPS.
**Goal:** run the whole Enrichment stack with Docker Compose so the internal team can test it at `http://<VPS_IP>/`. There's no domain or HTTPS yet.
**Out of scope:** domains, TLS, CI, backups and scaling. Don't add them unless the user asks.

Read the whole guide first, then work through the steps in order. Each step ends with a **Check**; don't move on until it passes.

---

## 0. Rules for the agent

1. **Secrets.** Never print, `cat`, echo or log API keys, the Postgres password or `RESEARCH_KEY_ENCRYPTION_SECRET`, and never paste them into chat. Write them into `.env` and confirm only "set" or "empty".
2. **ASK** the user whenever this guide says ASK. Don't invent values.
3. **The app has open sign-up and no extra login in front of it.** Anyone who reaches it can create an account and spend the OpenAI, LeadOcean and Serper credits; the user has accepted this for internal testing. Only nginx may publish a port: never add `ports:` to postgres, redis, backend or frontend.
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
| Team IPs (optional) | provider firewall | Only if port 80 should be limited to the team. |

---

## 1. What runs

```
Browser ── http://VPS_IP/
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
  `git archive` packs only committed files, so `.env` is never included. Then, on the VPS:
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

## 4. Access

There's no nginx login: testers go straight to the app's own sign-up page. Nothing to do in this step.

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
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/                                   # 200 (login page)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/api/auth/session   # 401 = frontend→backend proxy works
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

1. Open `http://VPS_IP/`. The app's login page appears.
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
- The URL.
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
| Browser shows 502 | The frontend isn't ready yet or crashed | `docker compose ps` and `docker compose logs frontend`. |
| The page loads, but every action fails and `/api/...` returns 500 or 502 | The backend is down, or the frontend was built with the wrong `BACKEND_URL` | Check `docker compose logs backend`, then rebuild the frontend with `docker compose up -d --build frontend`. |
| Logged in, but a reload goes back to login | `SESSION_COOKIE_SECURE=true` over HTTP | Set it to `false`, then `docker compose up -d backend`. |
| Upload fails with 413 | nginx body limit | Raise `client_max_body_size` in `deploy/nginx/default.conf`, then `docker compose restart nginx`. The backend's own limit is 50 MB. |
| The frontend build is killed | Out of memory | Add swap (step 2) and rebuild. |
| Port 80 already in use | A host nginx or apache is running, often serving other live sites | **Never stop, disable or edit it.** Set `HTTP_PORT=8080` and `SITE_ORIGIN=http://VPS_IP:8080`, run `docker compose up -d --build`, and allow 8080 in the provider firewall. |
| Lead Lookup says "Lead lookup is not configured" | `LEADOCEAN_API_KEY` is empty | Set it, then `docker compose up -d backend`. |
| LeadOcean 429s in the backend log | Too many requests in flight | Lower `LEADOCEAN_MAXIMUM_CONCURRENT_REQUESTS`. |

---

## Serving on a domain through an existing host nginx

Use this when the VPS already runs nginx on the host with the domain's TLS certificate, for example a certbot-managed `app.teamgrowthinfi.com`. The host nginx terminates HTTPS and forwards to the Docker nginx, which listens only on localhost.

```
Browser ─ https://DOMAIN ─► host nginx :443 (existing cert) ─► 127.0.0.1:8080 Docker nginx ─► frontend ─► backend
```

1. **Look first; change nothing yet.** Find the host server block for the domain and back up the whole nginx config:
   ```bash
   grep -rln "server_name[^;]*DOMAIN" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
   cp -a /etc/nginx /root/nginx-backup-$(date +%F-%H%M)
   ```
   Show the user the block's `listen`, `ssl_certificate` and `location` lines. Never print private-key contents. Also list whatever the old `proxy_pass` targets were: their ports, and the processes behind them (`ss -ltnp`). **Don't stop those processes**; ASK the user.

2. **Bind the Docker stack to localhost.** In `/opt/enrichment/.env`:
   ```
   HTTP_BIND=127.0.0.1
   HTTP_PORT=8080
   SITE_ORIGIN=https://DOMAIN
   SESSION_COOKIE_SECURE=true
   ```
   Then run `docker compose up -d --build`. `SITE_ORIGIN` is fixed into the frontend build, so the rebuild is required.

   **Check:** `ss -ltnp | grep 8080` shows `127.0.0.1:8080` only, and `curl -sI http://127.0.0.1:8080/ | head -1` returns `200`.

3. **Point the domain's HTTPS server block at the stack.** In that block (the one with `listen 443 ssl`), keep the `server_name`, `listen` and `ssl_*`/certbot lines exactly as they are. Replace its `location` blocks (and any `root`/`index` lines) with:
   ```nginx
       client_max_body_size 60m;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto https;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_read_timeout 300s;
           proxy_send_timeout 300s;
       }
   ```
   Don't touch the domain's port-80 block (the certbot redirect to HTTPS), or any other domain's block.

   Then run `nginx -t && systemctl reload nginx`. Use **reload**, not restart or stop. If `nginx -t` fails, restore the file from the backup and tell the user.

4. **Close the direct port.** Run `ufw delete allow 8080/tcp`; the stack is now reached only through the domain.

5. **Check:**
   - `curl -sI https://DOMAIN/ | head -1` returns `200` (the app's login page).
   - `http://DOMAIN/` still redirects to HTTPS.
   - Every other domain the host nginx serves still answers as before.
   - Run the section 7 acceptance test on `https://DOMAIN/`, including a reload to confirm the secure cookie sticks.

6. **Certificate renewal** keeps working through certbot's timer, because the `ssl_*` lines were left untouched. Run `certbot renew --dry-run` to confirm.

**To roll back:** restore the server block from `/root/nginx-backup-…`, run `nginx -t && systemctl reload nginx`, and set `HTTP_BIND=0.0.0.0` again if the IP-and-port setup is wanted.
