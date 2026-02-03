CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS timescaledb;
EXCEPTION
  WHEN undefined_file THEN
    RAISE NOTICE 'timescaledb not installed, skipping';
END $$;

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text UNIQUE NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  disabled boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (entity_id, name)
);

CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  storage_id text NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  display_name text,
  state text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  config_json jsonb,
  summary_json jsonb,
  tags text[],
  notes text,
  host text,
  program text,
  git_remote text,
  git_commit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, run_id)
);

CREATE INDEX IF NOT EXISTS runs_project_started_idx ON runs (project_id, started_at DESC);

CREATE TABLE IF NOT EXISTS run_history (
  run_pk uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step integer NOT NULL,
  ts timestamptz NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (run_pk, step)
);

DO $$
BEGIN
  PERFORM create_hypertable('run_history', 'ts', if_not_exists => TRUE);
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'create_hypertable not available, skipping';
END $$;

CREATE TABLE IF NOT EXISTS run_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_pk uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_key text,
  size bigint,
  digest text,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_pk, name)
);

CREATE TABLE IF NOT EXISTS filestream_cursors (
  run_pk uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  filename text NOT NULL,
  last_offset integer NOT NULL DEFAULT 0,
  line_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (run_pk, filename)
);

CREATE TABLE IF NOT EXISTS graphql_unknown_ops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seen_at timestamptz NOT NULL DEFAULT now(),
  api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  query text NOT NULL,
  variables jsonb,
  query_hash text NOT NULL
);
