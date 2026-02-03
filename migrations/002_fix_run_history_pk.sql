ALTER TABLE run_history DROP CONSTRAINT IF EXISTS run_history_pkey;
ALTER TABLE run_history ADD PRIMARY KEY (run_pk, step, ts);

DO $$
BEGIN
  PERFORM create_hypertable('run_history', 'ts', if_not_exists => TRUE);
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'create_hypertable not available, skipping';
END $$;
