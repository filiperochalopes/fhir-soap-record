-- MySQL dump 10.13  Distrib 8.4.11, for Linux (aarch64)
--
-- Host: 127.0.0.1    Database: fhir_soap_record
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Appointment`
--

DROP TABLE IF EXISTS `Appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Appointment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `start` datetime(3) NOT NULL,
  `end` datetime(3) NOT NULL,
  `status` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_type` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Appointment_patient_id_fkey` (`patient_id`),
  CONSTRAINT `Appointment_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Appointment`
--

LOCK TABLES `Appointment` WRITE;
/*!40000 ALTER TABLE `Appointment` DISABLE KEYS */;
INSERT INTO `Appointment` VALUES (1001,1001,'2026-02-01 13:00:00.000','2026-02-01 13:30:00.000','fulfilled','Consulta sintética','2026-01-20 10:00:00.000','2026-02-01 13:30:00.000');
/*!40000 ALTER TABLE `Appointment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `AttachmentPluginExecution`
--

DROP TABLE IF EXISTS `AttachmentPluginExecution`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AttachmentPluginExecution` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attachment_id` int NOT NULL,
  `plugin_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `requested_by_user_id` int NOT NULL,
  `external_job_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `result` json DEFAULT NULL,
  `error` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `completed_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `AttachmentPluginExecution_attachment_id_plugin_id_key` (`attachment_id`,`plugin_id`),
  KEY `AttachmentPluginExecution_plugin_id_status_idx` (`plugin_id`,`status`),
  KEY `AttachmentPluginExecution_requested_by_user_id_status_idx` (`requested_by_user_id`,`status`),
  CONSTRAINT `AttachmentPluginExecution_attachment_id_fkey` FOREIGN KEY (`attachment_id`) REFERENCES `ClinicalAttachment` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AttachmentPluginExecution_requested_by_user_id_fkey` FOREIGN KEY (`requested_by_user_id`) REFERENCES `AuthUser` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AttachmentPluginExecution`
--

LOCK TABLES `AttachmentPluginExecution` WRITE;
/*!40000 ALTER TABLE `AttachmentPluginExecution` DISABLE KEYS */;
INSERT INTO `AttachmentPluginExecution` VALUES (1001,1001,'synthetic-plugin',1001,'job-synthetic-1001','completed','Resultado sintético','{\"ok\": true}',NULL,'2026-02-01 13:24:00.000','2026-02-01 13:20:00.000','2026-02-01 13:24:00.000');
/*!40000 ALTER TABLE `AttachmentPluginExecution` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `AuditLog`
--

DROP TABLE IF EXISTS `AuditLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AuditLog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `AuditLog_user_id_fkey` (`user_id`),
  CONSTRAINT `AuditLog_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `AuthUser` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AuditLog`
--

LOCK TABLES `AuditLog` WRITE;
/*!40000 ALTER TABLE `AuditLog` DISABLE KEYS */;
INSERT INTO `AuditLog` VALUES (1001,'soap','soap.created','SoapNote','1001','{\"fixture\": true}','2026-02-01 13:25:00.000',1001);
/*!40000 ALTER TABLE `AuditLog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `AuthToken`
--

DROP TABLE IF EXISTS `AuthToken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AuthToken` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token_hash` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_used_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revoked_at` datetime(3) DEFAULT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AuthToken_token_hash_key` (`token_hash`),
  KEY `AuthToken_user_id_fkey` (`user_id`),
  CONSTRAINT `AuthToken_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `AuthUser` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AuthToken`
--

LOCK TABLES `AuthToken` WRITE;
/*!40000 ALTER TABLE `AuthToken` DISABLE KEYS */;
INSERT INTO `AuthToken` VALUES (1001,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',1,'2026-02-20 11:00:00.000','2026-01-10 09:01:00.000','2026-02-20 11:00:00.000',NULL,1001);
/*!40000 ALTER TABLE `AuthToken` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `AuthUser`
--

DROP TABLE IF EXISTS `AuthUser`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AuthUser` (
  `id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `crm` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `crm_uf` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `AuthUser_crm_crm_uf_key` (`crm`,`crm_uf`)
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AuthUser`
--

LOCK TABLES `AuthUser` WRITE;
/*!40000 ALTER TABLE `AuthUser` DISABLE KEYS */;
INSERT INTO `AuthUser` VALUES (1001,'Dra. Ada Exemplo','SYNTHETIC','BA',1,'2026-01-10 09:00:00.000','2026-01-10 09:00:00.000');
/*!40000 ALTER TABLE `AuthUser` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ClinicalAttachment`
--

DROP TABLE IF EXISTS `ClinicalAttachment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ClinicalAttachment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `author_user_id` int NOT NULL,
  `draft_id` int DEFAULT NULL,
  `appointment_id` int DEFAULT NULL,
  `soap_note_id` int DEFAULT NULL,
  `narrative_note_id` int DEFAULT NULL,
  `status` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `file_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `byte_size` int NOT NULL,
  `sha256` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `s3_bucket` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `s3_key` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ClinicalAttachment_draft_id_idx` (`draft_id`),
  KEY `ClinicalAttachment_patient_id_status_idx` (`patient_id`,`status`),
  KEY `ClinicalAttachment_soap_note_id_idx` (`soap_note_id`),
  KEY `ClinicalAttachment_narrative_note_id_idx` (`narrative_note_id`),
  KEY `ClinicalAttachment_author_user_id_fkey` (`author_user_id`),
  CONSTRAINT `ClinicalAttachment_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ClinicalAttachment_draft_id_fkey` FOREIGN KEY (`draft_id`) REFERENCES `EncounterDraft` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ClinicalAttachment_narrative_note_id_fkey` FOREIGN KEY (`narrative_note_id`) REFERENCES `NarrativeNote` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ClinicalAttachment_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ClinicalAttachment_soap_note_id_fkey` FOREIGN KEY (`soap_note_id`) REFERENCES `SoapNote` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1004 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ClinicalAttachment`
--

LOCK TABLES `ClinicalAttachment` WRITE;
/*!40000 ALTER TABLE `ClinicalAttachment` DISABLE KEYS */;
INSERT INTO `ClinicalAttachment` VALUES (1001,1001,1001,NULL,1001,1001,NULL,'attached','exame-sintetico.txt','text/plain',27,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','synthetic-fixture','patients/1001/exame-sintetico.txt','2026-02-01 13:10:00.000','2026-02-01 13:25:00.000'),(1002,1001,1001,NULL,NULL,NULL,1001,'attached','narrativa-sintetica.txt','text/plain',31,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','synthetic-fixture','patients/1001/narrativa-sintetica.txt','2026-02-20 10:05:00.000','2026-02-20 10:15:00.000'),(1003,1001,1001,1001,1001,NULL,NULL,'draft','rascunho-sintetico.txt','text/plain',18,'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','synthetic-fixture','drafts/1001/rascunho-sintetico.txt','2026-02-01 12:52:00.000','2026-02-01 12:52:00.000');
/*!40000 ALTER TABLE `ClinicalAttachment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ClinicalDocumentWebhookEvent`
--

DROP TABLE IF EXISTS `ClinicalDocumentWebhookEvent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ClinicalDocumentWebhookEvent` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `author_user_id` int NOT NULL,
  `state` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_type` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinical_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json DEFAULT NULL,
  `consumed_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ClinicalDocumentWebhookEvent_state_key` (`state`),
  KEY `cdwe_patient_author_consumed_idx` (`patient_id`,`author_user_id`,`consumed_at`),
  KEY `ClinicalDocumentWebhookEvent_author_user_id_fkey` (`author_user_id`),
  CONSTRAINT `ClinicalDocumentWebhookEvent_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ClinicalDocumentWebhookEvent_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ClinicalDocumentWebhookEvent`
--

LOCK TABLES `ClinicalDocumentWebhookEvent` WRITE;
/*!40000 ALTER TABLE `ClinicalDocumentWebhookEvent` DISABLE KEYS */;
INSERT INTO `ClinicalDocumentWebhookEvent` VALUES (1001,1001,1001,'synthetic-webhook-state-1001','synthetic-report','Documento sintético para validar migração.','{\"fixture\": true, \"version\": 1}','2026-02-20 12:05:00.000','2026-02-20 12:00:00.000','2026-02-20 12:05:00.000');
/*!40000 ALTER TABLE `ClinicalDocumentWebhookEvent` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Contact`
--

DROP TABLE IF EXISTS `Contact`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Contact` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `relationship` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `patient_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Contact_patient_id_fkey` (`patient_id`),
  CONSTRAINT `Contact_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Contact`
--

LOCK TABLES `Contact` WRITE;
/*!40000 ALTER TABLE `Contact` DISABLE KEYS */;
INSERT INTO `Contact` VALUES (1001,'Contato Sintético','family','2026-01-10 09:05:00.000','2026-01-10 09:05:00.000',1001);
/*!40000 ALTER TABLE `Contact` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ContactPoint`
--

DROP TABLE IF EXISTS `ContactPoint`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ContactPoint` (
  `id` int NOT NULL AUTO_INCREMENT,
  `system` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `patient_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ContactPoint_system_value_patient_id_key` (`system`,`value`,`patient_id`),
  KEY `ContactPoint_patient_id_fkey` (`patient_id`),
  CONSTRAINT `ContactPoint_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ContactPoint`
--

LOCK TABLES `ContactPoint` WRITE;
/*!40000 ALTER TABLE `ContactPoint` DISABLE KEYS */;
INSERT INTO `ContactPoint` VALUES (1001,'phone','+55 71 0000-0000','2026-01-10 09:05:00.000','2026-01-10 09:05:00.000',1001);
/*!40000 ALTER TABLE `ContactPoint` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `EncounterDraft`
--

DROP TABLE IF EXISTS `EncounterDraft`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `EncounterDraft` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `author_user_id` int NOT NULL,
  `appointment_id` int DEFAULT NULL,
  `draft_key` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note_type` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'soap',
  `status` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `expires_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `EncounterDraft_patient_id_author_user_id_draft_key_key` (`patient_id`,`author_user_id`,`draft_key`),
  KEY `EncounterDraft_expires_at_idx` (`expires_at`),
  KEY `EncounterDraft_author_user_id_fkey` (`author_user_id`),
  CONSTRAINT `EncounterDraft_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EncounterDraft_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `EncounterDraft`
--

LOCK TABLES `EncounterDraft` WRITE;
/*!40000 ALTER TABLE `EncounterDraft` DISABLE KEYS */;
INSERT INTO `EncounterDraft` VALUES (1001,1001,1001,1001,'synthetic-draft-1001','soap','active','2026-03-01 13:00:00.000','2026-02-01 12:50:00.000','2026-02-01 12:55:00.000');
/*!40000 ALTER TABLE `EncounterDraft` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `GeneralSetting`
--

DROP TABLE IF EXISTS `GeneralSetting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GeneralSetting` (
  `id` int NOT NULL AUTO_INCREMENT,
  `property` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `GeneralSetting_property_key` (`property`)
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `GeneralSetting`
--

LOCK TABLES `GeneralSetting` WRITE;
/*!40000 ALTER TABLE `GeneralSetting` DISABLE KEYS */;
INSERT INTO `GeneralSetting` VALUES (1001,'synthetic.fixture.enabled','true','2026-01-10 09:02:00.000','2026-01-10 09:02:00.000');
/*!40000 ALTER TABLE `GeneralSetting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Identifier`
--

DROP TABLE IF EXISTS `Identifier`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Identifier` (
  `id` int NOT NULL AUTO_INCREMENT,
  `system` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `patient_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Identifier_system_value_key` (`system`,`value`),
  KEY `Identifier_patient_id_fkey` (`patient_id`),
  CONSTRAINT `Identifier_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Identifier`
--

LOCK TABLES `Identifier` WRITE;
/*!40000 ALTER TABLE `Identifier` DISABLE KEYS */;
INSERT INTO `Identifier` VALUES (1001,'urn:soap-ehr:synthetic:patient','SYN-1001','2026-01-10 09:05:00.000','2026-01-10 09:05:00.000',1001);
/*!40000 ALTER TABLE `Identifier` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `NarrativeNote`
--

DROP TABLE IF EXISTS `NarrativeNote`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `NarrativeNote` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `author_user_id` int NOT NULL,
  `encountered_at` datetime(3) NOT NULL,
  `title` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sections` json NOT NULL,
  `source_system` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_record_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `NarrativeNote_source_system_source_record_id_key` (`source_system`,`source_record_id`),
  KEY `NarrativeNote_patient_id_fkey` (`patient_id`),
  KEY `NarrativeNote_author_user_id_fkey` (`author_user_id`),
  CONSTRAINT `NarrativeNote_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `NarrativeNote_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `NarrativeNote`
--

LOCK TABLES `NarrativeNote` WRITE;
/*!40000 ALTER TABLE `NarrativeNote` DISABLE KEYS */;
INSERT INTO `NarrativeNote` VALUES (1001,1001,1001,'2026-02-20 10:00:00.000','Retorno narrativo','[{\"text\": \"Paciente permanece assintética no retorno sintético.\", \"title\": \"Evolução\"}]',NULL,NULL,'2026-02-20 10:15:00.000','2026-02-20 10:15:00.000');
/*!40000 ALTER TABLE `NarrativeNote` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Patient`
--

DROP TABLE IF EXISTS `Patient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Patient` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `birth_date` date DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_draft` tinyint(1) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `merged_into_patient_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Patient_merged_into_patient_id_idx` (`merged_into_patient_id`),
  CONSTRAINT `Patient_merged_into_patient_id_fkey` FOREIGN KEY (`merged_into_patient_id`) REFERENCES `Patient` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1003 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Patient`
--

LOCK TABLES `Patient` WRITE;
/*!40000 ALTER TABLE `Patient` DISABLE KEYS */;
INSERT INTO `Patient` VALUES (1001,'Paciente Sintético Um','female','1984-03-15','2026-01-10 09:05:00.000','2026-01-10 09:05:00.000',0,1,NULL),(1002,'Cadastro Sintético Duplicado','unknown',NULL,'2026-01-10 09:06:00.000','2026-01-10 09:07:00.000',1,0,1001);
/*!40000 ALTER TABLE `Patient` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SoapNote`
--

DROP TABLE IF EXISTS `SoapNote`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SoapNote` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `author_user_id` int NOT NULL,
  `encountered_at` datetime(3) NOT NULL,
  `subjective` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `objective` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `assessment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_system` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_record_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `appointment_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `SoapNote_source_system_source_record_id_key` (`source_system`,`source_record_id`),
  KEY `SoapNote_patient_id_fkey` (`patient_id`),
  KEY `SoapNote_author_user_id_fkey` (`author_user_id`),
  KEY `SoapNote_appointment_id_idx` (`appointment_id`),
  CONSTRAINT `SoapNote_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `Appointment` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `SoapNote_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `AuthUser` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SoapNote_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `Patient` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1003 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SoapNote`
--

LOCK TABLES `SoapNote` WRITE;
/*!40000 ALTER TABLE `SoapNote` DISABLE KEYS */;
INSERT INTO `SoapNote` VALUES (1001,1001,1001,'2026-02-01 13:05:00.000','Relata cefaleia leve há dois dias.','PA 120/80 mmHg; sem sinais de alarme.','Cefaleia inespecífica, sem sinais de gravidade.','Orientações gerais e retorno se houver piora.',NULL,NULL,'2026-02-01 13:25:00.000','2026-02-01 13:25:00.000',1001),(1002,1001,1001,'2026-02-15 14:00:00.000','Refere melhora completa.','Bom estado geral.','Evolução favorável.','Seguimento conforme necessidade.','synthetic-import','soap-external-1','2026-02-15 14:20:00.000','2026-02-15 14:20:00.000',NULL);
/*!40000 ALTER TABLE `SoapNote` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UserPluginCredential`
--

DROP TABLE IF EXISTS `UserPluginCredential`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserPluginCredential` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `plugin_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `encrypted_secret` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserPluginCredential_user_id_plugin_id_key` (`user_id`,`plugin_id`),
  CONSTRAINT `UserPluginCredential_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `AuthUser` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserPluginCredential`
--

LOCK TABLES `UserPluginCredential` WRITE;
/*!40000 ALTER TABLE `UserPluginCredential` DISABLE KEYS */;
INSERT INTO `UserPluginCredential` VALUES (1001,1001,'synthetic-plugin','synthetic-encrypted-secret-not-valid-for-runtime','2026-01-10 09:03:00.000','2026-01-10 09:03:00.000');
/*!40000 ALTER TABLE `UserPluginCredential` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('0726369c-1c1d-4beb-a0c7-4161aa15fc4a','f7ea8b8b4c6dcb4d3719d65c574737a7e81bdb2dad983e5e9f69ccb8710b6ff3','2026-08-30 17:14:30.706','20260406000000_add_patient_merge_support',NULL,NULL,'2026-08-30 17:14:30.671',1),('3adaf990-af1b-41ad-ba37-2f2a71b72fb6','6bf32c4460d26f3d5225bbbb0d2ec4d00efbb3e17d170e30b8195985ea76afee','2026-08-30 17:14:30.670','20260328000000_add_patient_draft_support',NULL,NULL,'2026-08-30 17:14:30.652',1),('3e8cf899-bc7a-4679-b409-89d73dcf0326','fdce05179b53bd712e3a70ce7fd704432f79d4b5cfedc8a2e29e92b0ed307567','2026-08-30 17:14:30.915','20260612000000_add_attachment_plugin_infrastructure',NULL,NULL,'2026-08-30 17:14:30.862',1),('55468420-ecc7-40d7-8cc2-b1e23eb4ce3f','d2eae3351f6f3bb71de71eae72c0cca91c58e0240294aacc51bcfd484263240c','2026-08-30 17:14:30.860','20260603000000_add_clinical_attachments',NULL,NULL,'2026-08-30 17:14:30.740',1),('66b929fd-5490-4985-af5b-6c5b32b64349','1934a55849bedfcbb2449d55754578a27963d49e89671be3cf4fba58863900d4','2026-08-30 17:14:30.623','20260322000000_init',NULL,NULL,'2026-08-30 17:14:30.491',1),('7763678d-8713-453f-967f-36cc6612f425','22859b18491d4e34ad519de0f5e3351b8fda67fbc605a742e0cf56a41a1f9612','2026-08-30 17:14:30.714','20260408000000_make_general_setting_property_unique',NULL,NULL,'2026-08-30 17:14:30.708',1),('77a6d8d0-e44b-472f-88cb-65f667b079ed','a85160c5dfcc7f4bad8e500527594499e22b56b292c22c8483794ba64719c5b0','2026-08-30 17:14:30.965','20260619000000_add_docs_webhook_events',NULL,NULL,'2026-08-30 17:14:30.916',1),('9e713828-d34c-451e-8083-2fed030c4b7a','4718e37ffaafb75caa7791fc2c826e6cd7a5cc0aa2f2b47b7a7b0f607bbeade0','2026-08-30 17:14:30.739','20260414000000_link_soap_notes_to_appointments',NULL,NULL,'2026-08-30 17:14:30.715',1),('b0b37ded-edfc-4cd2-be8e-25d2505a15b7','34bd6ae55b6fb6022ec19f78f15a566b66e1f093225b1b5a48f2013f42087a00','2026-08-30 17:14:30.651','20260322120000_add_narrative_notes',NULL,NULL,'2026-08-30 17:14:30.624',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'fhir_soap_record'
--

--
-- Dumping routines for database 'fhir_soap_record'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed
