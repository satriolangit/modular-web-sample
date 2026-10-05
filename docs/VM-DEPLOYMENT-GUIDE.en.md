# VM Deployment Guide (Linux) — Production Runtime

**Version**: 0.1.0
**Audience**: DevOps / infrastructure engineers running ARSI client images on Linux VMs
**Related**: `DEPLOYMENT-GUIDE.en.md` (image build, tagging, CI), `ARCHITECTURE.en.md` §16–17, `CONTRACT.en.md`, `ZERO-TO-DEPLOY-GUIDE.en.md` (clone → deploy walkthrough)
**Scope**: Running **already-built** client images (`<org>/arsi-web-<client>:<tag>`) on a Linux VM with Docker, a host reverse proxy, TLS, updates, and rollback. Building images is covered in `DEPLOYMENT-GUIDE.en.md`.

> This document is English-only by request. The build/CI guide has an Indonesian pair (`DEPLOYMENT-GUIDE.md`).

---

## Table of Contents

1. [Architecture on a VM](#1-architecture-on-a-vm)
2. [VM Requirements](#2-vm-requirements)
3. [VM Preparation](#3-vm-preparation)
4. [Install Docker Engine](#4-install-docker-engine)
5. [Registry Access (Docker Hub)](#5-registry-access-docker-hub)
6. [Deployment Directory Layout](#6-deployment-directory-layout)
7. [Runtime Configuration](#7-runtime-configuration)
8. [First Deploy](#8-first-deploy)
9. [Reverse Proxy and TLS](#9-reverse-proxy-and-tls)
10. [Firewall](#10-firewall)
11. [Updates and Rollback](#11-updates-and-rollback)
12. [Multiple Clients on One VM](#12-multiple-clients-on-one-vm)
13. [Operations: Logs, Health, Disk](#13-operations-logs-health-disk)
14. [Automating Deploys from CI](#14-automating-deploys-from-ci)
15. [Smoke Test Checklist](#15-smoke-test-checklist)
16. [Troubleshooting](#16-troubleshooting)
17. [Security Checklist](#17-security-checklist)
18. [Appendix A — Full Example Files](#18-appendix-a--full-example-files)
19. [Appendix B — Command Cheat Sheet](#19-appendix-b--command-cheat-sheet)

---

## 1. Architecture on a VM

Each client gets one immutable Docker image that already contains nginx + the client SPA. The VM only runs that image and terminates TLS in front of it.

```
Internet
   │  HTTPS 443
   ▼
┌──────────────────────────── Linux VM ────────────────────────────┐
│                                                                  │
│  nginx / Caddy (host)          Docker Engine                     │
│  ┌────────────────────┐        ┌──────────────────────────────┐  │
│  │ app.example.com    │        │ container: arsi-web-client-a  │  │
│  │ TLS (Let's Encrypt)│───────►│ nginx:80                     │  │
│  │ proxy → 127.0.0.1  │ :8080  │  /usr/share/nginx/html       │  │
│  └────────────────────┘        │  /config.json (from env)     │  │
│                                └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

Principles:

- **One client image per VM is the recommended default** — strong isolation, simple rollback, no shared failure domain. Multi-client on one VM is possible (§12) but shares the Docker daemon.
- **The image is immutable and environment-agnostic** — the same tag used in staging is deployed to production; only `VITE_*` environment variables differ.
- **Config is generated at container start** — `entrypoint.sh` writes `/config.json` from env. Changing config does **not** require a new image.
- **TLS is terminated on the host** — the container only serves HTTP on port 80. Publish it to `127.0.0.1` so it is never reachable directly from the internet.
- **No secrets in the image or in `VITE_*`** — `/config.json` is public; treat every value as readable by anyone.

---

## 2. VM Requirements

| Item | Minimum | Recommended |
| --- | --- | --- |
| OS | Ubuntu 22.04/24.04 LTS, Debian 12 | Ubuntu 24.04 LTS |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Disk | 10 GB | 20 GB SSD |
| Docker Engine | 24+ with Compose v2 (`docker compose`) | latest stable |
| Public IP + DNS | — | A record `app.example.com` → VM IP |
| Open ports | 22, 80, 443 | 22 restricted to office/VPN if possible |

What you need from the build pipeline before deploying:

| Value | Example | Source |
| --- | --- | --- |
| Image repository | `docker.io/<org>/arsi-web-client-a` | `DEPLOYMENT-GUIDE.en.md` §7 |
| Immutable tag | `2026.10.03-1` or short SHA | CI build ID / `BUILD_ID` |
| Client name | `client-a` | extension repo `manifest.json:client` |
| Modules to activate | `user-management,product-management,module-sample` | product decision (must exist in the image) |
| API base URL | `https://api.example.com` | backend environment |

---

## 3. VM Preparation

Run everything as a user with `sudo` (a dedicated `deploy` user is recommended).

```bash
# 1. Update the OS
sudo apt-get update && sudo apt-get upgrade -y

# 2. Base packages
sudo apt-get install -y ca-certificates curl gnupg jq ufw

# 3. Timezone and time sync (logs and TLS validity)
sudo timedatectl set-timezone Asia/Jakarta
sudo timedatectl set-ntp true

# 4. Create a deploy user (skip if you already have one)
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /home/deploy/.ssh && sudo chmod 700 /home/deploy/.ssh
# paste the public key from your workstation:
# echo "ssh-ed25519 AAAA... you@workstation" | sudo tee /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo usermod -aG sudo deploy
```

SSH hardening (recommended, do this only after key login works):

```bash
# /etc/ssh/sshd_config.d/99-hardening.conf
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart ssh
```

---

## 4. Install Docker Engine

Official Docker repository (Ubuntu; on Debian replace `ubuntu` with `debian`):

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo usermod -aG docker deploy      # log out/in (or `newgrp docker`) for group to apply

docker version
docker compose version
```

Notes:

- The `docker` group is effectively root-equivalent on the host. On a dedicated single-purpose VM this is the standard trade-off; for stricter isolation use rootless Docker (out of scope).
- Verify the daemon starts at boot: `systemctl is-enabled docker`.

---

## 5. Registry Access (Docker Hub)

Client images may be private. Create a **read-only Docker Hub access token** (Account Settings → Personal access tokens, or an organization deploy token) and log in once on the VM:

```bash
# interactive
docker login docker.io -u <dockerhub-user>

# or non-interactive (token from a secret manager)
echo "<read-only-token>" | docker login docker.io -u <dockerhub-user> --password-stdin
```

Credentials are stored in `~/.docker/config.json` for the user that runs `docker compose` (here: `deploy`). If you run compose via `sudo`, credentials must exist for `root` instead — avoid mixing.

Rules:

- Use a **read-only** token on VMs. Never store a push-capable token on a production VM.
- The VM only pulls the **client image**. The base `-builder` image is a CI-only artifact and should stay private; it is never needed at runtime.
- Rotate the token periodically; after rotation re-run `docker login` and `docker compose pull`.

---

## 6. Deployment Directory Layout

One directory per client, owned by the deploy user:

```
/opt/arsi/client-a/
├── compose.yaml      # service definition (image tag from .env)
├── .env              # environment values (chmod 600)
└── deploy.sh         # optional wrapper (pull + up + verify)
```

```bash
sudo mkdir -p /opt/arsi/client-a
sudo chown deploy:deploy /opt/arsi/client-a
cd /opt/arsi/client-a
```

`chmod 600 .env` — even though `VITE_*` values are public, the file also contains the image tag and may later hold operational values; keep it private by default.

---

## 7. Runtime Configuration

All configuration is injected as environment variables and turned into `/config.json` at container start by the base image entrypoint.

| Env | Default | Required | Purpose |
| --- | --- | --- | --- |
| `VITE_CLIENT` | client image `ENV` (e.g. `client-a`) | No | Client identity in `config.json:client`; used for logging/identity. The client image already bakes its own value. |
| `VITE_MODULES` | `user-management` | **Yes** | Comma-separated modules **activated** at runtime, e.g. `user-management,product-management,module-sample`. Names must match folders under `web-modules/modules/` **in the image**. |
| `VITE_API_BASE` | `https://dummyjson.com` | **Yes** | Base URL for `deps.api` and module services. Point it at the environment's backend. |
| `VITE_ENABLE_AUDIT_LIVE` | `true` | No | Feature flag (`featureFlags.enableAuditLive`). |
| `VITE_CONFIG_JSON` | — | No | **Full `/config.json` override** as a JSON object. When set, all individual `VITE_*` values above are ignored. |

Rules and gotchas:

- **Modules must be bundled in the image.** All modules present in the base repo at build time are bundled as lazy chunks; `VITE_MODULES` only selects which are initialized. A name that is not in the image makes the app fail to boot with `[bootstrap] module "x" is declared in config.modules but has no entry in web-modules/modules`.
- **`/config.json` is public and `no-store`.** Never put tokens or secrets in `VITE_*`.
- **API base and CORS.** If the API is on a different origin than the app, the backend must allow that origin (or serve the API under the same domain/path). Check the browser console for CORS errors after deploy.
- **Changing config** requires recreating the container, not rebuilding the image: `docker compose up -d --force-recreate`.
- The example compose sets `VITE_ENABLE_AUDIT_LIVE` to `false` when unset (production-safe); the image/entrypoint fallback is `true`. Set it explicitly per environment.
- **Full override (`VITE_CONFIG_JSON`)** — for CI-driven config beyond the four variables (extra feature flags, future fields). The value must be a JSON object (starts `{`, ends `}`); otherwise the container **fails to start** with `[entrypoint] VITE_CONFIG_JSON must be a JSON object`. Multiline values are compacted to one line. When set, the individual `VITE_*` values are ignored.

Example `.env`:

```dotenv
IMAGE_TAG=2026.10.03-1
VITE_CLIENT=client-a
VITE_MODULES=user-management,product-management,module-sample
VITE_API_BASE=https://api.example.com
VITE_ENABLE_AUDIT_LIVE=false
```

For CI-driven full config, replace the individual variables with a single JSON value (see the multiline compose form in Appendix A.2):

```dotenv
VITE_CONFIG_JSON={"client":"client-a","modules":["user-management","product-management"],"apiBase":"https://api.example.com","featureFlags":{"enableAuditLive":false}}
```

Example `compose.yaml`:

```yaml
name: arsi-client-a

services:
  web:
    image: docker.io/<org>/arsi-web-client-a:${IMAGE_TAG:?set IMAGE_TAG in .env}
    container_name: arsi-web-client-a
    ports:
      - "127.0.0.1:8080:80"          # never expose 80 directly to the internet
    environment:
      VITE_CLIENT: ${VITE_CLIENT}
      VITE_MODULES: ${VITE_MODULES:?set VITE_MODULES in .env}
      VITE_API_BASE: ${VITE_API_BASE:?set VITE_API_BASE in .env}
      VITE_ENABLE_AUDIT_LIVE: ${VITE_ENABLE_AUDIT_LIVE:-false}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    security_opt:
      - no-new-privileges:true
```

Why these choices:

- `ports: 127.0.0.1:8080:80` — Docker publishes ports bypassing `ufw`; binding to loopback means the only public entry point is the host proxy.
- `restart: unless-stopped` — the container comes back automatically after a VM reboot (the Docker daemon restarts it).
- `healthcheck` — uses busybox `wget` shipped in `nginx:alpine`; surfaces container health in `docker compose ps`.
- `logging` limits — prevents unbounded `json-file` logs from filling the disk.
- `no-new-privileges` — cheap hardening; the nginx master still runs as root inside the container (image behavior).

---

## 8. First Deploy

```bash
cd /opt/arsi/client-a

# 1. Create compose.yaml and .env (files from §7 / Appendix A)
nano compose.yaml
nano .env && chmod 600 .env

# 2. Authenticate (private images only)
docker login docker.io -u <dockerhub-user>

# 3. Pull and start
docker compose pull
docker compose up -d

# 4. Status and health
docker compose ps                       # State: running, Health: healthy

# 5. Config check (client + modules + apiBase must match .env)
curl -s http://127.0.0.1:8080/config.json | jq .

# 6. Entrypoint log
docker logs arsi-web-client-a 2>&1 | grep Generated
```

Expected `/config.json`:

```json
{
  "client": "client-a",
  "modules": ["user-management", "product-management", "module-sample"],
  "apiBase": "https://api.example.com",
  "featureFlags": {
    "enableAuditLive": false
  }
}
```

If you do not have DNS/TLS yet, verify with the loopback URL first, then continue to §9.

---

## 9. Reverse Proxy and TLS

Pick **one** of the two options. Both terminate TLS on the host and proxy to `127.0.0.1:8080`.

### Option A — nginx + Certbot (recommended if nginx is already standard in your stack)

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/arsi-client-a`:

```nginx
server {
    listen 80;
    server_name app.example.com;

    # Security headers (HSTS is added by certbot only after TLS works)
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/arsi-client-a /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# DNS must already point app.example.com → this VM, and port 80 must be reachable
sudo certbot --nginx -d app.example.com --redirect --agree-tos -m ops@example.com
```

Certbot installs a systemd timer that renews certificates automatically. Verify:

```bash
systemctl list-timers | grep certbot
curl -sI https://app.example.com/ | head -1
```

Notes:

- The container already sends `Cache-Control: public, immutable` for `/assets/` and `no-store` for `/config.json`; nginx proxies those headers through unchanged. Do not add conflicting cache rules.
- The SPA needs no extra rewrite at the proxy: the container's nginx already falls back to `index.html` for deep links.
- Add HSTS (`Strict-Transport-Security`) only after HTTPS is confirmed working, to avoid locking clients out.

### Option B — Caddy (automatic HTTPS)

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

`/etc/caddy/Caddyfile`:

```caddyfile
app.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy obtains and renews certificates automatically; DNS and ports 80/443 must be reachable.

### DNS

| Record | Value |
| --- | --- |
| `A` | `app.example.com` → VM public IP |
| `AAAA` | optional, only if the VM has IPv6 |

Without a domain you can deploy behind an internal load balancer or use a self-signed certificate for testing (browsers will warn).

---

## 10. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Two important details:

1. **Docker publishes ports below `ufw`.** Binding the container to `127.0.0.1` (§7) is what actually prevents direct public access. Never publish `0.0.0.0:8080`.
2. Restrict SSH to known networks when possible (`ufw allow from <office-cidr> to any port 22 proto tcp`).

---

## 11. Updates and Rollback

### Deploy a new image tag

```bash
cd /opt/arsi/client-a

# 1. Set the new immutable tag (from CI output)
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=2026.10.10-2/' .env

# 2. Pull and recreate
docker compose pull
docker compose up -d

# 3. Verify
docker compose ps
curl -sf http://127.0.0.1:8080/config.json | jq -e '.client and .modules and .apiBase'
docker logs arsi-web-client-a 2>&1 | grep Generated
```

A single-replica container is recreated in place, so expect a **brief blip** (seconds) while nginx restarts. If strict zero downtime is required, run two containers behind the proxy and switch upstreams after the new one is healthy (keep the old container until the switch).

### Change configuration only (no new image)

```bash
nano .env                        # edit VITE_MODULES / VITE_API_BASE / flag
docker compose up -d --force-recreate
curl -s http://127.0.0.1:8080/config.json | jq .
```

### Rollback

Rollback = deploy the previous tag. Always keep the last known-good tag recorded.

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<previous-good-tag>/' .env
docker compose pull
docker compose up -d
docker compose ps
```

Do not reuse or retag old base/client versions to new numbers; deploy the original immutable tag.

---

## 12. Multiple Clients on One VM

Recommended only for non-production or low-risk clients. Production default is one client per VM.

Rules when sharing a VM:

- One directory and one Compose project per client (`/opt/arsi/<client>`), each with a unique `name:` in `compose.yaml`.
- Unique host port per client: `127.0.0.1:8081:80`, `127.0.0.1:8082:80`, …
- Unique hostname per client: `app-a.example.com`, `app-b.example.com` → separate proxy server blocks.
- Budget ~50–100 MB RAM per idle nginx container plus OS/proxy overhead.

```
/opt/arsi/
├── client-a/   compose.yaml (name: arsi-client-a, 127.0.0.1:8081:80)
├── client-b/   compose.yaml (name: arsi-client-b, 127.0.0.1:8082:80)
└── client-c/   compose.yaml (name: arsi-client-c, 127.0.0.1:8083:80)
```

All clients share the Docker daemon and host kernel — a crash or resource exhaustion in one image can affect the others. Use per-service memory limits if needed:

```yaml
    deploy:
      resources:
        limits:
          memory: 256M
```

---

## 13. Operations: Logs, Health, Disk

### Logs

```bash
cd /opt/arsi/client-a
docker compose logs -f --tail=100          # follow app logs
docker logs arsi-web-client-a 2>&1 | grep Generated
journalctl -u nginx -f                     # Option A proxy
journalctl -u caddy -f                     # Option B proxy
```

The compose `logging` block caps `json-file` logs at 3 × 10 MB per container. For centralized logging, add a log shipper or switch the driver (out of scope).

### Health

```bash
docker compose ps
docker inspect --format '{{.State.Health.Status}}' arsi-web-client-a
curl -sf http://127.0.0.1:8080/config.json >/dev/null && echo OK
```

Add an external uptime check against `https://app.example.com/config.json` (expects HTTP 200 with JSON) and alert on two consecutive failures.

### Disk

```bash
df -h /
docker system df
docker image prune -a --filter "until=168h"   # remove unused images older than 7 days
```

`docker image prune -a` removes every image not used by a running container — the deployed image is in use, so it is safe. Run it from cron if disk pressure is a concern.

### Reboot behavior

`restart: unless-stopped` + `systemctl enable docker` is enough: after a VM reboot the container starts automatically. Optionally manage the compose project with systemd (Appendix A.4) if you prefer explicit service control.

---

## 14. Automating Deploys from CI

The pipeline (see `DEPLOYMENT-GUIDE.en.md` §8) builds and pushes the image. Deployment can stay manual (§11) or be automated with an SSH step that only updates `.env` and recreates the container.

```bash
# On the CI runner, after a successful push:
ssh deploy@app.example.com "
  cd /opt/arsi/client-a &&
  sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=${BUILD_ID}/' .env &&
  docker compose pull &&
  docker compose up -d &&
  docker compose ps
"
```

Guidelines:

- Use a dedicated SSH key restricted to the deploy user (and, if available, to a forced command).
- Never put registry push credentials on the VM; only a read-only pull token.
- Keep the rollback tag in the deploy log for every release.

---

## 15. Smoke Test Checklist

```bash
BASE=https://app.example.com

# 1. Config matches the environment
curl -sf "$BASE/config.json" | jq -e '.client and .modules and .apiBase'

# 2. Main page 200
curl -sI "$BASE/" | head -1

# 3. SPA deep link falls back to index.html
curl -s "$BASE/products/1" | grep -q '<div id="root">'

# 4. Immutable asset caching
curl -sI "$BASE/assets/$(curl -s "$BASE/" | grep -o 'assets/index-[^"]*\.js' | head -1 | cut -d/ -f2)" \
  | grep -i 'cache-control: public, immutable'

# 5. config.json is not cached
curl -sI "$BASE/config.json" | grep -i 'cache-control: no-store'

# 6. TLS certificate valid
echo | openssl s_client -connect app.example.com:443 -servername app.example.com 2>/dev/null \
  | openssl x509 -noout -subject -dates
```

Manual checklist:

- [ ] Login and every module route listed in `VITE_MODULES` renders.
- [ ] Theme and locale toggles work.
- [ ] Deep links do not 404.
- [ ] API calls succeed (no CORS/4xx/5xx in the browser console).
- [ ] `config.json` in the browser is fresh after a config change.
- [ ] Container `Health: healthy` and `restart: unless-stopped` set.
- [ ] Uptime check configured against `/config.json`.
- [ ] Rollback tag recorded.

---

## 16. Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| `docker compose pull` → `unauthorized` / `pull access denied` | Private image and no/expired login. `docker login docker.io` with a read-only token as the same user running compose. |
| `502 Bad Gateway` from the proxy | Container down or wrong port. `docker compose ps`, `curl -s http://127.0.0.1:8080/`; check the `ports` mapping. |
| Site reachable on the VM but not from the internet | DNS not pointing to the VM, or `ufw` missing 80/443. `dig app.example.com`, `sudo ufw status`. |
| `bind: address already in use` on `docker compose up` | Host port conflict. `ss -ltnp \| grep 8080`, choose another port, update the proxy upstream. |
| App boots but shows `[bootstrap] module "x" … has no entry` | `VITE_MODULES` includes a name that is not bundled in the image. Fix `.env` or rebuild the image with that module in the base. |
| Config changes not visible | Container not recreated, or browser cache. `docker compose up -d --force-recreate`, hard-refresh; `/config.json` is `no-store`. |
| Container exits with `[entrypoint] VITE_CONFIG_JSON must be a JSON object` | The `VITE_CONFIG_JSON` value is not a JSON object (truncated, array, misquoted). Fix it, or unset it to use the individual `VITE_*` variables. |
| App boots with no modules after a full override | The JSON is valid but `modules` is empty/missing. Add the bundled module names; verify with `curl /config.json`. |
| API calls fail with CORS errors | `VITE_API_BASE` origin differs from the app origin and the backend does not allow it. Fix CORS or serve the API under the same domain. |
| Certbot fails validation | DNS not propagated, port 80 blocked, or another server block answers for the domain. Fix DNS/`ufw`, then re-run `certbot --nginx`. |
| HTTPS works but old HTTP bookmarks break | Enable the redirect (`certbot --nginx --redirect`) or add `return 301 https://$host$request_uri;`. |
| Container restarts in a loop | Check `docker logs arsi-web-client-a`; usually a bad `.env` value or an image that does not match the expected client. |
| App down after VM reboot | Docker daemon not enabled or `restart` policy missing. `systemctl is-enabled docker`, verify `restart: unless-stopped`. |
| Disk full | Unbounded logs/images. Check `docker system df`, verify compose log limits, prune old images (§13). |
| `curl /config.json` returns HTML | Proxy is routing `/config.json` to a catch-all site or SPA; check `server_name`/`proxy_pass` and remove default sites. |

---

## 17. Security Checklist

- [ ] SSH: key-only auth, root login disabled, port 22 restricted if possible.
- [ ] `ufw` enabled with only 22/80/443 open.
- [ ] Container published to `127.0.0.1` only; no `0.0.0.0` port bindings.
- [ ] Docker Hub token on the VM is **read-only**; push tokens live only in CI.
- [ ] `.env` is `chmod 600`, owned by the deploy user.
- [ ] No secrets in `VITE_*` (everything ends up in public `/config.json`).
- [ ] TLS from Let's Encrypt with auto-renewal verified (`systemctl list-timers | grep certbot`).
- [ ] Security headers set at the proxy (nosniff, frame options, referrer policy, HSTS after HTTPS is stable).
- [ ] Image tags are immutable; no `latest` in production.
- [ ] Image scanned before promotion (Docker Hub scanning / Trivy) — see `DEPLOYMENT-GUIDE.en.md` §12.
- [ ] Deploy log records image tag, base version, env values, and rollback tag per release.
- [ ] Host patched (`unattended-upgrades` or a maintenance schedule) and rebooted regularly.
- [ ] Optional: `no-new-privileges:true` on the service (already in the example compose).

---

## 18. Appendix A — Full Example Files

### A.1 `.env`

```dotenv
IMAGE_TAG=2026.10.03-1
VITE_CLIENT=client-a
VITE_MODULES=user-management,product-management,module-sample
VITE_API_BASE=https://api.example.com
VITE_ENABLE_AUDIT_LIVE=false
```

### A.2 `compose.yaml`

```yaml
name: arsi-client-a

services:
  web:
    image: docker.io/<org>/arsi-web-client-a:${IMAGE_TAG:?set IMAGE_TAG in .env}
    container_name: arsi-web-client-a
    ports:
      - "127.0.0.1:8080:80"
    environment:
      VITE_CLIENT: ${VITE_CLIENT}
      VITE_MODULES: ${VITE_MODULES:?set VITE_MODULES in .env}
      VITE_API_BASE: ${VITE_API_BASE:?set VITE_API_BASE in .env}
      VITE_ENABLE_AUDIT_LIVE: ${VITE_ENABLE_AUDIT_LIVE:-false}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    security_opt:
      - no-new-privileges:true
```

Full-override variant (CI-driven config) — replace the `environment:` block of the service above with:

```yaml
    environment:
      VITE_CONFIG_JSON: |
        {"client":"client-a","modules":["user-management","product-management"],"apiBase":"https://api.example.com","featureFlags":{"enableAuditLive":false}}
```

### A.3 Host nginx site (`/etc/nginx/sites-available/arsi-client-a`)

```nginx
server {
    listen 80;
    server_name app.example.com;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

After Certbot runs, it adds the 443 server block and the HTTP → HTTPS redirect.

### A.4 Optional systemd unit for the compose project (`/etc/systemd/system/arsi-client-a.service`)

```ini
[Unit]
Description=ARSI web client-a (docker compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/arsi/client-a
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0
User=deploy
Group=deploy

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now arsi-client-a
sudo systemctl status arsi-client-a
```

Not required when `restart: unless-stopped` is set; useful if you want `systemctl` as the single control surface.

### A.5 Optional `deploy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

NEW_TAG="${1:?usage: ./deploy.sh <image-tag>}"

PREVIOUS_TAG="$(grep -E '^IMAGE_TAG=' .env | cut -d= -f2)"
echo "[deploy] current=${PREVIOUS_TAG} new=${NEW_TAG}"

sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${NEW_TAG}/" .env
docker compose pull
docker compose up -d

for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8080/config.json >/dev/null; then
    echo "[deploy] OK — ${NEW_TAG} is serving"
    echo "[deploy] rollback with: sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=${PREVIOUS_TAG}/' .env && docker compose up -d"
    exit 0
  fi
  sleep 2
done

echo "[deploy] FAILED — rolling back to ${PREVIOUS_TAG}" >&2
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${PREVIOUS_TAG}/" .env
docker compose up -d
exit 1
```

```bash
chmod +x deploy.sh
./deploy.sh 2026.10.10-2
```

---

## 19. Appendix B — Command Cheat Sheet

```bash
# --- install / prepare ---------------------------------------------------
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg jq ufw
# install Docker Engine + compose plugin (see §4)
sudo usermod -aG docker deploy

# --- deploy directory ----------------------------------------------------
sudo mkdir -p /opt/arsi/client-a && sudo chown deploy:deploy /opt/arsi/client-a
cd /opt/arsi/client-a
# create compose.yaml + .env (Appendix A)
chmod 600 .env

# --- first deploy --------------------------------------------------------
docker login docker.io -u <dockerhub-user>
docker compose pull
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:8080/config.json | jq .

# --- proxy + TLS (Option A) ---------------------------------------------
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo ln -s /etc/nginx/sites-available/arsi-client-a /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.example.com --redirect

# --- firewall ------------------------------------------------------------
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable

# --- update / rollback ---------------------------------------------------
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<tag>/' .env && docker compose pull && docker compose up -d
docker compose up -d --force-recreate        # config-only change

# --- operate -------------------------------------------------------------
docker compose logs -f --tail=100
docker inspect --format '{{.State.Health.Status}}' arsi-web-client-a
docker system df && docker image prune -a --filter "until=168h"
```

---

**Document version**: 0.1.0
**Last updated**: 2026-10-03
