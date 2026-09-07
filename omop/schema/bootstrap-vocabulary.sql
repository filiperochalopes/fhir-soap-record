-- Minimal, non-clinical bootstrap used by the synthetic study environment.
-- Replace/extend it with a licensed Athena vocabulary export before research use.
INSERT INTO omop.vocabulary (
  vocabulary_id, vocabulary_name, vocabulary_reference, vocabulary_version, vocabulary_concept_id
) VALUES
  ('None', 'No vocabulary', 'OMOP concept_id 0', 'bootstrap-2026-08', 0),
  ('Gender', 'OMOP Gender', 'OHDSI Standardized Vocabularies', 'bootstrap-2026-08', 0),
  ('Visit', 'OMOP Visit', 'OHDSI Standardized Vocabularies', 'bootstrap-2026-08', 0),
  ('Type Concept', 'OMOP Type Concept', 'OHDSI Standardized Vocabularies', 'bootstrap-2026-08', 0),
  ('soap-ehr', 'soap-ehr local source vocabulary', 'https://soap-ehr.example', '2.0.0', 0)
ON CONFLICT (vocabulary_id) DO UPDATE SET
  vocabulary_name = EXCLUDED.vocabulary_name,
  vocabulary_reference = EXCLUDED.vocabulary_reference,
  vocabulary_version = EXCLUDED.vocabulary_version;

INSERT INTO omop.domain (domain_id, domain_name, domain_concept_id) VALUES
  ('Metadata', 'Metadata', 0),
  ('Gender', 'Gender', 0),
  ('Visit', 'Visit', 0),
  ('Type Concept', 'Type Concept', 0)
ON CONFLICT (domain_id) DO UPDATE SET domain_name = EXCLUDED.domain_name;

INSERT INTO omop.concept_class (
  concept_class_id, concept_class_name, concept_class_concept_id
) VALUES
  ('Undefined', 'Undefined', 0),
  ('Gender', 'Gender', 0),
  ('Visit', 'Visit', 0),
  ('Type Concept', 'Type Concept', 0)
ON CONFLICT (concept_class_id) DO UPDATE SET
  concept_class_name = EXCLUDED.concept_class_name;

INSERT INTO omop.concept (
  concept_id, concept_name, domain_id, vocabulary_id, concept_class_id,
  standard_concept, concept_code, valid_start_date, valid_end_date, invalid_reason
) VALUES
  (0, 'No matching concept', 'Metadata', 'None', 'Undefined', NULL, '0', DATE '1970-01-01', DATE '2099-12-31', NULL),
  (8507, 'Male', 'Gender', 'Gender', 'Gender', 'S', 'M', DATE '1970-01-01', DATE '2099-12-31', NULL),
  (8532, 'Female', 'Gender', 'Gender', 'Gender', 'S', 'F', DATE '1970-01-01', DATE '2099-12-31', NULL),
  (9202, 'Outpatient Visit', 'Visit', 'Visit', 'Visit', 'S', 'OP', DATE '1970-01-01', DATE '2099-12-31', NULL),
  (32817, 'EHR', 'Type Concept', 'Type Concept', 'Type Concept', 'S', 'EHR', DATE '1970-01-01', DATE '2099-12-31', NULL)
ON CONFLICT (concept_id) DO UPDATE SET
  concept_name = EXCLUDED.concept_name,
  domain_id = EXCLUDED.domain_id,
  vocabulary_id = EXCLUDED.vocabulary_id,
  concept_class_id = EXCLUDED.concept_class_id,
  standard_concept = EXCLUDED.standard_concept,
  concept_code = EXCLUDED.concept_code,
  invalid_reason = EXCLUDED.invalid_reason;

DELETE FROM omop.source_to_concept_map
WHERE source_vocabulary_id = 'soap-ehr';

INSERT INTO omop.source_to_concept_map (
  source_code, source_concept_id, source_vocabulary_id, source_code_description,
  target_concept_id, target_vocabulary_id, valid_start_date, valid_end_date, invalid_reason
) VALUES
  ('male', 0, 'soap-ehr', 'Patient.gender = male', 8507, 'Gender', DATE '1970-01-01', DATE '2099-12-31', NULL),
  ('female', 0, 'soap-ehr', 'Patient.gender = female', 8532, 'Gender', DATE '1970-01-01', DATE '2099-12-31', NULL),
  ('office-appointment', 0, 'soap-ehr', 'Private-office appointment', 9202, 'Visit', DATE '1970-01-01', DATE '2099-12-31', NULL),
  ('ehr-record', 0, 'soap-ehr', 'Record authored in soap-ehr', 32817, 'Type Concept', DATE '1970-01-01', DATE '2099-12-31', NULL);
