ALTER TABLE `Patient`
  ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `merged_into_patient_id` INTEGER NULL;

CREATE INDEX `Patient_merged_into_patient_id_idx` ON `Patient`(`merged_into_patient_id`);

ALTER TABLE `Patient`
  ADD CONSTRAINT `Patient_merged_into_patient_id_fkey`
  FOREIGN KEY (`merged_into_patient_id`) REFERENCES `Patient`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
