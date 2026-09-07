CREATE SCHEMA IF NOT EXISTS soap_ehr_etl;

CREATE SEQUENCE IF NOT EXISTS soap_ehr_etl.note_id_seq AS integer START WITH 1;

CREATE TABLE IF NOT EXISTS soap_ehr_etl.source_key_map (
  source_table varchar(64) NOT NULL,
  source_id varchar(255) NOT NULL,
  target_table varchar(64) NOT NULL,
  target_id integer NOT NULL,
  source_hash char(64) NOT NULL,
  transformed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, source_id, target_table),
  UNIQUE (target_table, target_id)
);

CREATE TABLE IF NOT EXISTS soap_ehr_etl.person_alias (
  source_patient_id integer PRIMARY KEY,
  canonical_patient_id integer NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS soap_ehr_etl.etl_run (
  run_id uuid PRIMARY KEY,
  status varchar(20) NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  source_snapshot_at timestamptz NOT NULL,
  statistics jsonb NULL,
  error_message text NULL
);

CREATE TABLE IF NOT EXISTS soap_ehr_etl.schema_version (
  component varchar(64) PRIMARY KEY,
  version varchar(64) NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO soap_ehr_etl.schema_version (component, version)
VALUES
  ('omop-cdm', '5.4.2'),
  ('soap-ehr-etl', '1')
ON CONFLICT (component) DO UPDATE SET version = EXCLUDED.version;
