# Trainlog

Trainlog is a minimal W&B-compatible experiment tracker. It implements the key ingestion endpoints (`/graphql`, `/files/.../file_stream`, `/storage`) plus a Next.js UI for browsing runs.

## Quick start

```bash
bun install
export DATABASE_URL="postgres://user:pass@localhost:5432/trainlog"
bun run migrate
bun run dev
```

Point the W&B SDK at your host:

```bash
export WANDB_BASE_URL="http://localhost:3000"
export WANDB_API_KEY="your-key"
```

## What works

- `wandb.init()` create/resume
- `wandb.log()` history ingestion
- summary/config updates
- file uploads via `/storage`
- basic run list + run detail UI

## Notes

- TimescaleDB is optional. The migration will skip `create_hypertable` if the extension is missing.
- Files are stored on disk under `storage/` by default. Set `STORAGE_ROOT` to override.

## Ops

See `ops/trainlog.service` and `ops/nginx-trainlog.conf` for sample service + reverse-proxy configuration.
