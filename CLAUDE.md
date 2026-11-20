# fost-beat

Embeds and tools for the FOSTBeat blog, served from GitHub Pages (`main`). Projects here are static pages and
n8n workflows; none runs on a server today.

## Server projects: Coolify

Any server project (here or in other Platformable repositories, such as `platformable/FOSTBeat-me`) is deployed
with **Coolify** on Platformable's OVHcloud VPS:

- Settings and secrets are Coolify environment variables (the resource's Environment Variables tab). Never tell
  anyone to edit a `.env` file on the server over SSH, and never commit real values.
- After changing a setting, press **Redeploy**; a plain Restart does not pick up new values.
- Code reaches the server by merging to `main`: Coolify deploys automatically (or with its Deploy button). Do not
  write `git pull` or `docker compose up` steps for production.
- HTTPS comes from Coolify's proxy, and backups from Coolify, not Caddy or host crontabs.
