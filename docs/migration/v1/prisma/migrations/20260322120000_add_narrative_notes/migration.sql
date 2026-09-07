-- CreateTable
CREATE TABLE `NarrativeNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `author_user_id` INTEGER NOT NULL,
    `encountered_at` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NULL,
    `sections` JSON NOT NULL,
    `source_system` VARCHAR(191) NULL,
    `source_record_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `NarrativeNote_source_system_source_record_id_key`(`source_system`, `source_record_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NarrativeNote` ADD CONSTRAINT `NarrativeNote_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NarrativeNote` ADD CONSTRAINT `NarrativeNote_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
