-- CreateTable
CREATE TABLE `Patient` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `gender` VARCHAR(191) NOT NULL,
    `birth_date` DATE NULL,
    `is_draft` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `merged_into_patient_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contact` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `patient_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactPoint` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `system` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `patient_id` INTEGER NULL,

    UNIQUE INDEX `ContactPoint_system_value_patient_id_key`(`system`, `value`, `patient_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Identifier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `system` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `patient_id` INTEGER NULL,

    UNIQUE INDEX `Identifier_system_value_key`(`system`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appointment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `appointment_type` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneralSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `property` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GeneralSetting_property_key`(`property`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthUser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(191) NOT NULL,
    `crm` VARCHAR(191) NOT NULL,
    `crm_uf` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuthUser_crm_crm_uf_key`(`crm`, `crm_uf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token_hash` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,
    `user_id` INTEGER NOT NULL,

    UNIQUE INDEX `AuthToken_token_hash_key`(`token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EhrRecord` (
    `id` CHAR(36) NOT NULL,
    `system_id` VARCHAR(191) NOT NULL DEFAULT 'soap-ehr',
    `patient_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EhrRecord_patient_id_key`(`patient_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contribution` (
    `id` CHAR(36) NOT NULL,
    `ehr_id` CHAR(36) NOT NULL,
    `committer_user_id` INTEGER NOT NULL,
    `change_type` VARCHAR(191) NOT NULL DEFAULT 'creation',
    `description` VARCHAR(191) NULL,
    `committed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Contribution_ehr_id_committed_at_idx`(`ehr_id`, `committed_at`),
    INDEX `Contribution_committer_user_id_idx`(`committer_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VersionedComposition` (
    `id` CHAR(36) NOT NULL,
    `ehr_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VersionedComposition_ehr_id_created_at_idx`(`ehr_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArchetypeDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `rm_type` VARCHAR(191) NOT NULL,
    `concept` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'pt-BR',
    `definition` JSON NOT NULL,
    `content_hash` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TemplateDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `root_archetype_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'pt-BR',
    `operational_template` JSON NOT NULL,
    `content_hash` CHAR(64) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompositionVersion` (
    `id` CHAR(36) NOT NULL,
    `versioned_composition_id` CHAR(36) NOT NULL,
    `contribution_id` CHAR(36) NOT NULL,
    `preceding_version_id` CHAR(36) NULL,
    `template_id` VARCHAR(191) NOT NULL,
    `archetype_id` VARCHAR(191) NOT NULL,
    `composer_user_id` INTEGER NOT NULL,
    `appointment_id` INTEGER NULL,
    `version_number` INTEGER NOT NULL DEFAULT 1,
    `lifecycle_state` VARCHAR(191) NOT NULL DEFAULT 'complete',
    `category` VARCHAR(191) NOT NULL DEFAULT 'event',
    `language` VARCHAR(191) NOT NULL DEFAULT 'pt-BR',
    `territory` VARCHAR(191) NOT NULL DEFAULT 'BR',
    `title` VARCHAR(191) NOT NULL,
    `encountered_at` DATETIME(3) NOT NULL,
    `content` JSON NOT NULL,
    `content_hash` CHAR(64) NOT NULL,
    `fhir_composition_id` VARCHAR(191) NOT NULL,
    `source_system` VARCHAR(191) NULL,
    `source_record_id` VARCHAR(191) NULL,
    `committed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CompositionVersion_fhir_composition_id_key`(`fhir_composition_id`),
    INDEX `CompositionVersion_composer_user_id_idx`(`composer_user_id`),
    INDEX `CompositionVersion_appointment_id_idx`(`appointment_id`),
    INDEX `CompositionVersion_template_id_encountered_at_idx`(`template_id`, `encountered_at`),
    INDEX `CompositionVersion_archetype_id_idx`(`archetype_id`),
    UNIQUE INDEX `CompositionVersion_versioned_composition_id_version_number_key`(`versioned_composition_id`, `version_number`),
    UNIQUE INDEX `CompositionVersion_source_system_source_record_id_key`(`source_system`, `source_record_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EncounterDraft` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `author_user_id` INTEGER NOT NULL,
    `appointment_id` INTEGER NULL,
    `draft_key` VARCHAR(191) NOT NULL,
    `note_type` VARCHAR(191) NOT NULL DEFAULT 'soap',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EncounterDraft_expires_at_idx`(`expires_at`),
    UNIQUE INDEX `EncounterDraft_patient_id_author_user_id_draft_key_key`(`patient_id`, `author_user_id`, `draft_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClinicalAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `author_user_id` INTEGER NOT NULL,
    `draft_id` INTEGER NULL,
    `appointment_id` INTEGER NULL,
    `composition_version_id` CHAR(36) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `file_name` VARCHAR(191) NOT NULL,
    `content_type` VARCHAR(191) NOT NULL,
    `byte_size` INTEGER NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `s3_bucket` VARCHAR(191) NOT NULL,
    `s3_key` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClinicalAttachment_draft_id_idx`(`draft_id`),
    INDEX `ClinicalAttachment_patient_id_status_idx`(`patient_id`, `status`),
    INDEX `ClinicalAttachment_composition_version_id_idx`(`composition_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttachmentPluginExecution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attachment_id` INTEGER NOT NULL,
    `plugin_id` VARCHAR(191) NOT NULL,
    `requested_by_user_id` INTEGER NOT NULL,
    `external_job_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttachmentPluginExecution_plugin_id_status_idx`(`plugin_id`, `status`),
    INDEX `AttachmentPluginExecution_requested_by_user_id_status_idx`(`requested_by_user_id`, `status`),
    UNIQUE INDEX `AttachmentPluginExecution_attachment_id_plugin_id_key`(`attachment_id`, `plugin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPluginCredential` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `plugin_id` VARCHAR(191) NOT NULL,
    `encrypted_secret` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserPluginCredential_user_id_plugin_id_key`(`user_id`, `plugin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClinicalDocumentWebhookEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `author_user_id` INTEGER NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `document_type` VARCHAR(191) NOT NULL,
    `clinical_note` TEXT NOT NULL,
    `payload` JSON NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cdwe_patient_author_consumed_idx`(`patient_id`, `author_user_id`, `consumed_at`),
    UNIQUE INDEX `ClinicalDocumentWebhookEvent_state_key`(`state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NULL,
    `entity_id` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Patient` ADD CONSTRAINT `Patient_merged_into_patient_id_fkey` FOREIGN KEY (`merged_into_patient_id`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactPoint` ADD CONSTRAINT `ContactPoint_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Identifier` ADD CONSTRAINT `Identifier_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `AuthUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EhrRecord` ADD CONSTRAINT `EhrRecord_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contribution` ADD CONSTRAINT `Contribution_ehr_id_fkey` FOREIGN KEY (`ehr_id`) REFERENCES `EhrRecord`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contribution` ADD CONSTRAINT `Contribution_committer_user_id_fkey` FOREIGN KEY (`committer_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VersionedComposition` ADD CONSTRAINT `VersionedComposition_ehr_id_fkey` FOREIGN KEY (`ehr_id`) REFERENCES `EhrRecord`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionVersion` ADD CONSTRAINT `CompositionVersion_versioned_composition_id_fkey` FOREIGN KEY (`versioned_composition_id`) REFERENCES `VersionedComposition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionVersion` ADD CONSTRAINT `CompositionVersion_contribution_id_fkey` FOREIGN KEY (`contribution_id`) REFERENCES `Contribution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionVersion` ADD CONSTRAINT `CompositionVersion_preceding_version_id_fkey` FOREIGN KEY (`preceding_version_id`) REFERENCES `CompositionVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionVersion` ADD CONSTRAINT `CompositionVersion_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `TemplateDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionVersion` ADD CONSTRAINT `CompositionVersion_archetype_id_fkey` FOREIGN KEY (`archetype_id`) REFERENCES `ArchetypeDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionVersion` ADD CONSTRAINT `CompositionVersion_composer_user_id_fkey` FOREIGN KEY (`composer_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionVersion` ADD CONSTRAINT `CompositionVersion_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EncounterDraft` ADD CONSTRAINT `EncounterDraft_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EncounterDraft` ADD CONSTRAINT `EncounterDraft_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalAttachment` ADD CONSTRAINT `ClinicalAttachment_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalAttachment` ADD CONSTRAINT `ClinicalAttachment_draft_id_fkey` FOREIGN KEY (`draft_id`) REFERENCES `EncounterDraft`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalAttachment` ADD CONSTRAINT `ClinicalAttachment_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalAttachment` ADD CONSTRAINT `ClinicalAttachment_composition_version_id_fkey` FOREIGN KEY (`composition_version_id`) REFERENCES `CompositionVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttachmentPluginExecution` ADD CONSTRAINT `AttachmentPluginExecution_attachment_id_fkey` FOREIGN KEY (`attachment_id`) REFERENCES `ClinicalAttachment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttachmentPluginExecution` ADD CONSTRAINT `AttachmentPluginExecution_requested_by_user_id_fkey` FOREIGN KEY (`requested_by_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPluginCredential` ADD CONSTRAINT `UserPluginCredential_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `AuthUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalDocumentWebhookEvent` ADD CONSTRAINT `ClinicalDocumentWebhookEvent_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalDocumentWebhookEvent` ADD CONSTRAINT `ClinicalDocumentWebhookEvent_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `AuthUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
