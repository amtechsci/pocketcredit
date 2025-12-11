-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Dec 11, 2025 at 07:43 PM
-- Server version: 8.0.44-0ubuntu0.24.04.1
-- PHP Version: 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pocket_credit`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` varchar(36) NOT NULL,
  `timestamp` timestamp NOT NULL,
  `type` varchar(50) NOT NULL,
  `user_id` int DEFAULT NULL,
  `admin_id` int DEFAULT NULL,
  `action` text NOT NULL,
  `metadata` json DEFAULT NULL,
  `priority` enum('low','medium','high','critical') DEFAULT 'medium',
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `processed` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `addresses`
--

CREATE TABLE `addresses` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `address_type` enum('current','permanent','office') DEFAULT 'current',
  `address_line1` varchar(255) NOT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) NOT NULL,
  `pincode` varchar(10) NOT NULL,
  `country` varchar(100) DEFAULT 'India',
  `is_primary` tinyint(1) DEFAULT '0',
  `verified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('superadmin','manager','officer') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'officer',
  `permissions` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_login_history`
--

CREATE TABLE `admin_login_history` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `login_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `success` tinyint(1) DEFAULT '1',
  `failure_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `application_employment_details`
--

CREATE TABLE `application_employment_details` (
  `id` int NOT NULL,
  `application_id` int NOT NULL,
  `user_id` int NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `education` varchar(100) DEFAULT NULL COMMENT 'Education level',
  `industry` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `designation` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bank_details`
--

CREATE TABLE `bank_details` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `bank_name` varchar(255) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `ifsc_code` varchar(20) NOT NULL,
  `account_holder_name` varchar(255) NOT NULL,
  `account_type` enum('savings','current','salary') DEFAULT 'savings',
  `branch_name` varchar(255) DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  `is_verified` tinyint(1) DEFAULT '0',
  `verification_date` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cloud_configs`
--

CREATE TABLE `cloud_configs` (
  `id` int NOT NULL,
  `config_name` varchar(100) NOT NULL,
  `provider` enum('aws','gcp','azure') NOT NULL,
  `bucket_name` varchar(255) NOT NULL,
  `access_key` varchar(255) NOT NULL,
  `secret_key` varchar(255) NOT NULL,
  `region` varchar(100) NOT NULL,
  `base_url` varchar(500) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` int NOT NULL,
  `company_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT '0',
  `default_loan_plan_id` int DEFAULT NULL COMMENT 'Default loan plan ID for this company. NULL means use system default.',
  `employee_count_range` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `search_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `credit_checks`
--

CREATE TABLE `credit_checks` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `request_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_ref_num` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credit_score` int DEFAULT NULL,
  `bureau_score_confidence` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_code` int DEFAULT NULL,
  `api_message` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_eligible` tinyint(1) DEFAULT '1',
  `rejection_reasons` text COLLATE utf8mb4_unicode_ci,
  `has_settlements` tinyint(1) DEFAULT '0',
  `has_writeoffs` tinyint(1) DEFAULT '0',
  `has_suit_files` tinyint(1) DEFAULT '0',
  `has_wilful_default` tinyint(1) DEFAULT '0',
  `negative_indicators` json DEFAULT NULL,
  `full_report` json DEFAULT NULL,
  `checked_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `digitap_bank_statements`
--

CREATE TABLE `digitap_bank_statements` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `application_id` int NOT NULL,
  `client_ref_num` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mobile_number` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upload_method` enum('online','manual','aa') COLLATE utf8mb4_unicode_ci DEFAULT 'online',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `digitap_url` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','processing','completed','failed','ReportGenerated') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `report_data` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `digitap_responses`
--

CREATE TABLE `digitap_responses` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `mobile_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `response_data` json DEFAULT NULL,
  `experian_score` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `eligibility_config`
--

CREATE TABLE `eligibility_config` (
  `id` int NOT NULL,
  `config_key` varchar(100) NOT NULL,
  `config_value` varchar(500) NOT NULL,
  `description` text,
  `data_type` enum('number','string','array','boolean') DEFAULT 'string',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `email_configs`
--

CREATE TABLE `email_configs` (
  `id` int NOT NULL,
  `config_name` varchar(100) NOT NULL,
  `provider` varchar(50) NOT NULL,
  `host` varchar(255) NOT NULL,
  `port` int NOT NULL,
  `encryption` enum('tls','ssl','none') NOT NULL DEFAULT 'tls',
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `from_email` varchar(255) NOT NULL,
  `from_name` varchar(100) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `email_otp_verification`
--

CREATE TABLE `email_otp_verification` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `otp` varchar(6) NOT NULL,
  `type` enum('personal','official') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `verified` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employment_details`
--

CREATE TABLE `employment_details` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `employment_type` varchar(50) NOT NULL,
  `income_range` varchar(50) DEFAULT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `industry` varchar(255) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `monthly_salary_old` decimal(10,2) DEFAULT NULL,
  `salary_payment_mode` varchar(50) DEFAULT NULL,
  `work_experience_years` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `enach_registrations`
--

CREATE TABLE `enach_registrations` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `application_id` int NOT NULL COMMENT 'First loan application ID',
  `bank_detail_id` int NOT NULL COMMENT 'Reference to bank_details table',
  `account_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ifsc_code` varchar(11) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_holder_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','registered','active','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `registration_date` datetime DEFAULT NULL COMMENT 'Date when e-NACH was registered',
  `umrn` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Unique Mandate Reference Number (will be added when API is integrated)',
  `mandate_data` json DEFAULT NULL COMMENT 'Stores mandate details from e-NACH API response',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores e-NACH registrations for salary bank accounts';

-- --------------------------------------------------------

--
-- Table structure for table `fee_types`
--

CREATE TABLE `fee_types` (
  `id` int NOT NULL,
  `fee_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fee_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `application_method` enum('deduct_from_disbursal','add_to_total') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'deduct_from_disbursal',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `kfs_email_log`
--

CREATE TABLE `kfs_email_log` (
  `id` int NOT NULL,
  `loan_id` int NOT NULL,
  `recipient_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','sent','failed','bounced') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `sent_at` timestamp NULL DEFAULT NULL,
  `opened_at` timestamp NULL DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `pdf_generated_at` timestamp NULL DEFAULT NULL,
  `sent_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `kyc_verifications`
--

CREATE TABLE `kyc_verifications` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `application_id` int NOT NULL,
  `kyc_status` enum('pending','verified','failed','skipped') DEFAULT 'pending',
  `kyc_method` varchar(50) DEFAULT NULL COMMENT 'digilocker, manual, etc.',
  `mobile_number` varchar(15) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `verification_data` json DEFAULT NULL COMMENT 'Store API response data',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `late_fee_tiers`
--

CREATE TABLE `late_fee_tiers` (
  `id` int NOT NULL,
  `member_tier_id` int NOT NULL,
  `tier_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Descriptive name for this late fee tier',
  `days_overdue_start` int NOT NULL,
  `days_overdue_end` int DEFAULT NULL COMMENT 'NULL means no upper limit',
  `fee_type` enum('percentage','fixed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'percentage',
  `fee_value` decimal(10,2) NOT NULL,
  `tier_order` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `late_penalty_tiers`
--

CREATE TABLE `late_penalty_tiers` (
  `id` int NOT NULL,
  `loan_plan_id` int NOT NULL,
  `days_overdue_start` int NOT NULL COMMENT 'Starting day for this penalty tier',
  `days_overdue_end` int DEFAULT NULL COMMENT 'Ending day for this penalty tier (NULL means unlimited)',
  `penalty_percent` decimal(5,2) NOT NULL COMMENT 'Penalty percentage per day',
  `tier_order` int NOT NULL COMMENT 'Order of this tier',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loan_applications`
--

CREATE TABLE `loan_applications` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `application_number` varchar(50) NOT NULL,
  `loan_amount` decimal(12,2) NOT NULL,
  `loan_purpose` varchar(255) DEFAULT NULL,
  `loan_plan_id` int DEFAULT NULL,
  `plan_code` varchar(50) DEFAULT NULL,
  `tenure_months` int DEFAULT NULL,
  `interest_rate` decimal(5,2) DEFAULT NULL,
  `emi_amount` decimal(12,2) DEFAULT NULL,
  `status` enum('submitted','under_review','follow_up','approved','disbursal','ready_for_disbursement','disbursed','account_manager','cleared','rejected','cancelled') NOT NULL DEFAULT 'submitted',
  `rejection_reason` text,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `disbursed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `bank_id` int DEFAULT NULL,
  `user_bank_id` int DEFAULT NULL,
  `current_step` varchar(50) DEFAULT 'bank_details',
  `plan_snapshot` json DEFAULT NULL COMMENT 'Complete plan details at time of application',
  `processing_fee` decimal(12,2) DEFAULT NULL COMMENT 'Processing fee charged',
  `processing_fee_percent` decimal(5,2) DEFAULT NULL COMMENT 'Processing fee % at time of application',
  `fees_breakdown` json DEFAULT NULL COMMENT 'JSON array of all fees applied to this loan',
  `total_interest` decimal(12,2) DEFAULT NULL COMMENT 'Total interest for the loan',
  `interest_percent_per_day` decimal(10,6) DEFAULT NULL COMMENT 'Interest rate at time of application',
  `total_repayable` decimal(12,2) DEFAULT NULL COMMENT 'Total amount to be repaid',
  `disbursal_amount` decimal(10,2) DEFAULT NULL COMMENT 'Amount disbursed after deducting fees that deduct from disbursal',
  `late_fee_structure` json DEFAULT NULL COMMENT 'Late fee tiers at time of application',
  `emi_schedule` json DEFAULT NULL COMMENT 'EMI payment schedule with dates',
  `enach_done` tinyint(1) DEFAULT '0' COMMENT 'E-NACH registration completed',
  `selfie_captured` tinyint(1) DEFAULT '0' COMMENT 'Selfie image captured',
  `selfie_verified` tinyint(1) DEFAULT '0' COMMENT 'Face match verification passed',
  `selfie_image_url` varchar(500) DEFAULT NULL COMMENT 'S3 URL of captured selfie',
  `references_completed` tinyint(1) DEFAULT '0' COMMENT '3 references and alternate number provided',
  `kfs_viewed` tinyint(1) DEFAULT '0' COMMENT 'KFS document viewed',
  `agreement_signed` tinyint(1) DEFAULT '0' COMMENT 'Loan agreement e-signed',
  `post_disbursal_step` int DEFAULT '1' COMMENT 'Current step in post-disbursal flow (1-7)',
  `post_disbursal_progress` json DEFAULT NULL COMMENT 'Detailed progress tracking for each step'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `loan_application_details`
-- (See below for the actual view)
--
CREATE TABLE `loan_application_details` (
);

-- --------------------------------------------------------

--
-- Table structure for table `loan_application_documents`
--

CREATE TABLE `loan_application_documents` (
  `id` int NOT NULL,
  `loan_application_id` int NOT NULL,
  `user_id` int NOT NULL,
  `document_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Human-readable document name (e.g., "Last 3 month bank statement")',
  `document_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Document type identifier (e.g., "bank_statement", "salary_slip", "aadhar_front")',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `s3_key` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `s3_bucket` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL COMMENT 'File size in bytes',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upload_status` enum('pending','uploaded','verified','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'uploaded',
  `verification_notes` text COLLATE utf8mb4_unicode_ci,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at` timestamp NULL DEFAULT NULL,
  `verified_by` int DEFAULT NULL COMMENT 'Admin user ID who verified'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores documents uploaded for loan applications';

-- --------------------------------------------------------

--
-- Table structure for table `loan_limit_tiers`
--

CREATE TABLE `loan_limit_tiers` (
  `id` int NOT NULL,
  `tier_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `min_salary` decimal(10,2) NOT NULL,
  `max_salary` decimal(10,2) DEFAULT NULL,
  `loan_limit` decimal(10,2) NOT NULL,
  `income_range` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Income range code (e.g., 1k-20k, 20k-30k)',
  `hold_permanent` tinyint(1) DEFAULT '0' COMMENT 'Whether to hold permanently for this income range',
  `is_active` tinyint(1) DEFAULT '1',
  `tier_order` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loan_plans`
--

CREATE TABLE `loan_plans` (
  `id` int NOT NULL,
  `plan_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_type` enum('single','multi_emi') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'single',
  `repayment_days` int DEFAULT NULL COMMENT 'Total days to repay for single payment plans',
  `calculate_by_salary_date` tinyint(1) DEFAULT '0' COMMENT 'If 1, repayment date will be calculated based on user salary date',
  `emi_frequency` enum('daily','weekly','biweekly','monthly') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emi_count` int DEFAULT NULL COMMENT 'Number of EMIs',
  `total_duration_days` int DEFAULT NULL COMMENT 'Auto-calculated: total plan duration',
  `min_credit_score` int DEFAULT '0',
  `eligible_member_tiers` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON array of eligible tier names',
  `eligible_employment_types` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON array of eligible employment types',
  `interest_percent_per_day` decimal(5,4) DEFAULT '0.0010' COMMENT 'Daily interest percentage for this plan',
  `is_active` tinyint(1) DEFAULT '1',
  `is_default` tinyint(1) DEFAULT '0' COMMENT 'If 1, this plan is the default plan for new users/companies',
  `plan_order` int NOT NULL DEFAULT '1',
  `description` text COLLATE utf8mb4_unicode_ci,
  `terms_conditions` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `allow_extension` tinyint(1) DEFAULT '0' COMMENT 'Whether loan extension is allowed for this plan',
  `extension_show_from_days` int DEFAULT NULL COMMENT 'Days before due date when extension option becomes available (negative number, e.g., -5 for D-5)',
  `extension_show_till_days` int DEFAULT NULL COMMENT 'Days after due date when extension option expires (positive number, e.g., 15 for D+15)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loan_plan_fees`
--

CREATE TABLE `loan_plan_fees` (
  `id` int NOT NULL,
  `loan_plan_id` int NOT NULL,
  `fee_type_id` int NOT NULL,
  `fee_percent` decimal(5,2) NOT NULL COMMENT 'Custom fee percentage for this plan',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `member_tiers`
--

CREATE TABLE `member_tiers` (
  `id` int NOT NULL,
  `tier_name` varchar(50) NOT NULL,
  `processing_fee_percent` decimal(5,2) NOT NULL,
  `interest_percent_per_day` decimal(7,5) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tier_description` text,
  `is_active` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `member_tier_fees`
--

CREATE TABLE `member_tier_fees` (
  `id` int NOT NULL,
  `member_tier_id` int NOT NULL,
  `fee_type_id` int NOT NULL,
  `fee_percent` decimal(5,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `references`
--

CREATE TABLE `references` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `relation` varchar(50) NOT NULL,
  `status` enum('pending','verified','rejected') DEFAULT 'pending',
  `admin_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sms_configs`
--

CREATE TABLE `sms_configs` (
  `id` int NOT NULL,
  `config_name` varchar(100) NOT NULL,
  `provider` varchar(50) NOT NULL,
  `api_url` varchar(500) NOT NULL,
  `api_key` varchar(255) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_documents`
--

CREATE TABLE `student_documents` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `document_type` enum('college_id_front','college_id_back','marks_memo','educational_certificate') COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `s3_key` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `s3_bucket` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upload_status` enum('pending','uploaded','verified','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'uploaded',
  `verification_notes` text COLLATE utf8mb4_unicode_ci,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at` timestamp NULL DEFAULT NULL,
  `verified_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores student documents uploaded for verification';

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `personal_email` varchar(255) DEFAULT NULL,
  `personal_email_verified` tinyint(1) DEFAULT '0',
  `official_email` varchar(255) DEFAULT NULL,
  `official_email_verified` tinyint(1) DEFAULT '0',
  `residence_type` enum('owned','rented') DEFAULT NULL COMMENT 'Residence type: owned or rented',
  `phone` varchar(20) NOT NULL,
  `pincode` varchar(6) DEFAULT NULL,
  `address_data` json DEFAULT NULL COMMENT 'Complete address data from Digitap API in JSON format',
  `latlong` varchar(100) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `pan_number` varchar(10) DEFAULT NULL COMMENT 'PAN card number',
  `marital_status` enum('single','married','divorced','widowed') DEFAULT NULL,
  `spoken_language` varchar(255) DEFAULT NULL COMMENT 'Comma-separated list of spoken languages',
  `work_experience_range` varchar(10) DEFAULT NULL COMMENT 'Work experience range: 0-2, 2-5, 5-8, 8+',
  `salary_date` int DEFAULT NULL,
  `monthly_net_income` decimal(10,2) DEFAULT NULL COMMENT 'Monthly net income in rupees',
  `status` enum('active','inactive','suspended') DEFAULT 'active',
  `eligibility_hold_until` datetime DEFAULT NULL,
  `eligibility_check_count` int DEFAULT '0',
  `credit_score` int DEFAULT '640',
  `member_tier_id` int DEFAULT NULL,
  `loan_limit` decimal(10,2) DEFAULT '0.00',
  `experian_score` int DEFAULT NULL,
  `email_verified` tinyint(1) DEFAULT '0',
  `phone_verified` tinyint(1) DEFAULT '0',
  `kyc_completed` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `profile_completion_step` int NOT NULL DEFAULT '0',
  `profile_completed` tinyint(1) DEFAULT '0',
  `eligibility_status` enum('eligible','not_eligible','pending') DEFAULT 'pending',
  `eligibility_reason` text,
  `eligibility_retry_date` datetime DEFAULT NULL,
  `employment_type` enum('salaried','student','self_employed','part_time','freelancer','homemaker','retired','no_job','others') DEFAULT NULL,
  `selected_loan_plan_id` int DEFAULT NULL COMMENT 'User selected loan plan ID. NULL means use company default or system default.',
  `income_range` varchar(50) DEFAULT NULL,
  `application_hold_reason` varchar(255) DEFAULT NULL,
  `hold_until_date` date DEFAULT NULL,
  `college_name` varchar(255) DEFAULT NULL,
  `graduation_status` enum('graduated','not_graduated') DEFAULT NULL,
  `graduation_date` date DEFAULT NULL COMMENT 'Date when student marked as graduated',
  `alternate_mobile` varchar(15) DEFAULT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `company_email` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_bank_statements`
--

CREATE TABLE `user_bank_statements` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `client_ref_num` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_id` int DEFAULT NULL,
  `txn_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile_number` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upload_method` enum('online','manual','aa') COLLATE utf8mb4_unicode_ci DEFAULT 'online',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `digitap_url` text COLLATE utf8mb4_unicode_ci,
  `expires_at` timestamp NULL DEFAULT NULL,
  `status` enum('pending','processing','completed','failed','InProgress') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `transaction_data` json DEFAULT NULL,
  `report_data` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores user bank statements - one per user (profile level)';

-- --------------------------------------------------------

--
-- Table structure for table `user_config`
--

CREATE TABLE `user_config` (
  `id` int NOT NULL,
  `config_key` varchar(100) NOT NULL,
  `config_value` text NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `user_profiles`
-- (See below for the actual view)
--
CREATE TABLE `user_profiles` (
);

-- --------------------------------------------------------

--
-- Table structure for table `user_validation_history`
--

CREATE TABLE `user_validation_history` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `loan_application_id` int DEFAULT NULL,
  `admin_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_type` enum('need_document','process','not_process','cancel') COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_details` json NOT NULL,
  `status` enum('pending','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `validation_options`
--

CREATE TABLE `validation_options` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('need_document','not_process','process','cancel') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `validation_status`
--

CREATE TABLE `validation_status` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `loan_application_id` int DEFAULT NULL,
  `kyc_verification` enum('pending','in_progress','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `income_verification` enum('pending','in_progress','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `reference_verification` enum('pending','in_progress','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `address_verification` enum('pending','in_progress','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `employment_verification` enum('pending','in_progress','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `other_verification` enum('pending','in_progress','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `kyc_percentage` int DEFAULT '0',
  `income_percentage` int DEFAULT '0',
  `reference_percentage` int DEFAULT '0',
  `address_percentage` int DEFAULT '0',
  `employment_percentage` int DEFAULT '0',
  `other_percentage` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `verification_records`
--

CREATE TABLE `verification_records` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `document_type` varchar(50) NOT NULL,
  `document_number` varchar(255) NOT NULL,
  `document_path` varchar(500) DEFAULT NULL,
  `verification_status` enum('pending','verified','rejected') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `webhook_logs`
--

CREATE TABLE `webhook_logs` (
  `id` int NOT NULL,
  `webhook_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type: bank_data_webhook, txn_completed_cburl, digiwebhook, etc.',
  `http_method` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'GET, POST, PUT, etc.',
  `endpoint` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Webhook endpoint path',
  `headers` json DEFAULT NULL COMMENT 'Request headers',
  `query_params` json DEFAULT NULL COMMENT 'Query parameters (for GET requests)',
  `body_data` json DEFAULT NULL COMMENT 'Request body (for POST requests)',
  `raw_payload` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Complete raw payload as string',
  `request_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Extracted request_id if present',
  `client_ref_num` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Extracted client_ref_num if present',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Extracted status if present',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Client IP address',
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User agent string',
  `processed` tinyint(1) DEFAULT '0' COMMENT 'Whether webhook was successfully processed',
  `processing_error` text COLLATE utf8mb4_unicode_ci COMMENT 'Error message if processing failed',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure for view `loan_application_details`
--
DROP TABLE IF EXISTS `loan_application_details`;

CREATE ALGORITHM=UNDEFINED DEFINER=`pocket`@`%` SQL SECURITY DEFINER VIEW `loan_application_details`  AS SELECT `la`.`id` AS `id`, `la`.`user_id` AS `user_id`, `la`.`application_number` AS `application_number`, `la`.`loan_amount` AS `loan_amount`, `la`.`loan_purpose` AS `loan_purpose`, `la`.`tenure_months` AS `tenure_months`, `la`.`interest_rate` AS `interest_rate`, `la`.`emi_amount` AS `emi_amount`, `la`.`status` AS `status`, `la`.`rejection_reason` AS `rejection_reason`, `la`.`approved_at` AS `approved_at`, `la`.`disbursed_at` AS `disbursed_at`, `la`.`created_at` AS `created_at`, `u`.`first_name` AS `first_name`, `u`.`last_name` AS `last_name`, `u`.`email` AS `email`, `u`.`phone` AS `phone`, `ed`.`company_name` AS `company_name`, `ed`.`monthly_salary` AS `monthly_salary` FROM ((`loan_applications` `la` join `users` `u` on((`la`.`user_id` = `u`.`id`))) left join `employment_details` `ed` on((`u`.`id` = `ed`.`user_id`))) ;

-- --------------------------------------------------------

--
-- Structure for view `user_profiles`
--
DROP TABLE IF EXISTS `user_profiles`;

CREATE ALGORITHM=UNDEFINED DEFINER=`pocket`@`%` SQL SECURITY DEFINER VIEW `user_profiles`  AS SELECT `u`.`id` AS `id`, `u`.`email` AS `email`, `u`.`phone` AS `phone`, `u`.`first_name` AS `first_name`, `u`.`last_name` AS `last_name`, `u`.`date_of_birth` AS `date_of_birth`, `u`.`gender` AS `gender`, `u`.`marital_status` AS `marital_status`, `u`.`status` AS `status`, `u`.`email_verified` AS `email_verified`, `u`.`phone_verified` AS `phone_verified`, `u`.`kyc_completed` AS `kyc_completed`, `u`.`created_at` AS `created_at`, `u`.`last_login_at` AS `last_login_at`, `ed`.`employment_type` AS `employment_type`, `ed`.`company_name` AS `company_name`, `ed`.`designation` AS `designation`, `ed`.`monthly_salary` AS `monthly_salary`, `ed`.`work_experience_years` AS `work_experience_years`, `ed`.`work_experience_months` AS `work_experience_months`, `ed`.`employment_verified` AS `employment_verified`, `fd`.`monthly_income` AS `monthly_income`, `fd`.`monthly_expenses` AS `monthly_expenses`, `fd`.`existing_loans` AS `existing_loans`, `fd`.`credit_score` AS `credit_score`, `fd`.`bank_name` AS `bank_name`, `fd`.`account_number` AS `account_number`, `fd`.`ifsc_code` AS `ifsc_code`, `fd`.`account_holder_name` AS `account_holder_name`, `fd`.`account_type` AS `account_type`, `fd`.`financial_verified` AS `financial_verified` FROM ((`users` `u` left join `employment_details` `ed` on((`u`.`id` = `ed`.`user_id`))) left join `financial_details` `fd` on((`u`.`id` = `fd`.`user_id`))) ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_timestamp` (`timestamp`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_admin_id` (`admin_id`),
  ADD KEY `idx_priority` (`priority`),
  ADD KEY `idx_processed` (`processed`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_timestamp_type` (`timestamp`,`type`),
  ADD KEY `idx_user_timestamp` (`user_id`,`timestamp`),
  ADD KEY `idx_admin_timestamp` (`admin_id`,`timestamp`),
  ADD KEY `idx_type_priority` (`type`,`priority`);

--
-- Indexes for table `addresses`
--
ALTER TABLE `addresses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `admin_login_history`
--
ALTER TABLE `admin_login_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_admin_id` (`admin_id`),
  ADD KEY `idx_login_time` (`login_time`),
  ADD KEY `idx_success` (`success`);

--
-- Indexes for table `application_employment_details`
--
ALTER TABLE `application_employment_details`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_application` (`application_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_application_id` (`application_id`);

--
-- Indexes for table `bank_details`
--
ALTER TABLE `bank_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_primary_account` (`is_primary`),
  ADD KEY `idx_verified` (`is_verified`),
  ADD KEY `idx_bank_name` (`bank_name`);

--
-- Indexes for table `cloud_configs`
--
ALTER TABLE `cloud_configs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_primary` (`is_primary`,`status`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_company_name` (`company_name`),
  ADD KEY `idx_company_name` (`company_name`),
  ADD KEY `idx_search_count` (`search_count`),
  ADD KEY `default_loan_plan_id` (`default_loan_plan_id`);

--
-- Indexes for table `credit_checks`
--
ALTER TABLE `credit_checks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_credit_score` (`credit_score`),
  ADD KEY `idx_is_eligible` (`is_eligible`);

--
-- Indexes for table `digitap_bank_statements`
--
ALTER TABLE `digitap_bank_statements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `client_ref_num` (`client_ref_num`),
  ADD UNIQUE KEY `unique_application` (`application_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_application_id` (`application_id`),
  ADD KEY `idx_client_ref_num` (`client_ref_num`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `digitap_responses`
--
ALTER TABLE `digitap_responses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_mobile` (`mobile_number`),
  ADD KEY `idx_score` (`experian_score`);

--
-- Indexes for table `eligibility_config`
--
ALTER TABLE `eligibility_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `config_key` (`config_key`);

--
-- Indexes for table `email_configs`
--
ALTER TABLE `email_configs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_primary` (`is_primary`,`status`);

--
-- Indexes for table `email_otp_verification`
--
ALTER TABLE `email_otp_verification`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_email_type` (`email`,`type`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `employment_details`
--
ALTER TABLE `employment_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `enach_registrations`
--
ALTER TABLE `enach_registrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_enach` (`user_id`) COMMENT 'One e-NACH registration per user',
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_application_id` (`application_id`),
  ADD KEY `idx_bank_detail_id` (`bank_detail_id`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `fee_types`
--
ALTER TABLE `fee_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `fee_name` (`fee_name`);

--
-- Indexes for table `kfs_email_log`
--
ALTER TABLE `kfs_email_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_loan_id` (`loan_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_sent_at` (`sent_at`);

--
-- Indexes for table `kyc_verifications`
--
ALTER TABLE `kyc_verifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_application_id` (`application_id`),
  ADD KEY `idx_kyc_status` (`kyc_status`);

--
-- Indexes for table `late_fee_tiers`
--
ALTER TABLE `late_fee_tiers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_member_tier` (`member_tier_id`),
  ADD KEY `idx_days` (`days_overdue_start`,`days_overdue_end`);

--
-- Indexes for table `late_penalty_tiers`
--
ALTER TABLE `late_penalty_tiers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_loan_plan` (`loan_plan_id`),
  ADD KEY `idx_order` (`loan_plan_id`,`tier_order`);

--
-- Indexes for table `loan_applications`
--
ALTER TABLE `loan_applications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `application_number` (`application_number`),
  ADD KEY `approved_by` (`approved_by`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_application_number` (`application_number`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_loan_applications_bank_id` (`bank_id`),
  ADD KEY `idx_plan` (`loan_plan_id`),
  ADD KEY `idx_loan_applications_disbursal_amount` (`disbursal_amount`);

--
-- Indexes for table `loan_application_documents`
--
ALTER TABLE `loan_application_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_loan_application_id` (`loan_application_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_upload_status` (`upload_status`),
  ADD KEY `idx_document_type` (`document_type`);

--
-- Indexes for table `loan_limit_tiers`
--
ALTER TABLE `loan_limit_tiers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_tier_order` (`tier_order`),
  ADD UNIQUE KEY `idx_income_range` (`income_range`);

--
-- Indexes for table `loan_plans`
--
ALTER TABLE `loan_plans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `plan_code` (`plan_code`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_type` (`plan_type`),
  ADD KEY `idx_order` (`plan_order`);

--
-- Indexes for table `loan_plan_fees`
--
ALTER TABLE `loan_plan_fees`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_plan_fee` (`loan_plan_id`,`fee_type_id`),
  ADD KEY `idx_loan_plan` (`loan_plan_id`),
  ADD KEY `idx_fee_type` (`fee_type_id`);

--
-- Indexes for table `member_tiers`
--
ALTER TABLE `member_tiers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tier_name` (`tier_name`);

--
-- Indexes for table `member_tier_fees`
--
ALTER TABLE `member_tier_fees`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_tier_fee` (`member_tier_id`,`fee_type_id`),
  ADD KEY `fee_type_id` (`fee_type_id`);

--
-- Indexes for table `references`
--
ALTER TABLE `references`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_refs_admin` (`admin_id`);

--
-- Indexes for table `sms_configs`
--
ALTER TABLE `sms_configs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_primary` (`is_primary`,`status`);

--
-- Indexes for table `student_documents`
--
ALTER TABLE `student_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_upload_status` (`upload_status`),
  ADD KEY `idx_document_type` (`document_type`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `email_2` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_phone` (`phone`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_profile_completion_step` (`profile_completion_step`),
  ADD KEY `idx_member_tier` (`member_tier_id`),
  ADD KEY `idx_experian_score` (`experian_score`),
  ADD KEY `selected_loan_plan_id` (`selected_loan_plan_id`);

--
-- Indexes for table `user_bank_statements`
--
ALTER TABLE `user_bank_statements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD UNIQUE KEY `client_ref_num` (`client_ref_num`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_client_ref_num` (`client_ref_num`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_request_id` (`request_id`),
  ADD KEY `idx_txn_id` (`txn_id`);

--
-- Indexes for table `user_config`
--
ALTER TABLE `user_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `config_key` (`config_key`);

--
-- Indexes for table `user_validation_history`
--
ALTER TABLE `user_validation_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_loan_application_id` (`loan_application_id`),
  ADD KEY `idx_admin_id` (`admin_id`),
  ADD KEY `idx_action_type` (`action_type`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `validation_options`
--
ALTER TABLE `validation_options`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `validation_status`
--
ALTER TABLE `validation_status`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_loan` (`user_id`,`loan_application_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_loan_application_id` (`loan_application_id`);

--
-- Indexes for table `verification_records`
--
ALTER TABLE `verification_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_document` (`user_id`,`document_type`);

--
-- Indexes for table `webhook_logs`
--
ALTER TABLE `webhook_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_webhook_type` (`webhook_type`),
  ADD KEY `idx_http_method` (`http_method`),
  ADD KEY `idx_request_id` (`request_id`),
  ADD KEY `idx_client_ref_num` (`client_ref_num`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_processed` (`processed`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `addresses`
--
ALTER TABLE `addresses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `application_employment_details`
--
ALTER TABLE `application_employment_details`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bank_details`
--
ALTER TABLE `bank_details`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cloud_configs`
--
ALTER TABLE `cloud_configs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `credit_checks`
--
ALTER TABLE `credit_checks`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `digitap_bank_statements`
--
ALTER TABLE `digitap_bank_statements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `digitap_responses`
--
ALTER TABLE `digitap_responses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `eligibility_config`
--
ALTER TABLE `eligibility_config`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `email_configs`
--
ALTER TABLE `email_configs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `email_otp_verification`
--
ALTER TABLE `email_otp_verification`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `employment_details`
--
ALTER TABLE `employment_details`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `enach_registrations`
--
ALTER TABLE `enach_registrations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `fee_types`
--
ALTER TABLE `fee_types`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `kfs_email_log`
--
ALTER TABLE `kfs_email_log`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `kyc_verifications`
--
ALTER TABLE `kyc_verifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `late_fee_tiers`
--
ALTER TABLE `late_fee_tiers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `late_penalty_tiers`
--
ALTER TABLE `late_penalty_tiers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `loan_applications`
--
ALTER TABLE `loan_applications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `loan_application_documents`
--
ALTER TABLE `loan_application_documents`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `loan_limit_tiers`
--
ALTER TABLE `loan_limit_tiers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `loan_plans`
--
ALTER TABLE `loan_plans`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `loan_plan_fees`
--
ALTER TABLE `loan_plan_fees`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `member_tiers`
--
ALTER TABLE `member_tiers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `member_tier_fees`
--
ALTER TABLE `member_tier_fees`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `references`
--
ALTER TABLE `references`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sms_configs`
--
ALTER TABLE `sms_configs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_documents`
--
ALTER TABLE `student_documents`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_bank_statements`
--
ALTER TABLE `user_bank_statements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_config`
--
ALTER TABLE `user_config`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_validation_history`
--
ALTER TABLE `user_validation_history`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `validation_options`
--
ALTER TABLE `validation_options`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `validation_status`
--
ALTER TABLE `validation_status`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `verification_records`
--
ALTER TABLE `verification_records`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `webhook_logs`
--
ALTER TABLE `webhook_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `addresses`
--
ALTER TABLE `addresses`
  ADD CONSTRAINT `addresses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `admin_login_history`
--
ALTER TABLE `admin_login_history`
  ADD CONSTRAINT `admin_login_history_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `application_employment_details`
--
ALTER TABLE `application_employment_details`
  ADD CONSTRAINT `application_employment_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `application_employment_details_ibfk_2` FOREIGN KEY (`application_id`) REFERENCES `loan_applications` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `companies`
--
ALTER TABLE `companies`
  ADD CONSTRAINT `companies_ibfk_1` FOREIGN KEY (`default_loan_plan_id`) REFERENCES `loan_plans` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `credit_checks`
--
ALTER TABLE `credit_checks`
  ADD CONSTRAINT `credit_checks_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `digitap_responses`
--
ALTER TABLE `digitap_responses`
  ADD CONSTRAINT `digitap_responses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `email_otp_verification`
--
ALTER TABLE `email_otp_verification`
  ADD CONSTRAINT `email_otp_verification_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `employment_details`
--
ALTER TABLE `employment_details`
  ADD CONSTRAINT `employment_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `enach_registrations`
--
ALTER TABLE `enach_registrations`
  ADD CONSTRAINT `enach_registrations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `enach_registrations_ibfk_2` FOREIGN KEY (`application_id`) REFERENCES `loan_applications` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `enach_registrations_ibfk_3` FOREIGN KEY (`bank_detail_id`) REFERENCES `bank_details` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `kfs_email_log`
--
ALTER TABLE `kfs_email_log`
  ADD CONSTRAINT `kfs_email_log_ibfk_1` FOREIGN KEY (`loan_id`) REFERENCES `loan_applications` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `kyc_verifications`
--
ALTER TABLE `kyc_verifications`
  ADD CONSTRAINT `kyc_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `kyc_verifications_ibfk_2` FOREIGN KEY (`application_id`) REFERENCES `loan_applications` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `late_fee_tiers`
--
ALTER TABLE `late_fee_tiers`
  ADD CONSTRAINT `late_fee_tiers_ibfk_1` FOREIGN KEY (`member_tier_id`) REFERENCES `member_tiers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `late_penalty_tiers`
--
ALTER TABLE `late_penalty_tiers`
  ADD CONSTRAINT `late_penalty_tiers_ibfk_1` FOREIGN KEY (`loan_plan_id`) REFERENCES `loan_plans` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `loan_applications`
--
ALTER TABLE `loan_applications`
  ADD CONSTRAINT `fk_loan_applications_bank_id` FOREIGN KEY (`bank_id`) REFERENCES `bank_details` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_loan_plan` FOREIGN KEY (`loan_plan_id`) REFERENCES `loan_plans` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `loan_applications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `loan_applications_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `loan_application_documents`
--
ALTER TABLE `loan_application_documents`
  ADD CONSTRAINT `loan_application_documents_ibfk_1` FOREIGN KEY (`loan_application_id`) REFERENCES `loan_applications` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `loan_application_documents_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `loan_plan_fees`
--
ALTER TABLE `loan_plan_fees`
  ADD CONSTRAINT `loan_plan_fees_ibfk_1` FOREIGN KEY (`loan_plan_id`) REFERENCES `loan_plans` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `loan_plan_fees_ibfk_2` FOREIGN KEY (`fee_type_id`) REFERENCES `fee_types` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `member_tier_fees`
--
ALTER TABLE `member_tier_fees`
  ADD CONSTRAINT `member_tier_fees_ibfk_1` FOREIGN KEY (`member_tier_id`) REFERENCES `member_tiers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `member_tier_fees_ibfk_2` FOREIGN KEY (`fee_type_id`) REFERENCES `fee_types` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `references`
--
ALTER TABLE `references`
  ADD CONSTRAINT `fk_refs_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `student_documents`
--
ALTER TABLE `student_documents`
  ADD CONSTRAINT `student_documents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_user_member_tier` FOREIGN KEY (`member_tier_id`) REFERENCES `member_tiers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`selected_loan_plan_id`) REFERENCES `loan_plans` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_bank_statements`
--
ALTER TABLE `user_bank_statements`
  ADD CONSTRAINT `user_bank_statements_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_validation_history`
--
ALTER TABLE `user_validation_history`
  ADD CONSTRAINT `user_validation_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_validation_history_ibfk_2` FOREIGN KEY (`loan_application_id`) REFERENCES `loan_applications` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `user_validation_history_ibfk_3` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `validation_status`
--
ALTER TABLE `validation_status`
  ADD CONSTRAINT `validation_status_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `validation_status_ibfk_2` FOREIGN KEY (`loan_application_id`) REFERENCES `loan_applications` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `verification_records`
--
ALTER TABLE `verification_records`
  ADD CONSTRAINT `verification_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
