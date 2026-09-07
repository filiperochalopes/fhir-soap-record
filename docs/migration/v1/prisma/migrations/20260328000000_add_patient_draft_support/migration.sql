ALTER TABLE `Patient`
  ADD COLUMN `is_draft` BOOLEAN NOT NULL DEFAULT false,
  MODIFY `birth_date` DATE NULL;
