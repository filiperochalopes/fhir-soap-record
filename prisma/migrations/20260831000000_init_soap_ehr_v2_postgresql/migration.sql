-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birth_date" DATE,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "merged_into_patient_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patient_id" INTEGER NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPoint" (
    "id" SERIAL NOT NULL,
    "system" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patient_id" INTEGER,

    CONSTRAINT "ContactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identifier" (
    "id" SERIAL NOT NULL,
    "system" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patient_id" INTEGER,

    CONSTRAINT "Identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "appointment_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralSetting" (
    "id" SERIAL NOT NULL,
    "property" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneralSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthUser" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "crm" TEXT NOT NULL,
    "crm_uf" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" SERIAL NOT NULL,
    "token_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EhrRecord" (
    "id" CHAR(36) NOT NULL,
    "system_id" TEXT NOT NULL DEFAULT 'soap-ehr',
    "patient_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EhrRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" CHAR(36) NOT NULL,
    "ehr_id" CHAR(36) NOT NULL,
    "committer_user_id" INTEGER NOT NULL,
    "change_type" TEXT NOT NULL DEFAULT 'creation',
    "description" TEXT,
    "committed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionedComposition" (
    "id" CHAR(36) NOT NULL,
    "ehr_id" CHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionedComposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchetypeDefinition" (
    "id" TEXT NOT NULL,
    "rm_type" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "definition" JSONB NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchetypeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateDefinition" (
    "id" TEXT NOT NULL,
    "root_archetype_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "operational_template" JSONB NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionVersion" (
    "id" CHAR(36) NOT NULL,
    "versioned_composition_id" CHAR(36) NOT NULL,
    "contribution_id" CHAR(36) NOT NULL,
    "preceding_version_id" CHAR(36),
    "template_id" TEXT NOT NULL,
    "archetype_id" TEXT NOT NULL,
    "composer_user_id" INTEGER NOT NULL,
    "appointment_id" INTEGER,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "lifecycle_state" TEXT NOT NULL DEFAULT 'complete',
    "category" TEXT NOT NULL DEFAULT 'event',
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "territory" TEXT NOT NULL DEFAULT 'BR',
    "title" TEXT NOT NULL,
    "encountered_at" TIMESTAMP(3) NOT NULL,
    "content" JSONB NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "fhir_composition_id" TEXT NOT NULL,
    "source_system" TEXT,
    "source_record_id" TEXT,
    "source_metadata" JSONB,
    "committed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompositionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterDraft" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "author_user_id" INTEGER NOT NULL,
    "appointment_id" INTEGER,
    "draft_key" TEXT NOT NULL,
    "note_type" TEXT NOT NULL DEFAULT 'soap',
    "status" TEXT NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncounterDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalAttachment" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "author_user_id" INTEGER NOT NULL,
    "draft_id" INTEGER,
    "appointment_id" INTEGER,
    "composition_version_id" CHAR(36),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "s3_bucket" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentPluginExecution" (
    "id" SERIAL NOT NULL,
    "attachment_id" INTEGER NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "requested_by_user_id" INTEGER NOT NULL,
    "external_job_id" TEXT,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "result" JSONB,
    "error" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttachmentPluginExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPluginCredential" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPluginCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalDocumentWebhookEvent" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "author_user_id" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "clinical_note" TEXT NOT NULL,
    "payload" JSONB,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalDocumentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactPoint_system_value_patient_id_key" ON "ContactPoint"("system", "value", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "Identifier_system_value_key" ON "Identifier"("system", "value");

-- CreateIndex
CREATE UNIQUE INDEX "GeneralSetting_property_key" ON "GeneralSetting"("property");

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_crm_crm_uf_key" ON "AuthUser"("crm", "crm_uf");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_token_hash_key" ON "AuthToken"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "EhrRecord_patient_id_key" ON "EhrRecord"("patient_id");

-- CreateIndex
CREATE INDEX "Contribution_ehr_id_committed_at_idx" ON "Contribution"("ehr_id", "committed_at");

-- CreateIndex
CREATE INDEX "Contribution_committer_user_id_idx" ON "Contribution"("committer_user_id");

-- CreateIndex
CREATE INDEX "VersionedComposition_ehr_id_created_at_idx" ON "VersionedComposition"("ehr_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionVersion_fhir_composition_id_key" ON "CompositionVersion"("fhir_composition_id");

-- CreateIndex
CREATE INDEX "CompositionVersion_composer_user_id_idx" ON "CompositionVersion"("composer_user_id");

-- CreateIndex
CREATE INDEX "CompositionVersion_appointment_id_idx" ON "CompositionVersion"("appointment_id");

-- CreateIndex
CREATE INDEX "CompositionVersion_template_id_encountered_at_idx" ON "CompositionVersion"("template_id", "encountered_at");

-- CreateIndex
CREATE INDEX "CompositionVersion_archetype_id_idx" ON "CompositionVersion"("archetype_id");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionVersion_versioned_composition_id_version_number_key" ON "CompositionVersion"("versioned_composition_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionVersion_source_system_source_record_id_key" ON "CompositionVersion"("source_system", "source_record_id");

-- CreateIndex
CREATE INDEX "EncounterDraft_expires_at_idx" ON "EncounterDraft"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterDraft_patient_id_author_user_id_draft_key_key" ON "EncounterDraft"("patient_id", "author_user_id", "draft_key");

-- CreateIndex
CREATE INDEX "ClinicalAttachment_draft_id_idx" ON "ClinicalAttachment"("draft_id");

-- CreateIndex
CREATE INDEX "ClinicalAttachment_patient_id_status_idx" ON "ClinicalAttachment"("patient_id", "status");

-- CreateIndex
CREATE INDEX "ClinicalAttachment_composition_version_id_idx" ON "ClinicalAttachment"("composition_version_id");

-- CreateIndex
CREATE INDEX "AttachmentPluginExecution_plugin_id_status_idx" ON "AttachmentPluginExecution"("plugin_id", "status");

-- CreateIndex
CREATE INDEX "AttachmentPluginExecution_requested_by_user_id_status_idx" ON "AttachmentPluginExecution"("requested_by_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttachmentPluginExecution_attachment_id_plugin_id_key" ON "AttachmentPluginExecution"("attachment_id", "plugin_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserPluginCredential_user_id_plugin_id_key" ON "UserPluginCredential"("user_id", "plugin_id");

-- CreateIndex
CREATE INDEX "cdwe_patient_author_consumed_idx" ON "ClinicalDocumentWebhookEvent"("patient_id", "author_user_id", "consumed_at");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalDocumentWebhookEvent_state_key" ON "ClinicalDocumentWebhookEvent"("state");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_merged_into_patient_id_fkey" FOREIGN KEY ("merged_into_patient_id") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EhrRecord" ADD CONSTRAINT "EhrRecord_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_ehr_id_fkey" FOREIGN KEY ("ehr_id") REFERENCES "EhrRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_committer_user_id_fkey" FOREIGN KEY ("committer_user_id") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionedComposition" ADD CONSTRAINT "VersionedComposition_ehr_id_fkey" FOREIGN KEY ("ehr_id") REFERENCES "EhrRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionVersion" ADD CONSTRAINT "CompositionVersion_versioned_composition_id_fkey" FOREIGN KEY ("versioned_composition_id") REFERENCES "VersionedComposition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionVersion" ADD CONSTRAINT "CompositionVersion_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "Contribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionVersion" ADD CONSTRAINT "CompositionVersion_preceding_version_id_fkey" FOREIGN KEY ("preceding_version_id") REFERENCES "CompositionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionVersion" ADD CONSTRAINT "CompositionVersion_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "TemplateDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionVersion" ADD CONSTRAINT "CompositionVersion_archetype_id_fkey" FOREIGN KEY ("archetype_id") REFERENCES "ArchetypeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionVersion" ADD CONSTRAINT "CompositionVersion_composer_user_id_fkey" FOREIGN KEY ("composer_user_id") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionVersion" ADD CONSTRAINT "CompositionVersion_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterDraft" ADD CONSTRAINT "EncounterDraft_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterDraft" ADD CONSTRAINT "EncounterDraft_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAttachment" ADD CONSTRAINT "ClinicalAttachment_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAttachment" ADD CONSTRAINT "ClinicalAttachment_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "EncounterDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAttachment" ADD CONSTRAINT "ClinicalAttachment_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAttachment" ADD CONSTRAINT "ClinicalAttachment_composition_version_id_fkey" FOREIGN KEY ("composition_version_id") REFERENCES "CompositionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachmentPluginExecution" ADD CONSTRAINT "AttachmentPluginExecution_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "ClinicalAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachmentPluginExecution" ADD CONSTRAINT "AttachmentPluginExecution_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPluginCredential" ADD CONSTRAINT "UserPluginCredential_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDocumentWebhookEvent" ADD CONSTRAINT "ClinicalDocumentWebhookEvent_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDocumentWebhookEvent" ADD CONSTRAINT "ClinicalDocumentWebhookEvent_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
