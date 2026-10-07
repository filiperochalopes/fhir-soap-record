import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = new URL("..", import.meta.url).pathname;

test("cutover stops the configured V1 containers before starting migration services", () => {
  const directory = mkdtempSync(join(tmpdir(), "soap-ehr-cutover-test-"));
  const dockerLog = join(directory, "docker.log");
  const dockerPath = join(directory, "docker");
  const backupDirectory = join(directory, "backups");

  writeFileSync(
    dockerPath,
    `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$DOCKER_LOG"
case "$*" in
  "container inspect"*) printf '%s\n' true ;;
  *soap-ehr-db-legacy*) printf '%s\n' '-- MySQL dump' ;;
  *soap-ehr-db*) printf '%s\n' '-- PostgreSQL database dump' ;;
esac
`,
  );
  chmodSync(dockerPath, 0o755);

  try {
    const result = spawnSync("sh", ["scripts/migrate-mysql-to-postgres.sh"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DOCKER_LOG: dockerLog,
        LEGACY_APP_CONTAINER: "fhir-soap-record",
        LEGACY_DB_CONTAINER: "fhir-soap-record-db",
        MIGRATION_BACKUP_DIR: backupDirectory,
        PATH: `${directory}:${process.env.PATH}`,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    const dockerCalls = readFileSync(dockerLog, "utf8").trim().split("\n");
    const appStop = dockerCalls.indexOf("stop fhir-soap-record");
    const databaseStop = dockerCalls.indexOf("stop fhir-soap-record-db");
    const legacyStart = dockerCalls.findIndex((call) =>
      call.includes("up -d soap-ehr-db-legacy soap-ehr-db-legacy-init"),
    );

    assert.notEqual(appStop, -1);
    assert.notEqual(databaseStop, -1);
    assert.notEqual(legacyStart, -1);
    assert.ok(appStop < legacyStart);
    assert.ok(databaseStop < legacyStart);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
