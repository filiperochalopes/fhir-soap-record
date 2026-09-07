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

  UNIQUE INDEX `AttachmentPluginExecution_attachment_id_plugin_id_key`(`attachment_id`, `plugin_id`),
  INDEX `AttachmentPluginExecution_plugin_id_status_idx`(`plugin_id`, `status`),
  INDEX `AttachmentPluginExecution_requested_by_user_id_status_idx`(`requested_by_user_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

ALTER TABLE `AttachmentPluginExecution`
  ADD CONSTRAINT `AttachmentPluginExecution_attachment_id_fkey`
  FOREIGN KEY (`attachment_id`) REFERENCES `ClinicalAttachment`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AttachmentPluginExecution`
  ADD CONSTRAINT `AttachmentPluginExecution_requested_by_user_id_fkey`
  FOREIGN KEY (`requested_by_user_id`) REFERENCES `AuthUser`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `UserPluginCredential`
  ADD CONSTRAINT `UserPluginCredential_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `AuthUser`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
