-- AlterTable
ALTER TABLE `SoapNote` ADD COLUMN `appointment_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `SoapNote_appointment_id_idx` ON `SoapNote`(`appointment_id`);

-- AddForeignKey
ALTER TABLE `SoapNote` ADD CONSTRAINT `SoapNote_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
