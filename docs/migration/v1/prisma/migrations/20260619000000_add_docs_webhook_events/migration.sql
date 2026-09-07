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
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ClinicalDocumentWebhookEvent_state_key`(`state`),
  INDEX `cdwe_patient_author_consumed_idx`(
    `patient_id`,
    `author_user_id`,
    `consumed_at`
  ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClinicalDocumentWebhookEvent`
  ADD CONSTRAINT `ClinicalDocumentWebhookEvent_patient_id_fkey`
  FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ClinicalDocumentWebhookEvent`
  ADD CONSTRAINT `ClinicalDocumentWebhookEvent_author_user_id_fkey`
  FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
