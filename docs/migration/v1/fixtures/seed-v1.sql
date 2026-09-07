-- Synthetic V1 fixture used only to exercise the V1 -> V2 converter.
-- The fixed high IDs and upserts make this safe to run repeatedly in a dedicated test database.
START TRANSACTION;

INSERT INTO `AuthUser` (`id`, `full_name`, `crm`, `crm_uf`, `is_active`, `created_at`, `updated_at`)
VALUES (1001, 'Dra. Ada Exemplo', 'SYNTHETIC', 'BA', TRUE, '2026-01-10 09:00:00.000', '2026-01-10 09:00:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `AuthToken` (`id`, `token_hash`, `is_active`, `last_used_at`, `created_at`, `updated_at`, `revoked_at`, `user_id`)
VALUES (1001, REPEAT('c', 64), TRUE, '2026-02-20 11:00:00.000', '2026-01-10 09:01:00.000', '2026-02-20 11:00:00.000', NULL, 1001)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `GeneralSetting` (`id`, `property`, `value`, `created_at`, `updated_at`)
VALUES (1001, 'synthetic.fixture.enabled', 'true', '2026-01-10 09:02:00.000', '2026-01-10 09:02:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `Patient` (`id`, `name`, `gender`, `birth_date`, `is_draft`, `active`, `merged_into_patient_id`, `created_at`, `updated_at`)
VALUES
  (1001, 'Paciente Sintético Um', 'female', '1984-03-15', FALSE, TRUE, NULL, '2026-01-10 09:05:00.000', '2026-01-10 09:05:00.000'),
  (1002, 'Cadastro Sintético Duplicado', 'unknown', NULL, TRUE, FALSE, 1001, '2026-01-10 09:06:00.000', '2026-01-10 09:07:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `Identifier` (`id`, `system`, `value`, `patient_id`, `created_at`, `updated_at`)
VALUES (1001, 'urn:soap-ehr:synthetic:patient', 'SYN-1001', 1001, '2026-01-10 09:05:00.000', '2026-01-10 09:05:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `ContactPoint` (`id`, `system`, `value`, `patient_id`, `created_at`, `updated_at`)
VALUES (1001, 'phone', '+55 71 0000-0000', 1001, '2026-01-10 09:05:00.000', '2026-01-10 09:05:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `Contact` (`id`, `name`, `relationship`, `patient_id`, `created_at`, `updated_at`)
VALUES (1001, 'Contato Sintético', 'family', 1001, '2026-01-10 09:05:00.000', '2026-01-10 09:05:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `Appointment` (`id`, `patient_id`, `start`, `end`, `status`, `appointment_type`, `created_at`, `updated_at`)
VALUES (1001, 1001, '2026-02-01 13:00:00.000', '2026-02-01 13:30:00.000', 'fulfilled', 'Consulta sintética', '2026-01-20 10:00:00.000', '2026-02-01 13:30:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `EncounterDraft` (`id`, `patient_id`, `author_user_id`, `appointment_id`, `draft_key`, `note_type`, `status`, `expires_at`, `created_at`, `updated_at`)
VALUES (1001, 1001, 1001, 1001, 'synthetic-draft-1001', 'soap', 'active', '2026-03-01 13:00:00.000', '2026-02-01 12:50:00.000', '2026-02-01 12:55:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `SoapNote` (`id`, `patient_id`, `author_user_id`, `appointment_id`, `encountered_at`, `subjective`, `objective`, `assessment`, `plan`, `source_system`, `source_record_id`, `created_at`, `updated_at`)
VALUES
  (1001, 1001, 1001, 1001, '2026-02-01 13:05:00.000', 'Relata cefaleia leve há dois dias.', 'PA 120/80 mmHg; sem sinais de alarme.', 'Cefaleia inespecífica, sem sinais de gravidade.', 'Orientações gerais e retorno se houver piora.', NULL, NULL, '2026-02-01 13:25:00.000', '2026-02-01 13:25:00.000'),
  (1002, 1001, 1001, NULL, '2026-02-15 14:00:00.000', 'Refere melhora completa.', 'Bom estado geral.', 'Evolução favorável.', 'Seguimento conforme necessidade.', 'synthetic-import', 'soap-external-1', '2026-02-15 14:20:00.000', '2026-02-15 14:20:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `NarrativeNote` (`id`, `patient_id`, `author_user_id`, `encountered_at`, `title`, `sections`, `source_system`, `source_record_id`, `created_at`, `updated_at`)
VALUES (1001, 1001, 1001, '2026-02-20 10:00:00.000', 'Retorno narrativo', JSON_ARRAY(JSON_OBJECT('title', 'Evolução', 'text', 'Paciente permanece assintética no retorno sintético.')), NULL, NULL, '2026-02-20 10:15:00.000', '2026-02-20 10:15:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `ClinicalAttachment` (`id`, `patient_id`, `author_user_id`, `draft_id`, `appointment_id`, `soap_note_id`, `narrative_note_id`, `status`, `file_name`, `content_type`, `byte_size`, `sha256`, `s3_bucket`, `s3_key`, `created_at`, `updated_at`)
VALUES
  (1001, 1001, 1001, NULL, 1001, 1001, NULL, 'attached', 'exame-sintetico.txt', 'text/plain', 27, REPEAT('a', 64), 'synthetic-fixture', 'patients/1001/exame-sintetico.txt', '2026-02-01 13:10:00.000', '2026-02-01 13:25:00.000'),
  (1002, 1001, 1001, NULL, NULL, NULL, 1001, 'attached', 'narrativa-sintetica.txt', 'text/plain', 31, REPEAT('b', 64), 'synthetic-fixture', 'patients/1001/narrativa-sintetica.txt', '2026-02-20 10:05:00.000', '2026-02-20 10:15:00.000'),
  (1003, 1001, 1001, 1001, 1001, NULL, NULL, 'draft', 'rascunho-sintetico.txt', 'text/plain', 18, REPEAT('d', 64), 'synthetic-fixture', 'drafts/1001/rascunho-sintetico.txt', '2026-02-01 12:52:00.000', '2026-02-01 12:52:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `AttachmentPluginExecution` (`id`, `attachment_id`, `plugin_id`, `requested_by_user_id`, `external_job_id`, `status`, `summary`, `result`, `error`, `completed_at`, `created_at`, `updated_at`)
VALUES (1001, 1001, 'synthetic-plugin', 1001, 'job-synthetic-1001', 'completed', 'Resultado sintético', JSON_OBJECT('ok', TRUE), NULL, '2026-02-01 13:24:00.000', '2026-02-01 13:20:00.000', '2026-02-01 13:24:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `UserPluginCredential` (`id`, `user_id`, `plugin_id`, `encrypted_secret`, `created_at`, `updated_at`)
VALUES (1001, 1001, 'synthetic-plugin', 'synthetic-encrypted-secret-not-valid-for-runtime', '2026-01-10 09:03:00.000', '2026-01-10 09:03:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `ClinicalDocumentWebhookEvent` (`id`, `patient_id`, `author_user_id`, `state`, `document_type`, `clinical_note`, `payload`, `consumed_at`, `created_at`, `updated_at`)
VALUES (1001, 1001, 1001, 'synthetic-webhook-state-1001', 'synthetic-report', 'Documento sintético para validar migração.', JSON_OBJECT('fixture', TRUE, 'version', 1), '2026-02-20 12:05:00.000', '2026-02-20 12:00:00.000', '2026-02-20 12:05:00.000')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `AuditLog` (`id`, `category`, `action`, `entity_type`, `entity_id`, `metadata`, `created_at`, `user_id`)
VALUES (1001, 'soap', 'soap.created', 'SoapNote', '1001', JSON_OBJECT('fixture', TRUE), '2026-02-01 13:25:00.000', 1001)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

COMMIT;
