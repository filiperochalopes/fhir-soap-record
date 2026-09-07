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

  UNIQUE INDEX `EncounterDraft_patient_id_author_user_id_draft_key_key`(`patient_id`, `author_user_id`, `draft_key`),
  INDEX `EncounterDraft_expires_at_idx`(`expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ClinicalAttachment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `patient_id` INTEGER NOT NULL,
  `author_user_id` INTEGER NOT NULL,
  `draft_id` INTEGER NULL,
  `appointment_id` INTEGER NULL,
  `soap_note_id` INTEGER NULL,
  `narrative_note_id` INTEGER NULL,
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
  INDEX `ClinicalAttachment_soap_note_id_idx`(`soap_note_id`),
  INDEX `ClinicalAttachment_narrative_note_id_idx`(`narrative_note_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EncounterDraft` ADD CONSTRAINT `EncounterDraft_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `EncounterDraft` ADD CONSTRAINT `EncounterDraft_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ClinicalAttachment` ADD CONSTRAINT `ClinicalAttachment_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ClinicalAttachment` ADD CONSTRAINT `ClinicalAttachment_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ClinicalAttachment` ADD CONSTRAINT `ClinicalAttachment_draft_id_fkey` FOREIGN KEY (`draft_id`) REFERENCES `EncounterDraft`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ClinicalAttachment` ADD CONSTRAINT `ClinicalAttachment_soap_note_id_fkey` FOREIGN KEY (`soap_note_id`) REFERENCES `SoapNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ClinicalAttachment` ADD CONSTRAINT `ClinicalAttachment_narrative_note_id_fkey` FOREIGN KEY (`narrative_note_id`) REFERENCES `NarrativeNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
