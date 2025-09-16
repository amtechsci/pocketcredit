-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Sep 14, 2025 at 06:14 PM
-- Server version: 8.0.43-0ubuntu0.24.04.1
-- PHP Version: 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pocket`
--

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

--
-- Dumping data for table `addresses`
--

INSERT INTO `addresses` (`id`, `user_id`, `address_type`, `address_line1`, `address_line2`, `city`, `state`, `pincode`, `country`, `is_primary`, `verified`, `created_at`, `updated_at`) VALUES
(1, 4, 'current', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 08:45:36', '2025-09-14 08:45:36'),
(2, 4, 'permanent', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 08:45:36', '2025-09-14 08:45:36'),
(3, 6, 'current', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 11:23:22', '2025-09-14 11:23:22'),
(4, 6, 'permanent', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 11:23:22', '2025-09-14 11:23:22'),
(5, 5, 'current', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 11:34:30', '2025-09-14 11:34:30'),
(6, 5, 'permanent', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 11:34:30', '2025-09-14 11:34:30'),
(7, 7, 'current', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 11:45:24', '2025-09-14 11:45:24'),
(8, 7, 'permanent', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 11:45:25', '2025-09-14 11:45:25'),
(9, 8, 'current', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 11:54:35', '2025-09-14 11:54:35'),
(10, 8, 'permanent', 'Tuglakabad', 'Bazaar mohala', 'Delhi', 'Delhi', '110044', 'India', 1, 0, '2025-09-14 11:54:35', '2025-09-14 11:54:35');

-- --------------------------------------------------------

--
-- Table structure for table `admin_users`
--

CREATE TABLE `admin_users` (
  `id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `role` enum('super_admin','admin','manager','support') DEFAULT 'support',
  `permissions` json DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `admin_users`
--

INSERT INTO `admin_users` (`id`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `permissions`, `status`, `last_login_at`, `created_at`, `updated_at`) VALUES
(1, 'admin@pocketcredit.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System', 'Administrator', 'super_admin', '{\"all\": true}', 'active', NULL, '2025-09-13 11:43:35', '2025-09-13 11:43:35');

-- --------------------------------------------------------

--
-- Table structure for table `api_logs`
--

CREATE TABLE `api_logs` (
  `id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `endpoint` varchar(255) NOT NULL,
  `method` varchar(10) NOT NULL,
  `request_body` json DEFAULT NULL,
  `response_body` json DEFAULT NULL,
  `status_code` int DEFAULT NULL,
  `response_time_ms` int DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
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
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `loan_application_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `bank_details`
--

INSERT INTO `bank_details` (`id`, `user_id`, `bank_name`, `account_number`, `ifsc_code`, `account_holder_name`, `account_type`, `branch_name`, `is_primary`, `is_verified`, `verification_date`, `created_at`, `updated_at`, `loan_application_id`) VALUES
(1, 1, 'HDFC Bank', '1234567890', 'HDFC0001234', 'Atul Mishra', 'savings', 'Main Branch', 1, 1, NULL, '2025-09-14 09:37:21', '2025-09-14 09:37:21', NULL),
(2, 4, 'Bank (KKBK)', '23232121232', 'KKBK0004605', 'Atul Mishra', 'savings', NULL, 1, 0, NULL, '2025-09-14 16:40:00', '2025-09-14 16:47:15', 8);

-- --------------------------------------------------------

--
-- Table structure for table `digital_signatures`
--

CREATE TABLE `digital_signatures` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `signature_data` longtext,
  `signature_type` enum('biometric','digital','otp_verified') NOT NULL,
  `document_type` varchar(100) DEFAULT NULL,
  `verification_status` enum('pending','verified','rejected') DEFAULT 'pending',
  `verified_by` int DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employment_details`
--

CREATE TABLE `employment_details` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `employment_type` enum('salaried','self_employed','business','unemployed') NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `monthly_salary` decimal(12,2) DEFAULT NULL,
  `work_experience_years` int DEFAULT '0',
  `work_experience_months` int DEFAULT '0',
  `salary_date` int DEFAULT NULL,
  `employment_verified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ;

--
-- Dumping data for table `employment_details`
--

INSERT INTO `employment_details` (`id`, `user_id`, `employment_type`, `company_name`, `designation`, `monthly_salary`, `work_experience_years`, `work_experience_months`, `salary_date`, `employment_verified`, `created_at`, `updated_at`) VALUES
(1, 8, 'salaried', 'Atul', 'Team lead', 50000.00, 0, 0, 3, 0, '2025-09-14 12:00:57', '2025-09-14 12:00:57'),
(2, 4, 'salaried', 'Atul', 'Team lead', 80000.00, 0, 0, 2, 0, '2025-09-14 12:24:25', '2025-09-14 12:24:25');

-- --------------------------------------------------------

--
-- Table structure for table `financial_details`
--

CREATE TABLE `financial_details` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `monthly_income` decimal(12,2) DEFAULT NULL,
  `monthly_expenses` decimal(12,2) DEFAULT NULL,
  `existing_loans` decimal(12,2) DEFAULT '0.00',
  `credit_score` int DEFAULT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `ifsc_code` varchar(20) DEFAULT NULL,
  `account_holder_name` varchar(255) DEFAULT NULL,
  `account_type` enum('savings','current','salary') DEFAULT 'savings',
  `is_primary` tinyint(1) DEFAULT '0',
  `financial_verified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `financial_details`
--

INSERT INTO `financial_details` (`id`, `user_id`, `monthly_income`, `monthly_expenses`, `existing_loans`, `credit_score`, `bank_name`, `account_number`, `ifsc_code`, `account_holder_name`, `account_type`, `is_primary`, `financial_verified`, `created_at`, `updated_at`) VALUES
(3, 1, 75000.00, 45000.00, 0.00, 720, NULL, NULL, NULL, NULL, 'savings', 0, 1, '2025-09-14 09:37:21', '2025-09-14 09:37:21'),
(4, 1, 75000.00, 45000.00, 0.00, 720, NULL, NULL, NULL, NULL, 'savings', 0, 1, '2025-09-14 09:42:05', '2025-09-14 09:42:05');

-- --------------------------------------------------------

--
-- Table structure for table `loans`
--

CREATE TABLE `loans` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `loan_application_id` int NOT NULL,
  `loan_number` varchar(20) NOT NULL,
  `loan_amount` decimal(12,2) NOT NULL,
  `disbursed_amount` decimal(12,2) DEFAULT NULL,
  `interest_rate` decimal(5,2) NOT NULL,
  `tenure_months` int NOT NULL,
  `status` enum('active','closed','settled') NOT NULL DEFAULT 'active',
  `disbursed_at` timestamp NULL DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loan_applications`
--

CREATE TABLE `loan_applications` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `application_number` varchar(20) NOT NULL,
  `loan_amount` decimal(12,2) NOT NULL,
  `loan_purpose` varchar(255) DEFAULT NULL,
  `tenure_months` int NOT NULL,
  `interest_rate` decimal(5,2) DEFAULT NULL,
  `emi_amount` decimal(12,2) DEFAULT NULL,
  `status` enum('draft','submitted','bank_details_provided','under_review','approved','rejected','disbursed') DEFAULT 'draft',
  `rejection_reason` text,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `disbursed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `bank_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `loan_applications`
--

INSERT INTO `loan_applications` (`id`, `user_id`, `application_number`, `loan_amount`, `loan_purpose`, `tenure_months`, `interest_rate`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `disbursed_at`, `created_at`, `updated_at`, `bank_id`) VALUES
(8, 4, 'LA1757858631275384', 2000.00, 'Personal', 30, NULL, 'submitted', NULL, NULL, NULL, NULL, '2025-09-14 14:03:51', '2025-09-14 16:47:15', 2);

-- --------------------------------------------------------

--
-- Stand-in structure for view `loan_application_details`
-- (See below for the actual view)
--
CREATE TABLE `loan_application_details` (
  `id` int,
  `user_id` int,
  `application_number` varchar(20),
  `loan_amount` decimal(12,2),
  `loan_purpose` varchar(255),
  `tenure_months` int,
  `interest_rate` decimal(5,2),
  `emi_amount` decimal(12,2),
  `status` enum('draft','submitted','bank_details_provided','under_review','approved','rejected','disbursed'),
  `rejection_reason` text,
  `approved_at` timestamp NULL,
  `disbursed_at` timestamp NULL,
  `created_at` timestamp NULL,
  `first_name` varchar(100),
  `last_name` varchar(100),
  `email` varchar(255),
  `phone` varchar(20),
  `company_name` varchar(255),
  `monthly_salary` decimal(12,2)
);

-- --------------------------------------------------------

--
-- Table structure for table `member_tiers`
--

CREATE TABLE `member_tiers` (
  `id` int NOT NULL,
  `tier_name` varchar(50) NOT NULL,
  `tier_display_name` varchar(100) NOT NULL,
  `max_loan_amount_type` enum('fixed','percentage') DEFAULT 'fixed',
  `max_loan_amount` decimal(12,2) DEFAULT NULL,
  `interest_rate_daily` decimal(8,4) NOT NULL,
  `processing_fee` decimal(5,2) NOT NULL,
  `benefits` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `member_tiers`
--

INSERT INTO `member_tiers` (`id`, `tier_name`, `tier_display_name`, `max_loan_amount_type`, `max_loan_amount`, `interest_rate_daily`, `processing_fee`, `benefits`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'bronze', 'Bronze Member', 'fixed', 500000.00, 0.0411, 2.00, '{\"features\": [\"Basic loan processing\", \"Standard customer support\"], \"discounts\": []}', 1, '2025-09-13 11:43:35', '2025-09-13 12:00:21'),
(2, 'silver', 'Silver Member', 'percentage', 80.00, 0.0342, 1.50, '{\"features\": [\"Priority processing\", \"Dedicated support\"], \"discounts\": [\"Processing fee discount\"]}', 1, '2025-09-13 11:43:35', '2025-09-13 12:00:21'),
(3, 'gold', 'Gold Member', 'percentage', 120.00, 0.0274, 1.00, '{\"features\": [\"VIP processing\", \"Personal loan manager\"], \"discounts\": [\"Processing fee waiver\", \"Interest rate discount\"]}', 1, '2025-09-13 11:43:35', '2025-09-13 12:00:21'),
(4, 'platinum', 'Platinum Member', 'fixed', 5000000.00, 0.0205, 0.50, '{\"features\": [\"Instant approval\", \"Premium support\", \"Custom rates\"], \"discounts\": [\"All fees waived\", \"Best rates\"]}', 1, '2025-09-13 11:43:35', '2025-09-13 12:00:21');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `notification_type` enum('info','warning','success','error') DEFAULT 'info',
  `channel` enum('email','sms','push','in_app') NOT NULL,
  `status` enum('pending','sent','delivered','failed') DEFAULT 'pending',
  `sent_at` timestamp NULL DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `notification_type`, `channel`, `status`, `sent_at`, `read_at`, `created_at`, `updated_at`) VALUES
(1, 1, 'EMI Payment Successful', 'Your EMI payment of ₹15,000 has been processed successfully.', 'success', 'in_app', 'delivered', '2025-09-14 09:37:21', NULL, '2025-09-14 09:37:21', '2025-09-14 09:37:21'),
(2, 1, 'Credit Score Updated', 'Your credit score has been updated to 720. Great job!', 'info', 'in_app', 'delivered', '2025-09-14 09:37:21', NULL, '2025-09-14 09:37:21', '2025-09-14 09:37:21'),
(3, 1, 'Loan Application Approved', 'Congratulations! Your loan application has been approved.', 'success', 'in_app', 'delivered', '2025-09-14 09:37:21', NULL, '2025-09-14 09:37:21', '2025-09-14 09:37:21'),
(4, 1, 'EMI Payment Successful', 'Your EMI payment of ₹15,000 has been processed successfully.', 'success', 'in_app', 'delivered', '2025-09-14 09:42:05', NULL, '2025-09-14 09:42:05', '2025-09-14 09:42:05'),
(5, 1, 'Credit Score Updated', 'Your credit score has been updated to 720. Great job!', 'info', 'in_app', 'delivered', '2025-09-14 09:42:05', NULL, '2025-09-14 09:42:05', '2025-09-14 09:42:05'),
(6, 1, 'Loan Application Approved', 'Congratulations! Your loan application has been approved.', 'success', 'in_app', 'delivered', '2025-09-14 09:42:05', NULL, '2025-09-14 09:42:05', '2025-09-14 09:42:05');

-- --------------------------------------------------------

--
-- Table structure for table `references`
--

CREATE TABLE `references` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `loan_application_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `relation` varchar(50) NOT NULL,
  `status` enum('pending','verified','rejected') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `id` int NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `description` text,
  `data_type` enum('string','number','boolean','json') DEFAULT 'string',
  `is_public` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `description`, `data_type`, `is_public`, `created_at`, `updated_at`) VALUES
(1, 'app_name', 'Pocket Credit', 'Application name', 'string', 1, '2025-09-13 11:43:35', '2025-09-13 11:43:35'),
(2, 'app_version', '1.0.0', 'Application version', 'string', 1, '2025-09-13 11:43:35', '2025-09-13 11:43:35'),
(3, 'max_loan_amount', '5000000', 'Maximum loan amount allowed', 'number', 1, '2025-09-13 11:43:35', '2025-09-13 11:43:35'),
(4, 'min_loan_amount', '50000', 'Minimum loan amount allowed', 'number', 1, '2025-09-13 11:43:35', '2025-09-13 11:43:35'),
(5, 'default_interest_rate', '15.0', 'Default interest rate percentage', 'number', 1, '2025-09-13 11:43:35', '2025-09-13 11:43:35'),
(6, 'processing_fee_rate', '2.0', 'Default processing fee percentage', 'number', 1, '2025-09-13 11:43:35', '2025-09-13 11:43:35'),
(7, 'otp_expiry_minutes', '5', 'OTP expiry time in minutes', 'number', 0, '2025-09-13 11:43:35', '2025-09-13 11:43:35'),
(8, 'max_login_attempts', '5', 'Maximum login attempts before lockout', 'number', 0, '2025-09-13 11:43:35', '2025-09-13 11:43:35');

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `loan_id` int DEFAULT NULL,
  `transaction_type` enum('disbursement','emi_payment','prepayment','penalty','refund') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `payment_method` enum('upi','net_banking','card','nacha','cash') NOT NULL,
  `payment_gateway` varchar(100) DEFAULT NULL,
  `gateway_transaction_id` varchar(200) DEFAULT NULL,
  `status` enum('pending','success','failed','refunded') DEFAULT 'pending',
  `failure_reason` text,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `transactions`
--

INSERT INTO `transactions` (`id`, `user_id`, `loan_id`, `transaction_type`, `amount`, `transaction_id`, `payment_method`, `payment_gateway`, `gateway_transaction_id`, `status`, `failure_reason`, `processed_at`, `created_at`, `updated_at`) VALUES
(1, 1, NULL, 'emi_payment', 15000.00, 'TXN001', 'upi', 'razorpay', NULL, 'success', NULL, '2023-09-15 10:00:00', '2025-09-14 09:37:21', '2025-09-14 09:37:21'),
(2, 1, NULL, 'emi_payment', 15000.00, 'TXN002', 'upi', 'razorpay', NULL, 'success', NULL, '2023-10-15 10:00:00', '2025-09-14 09:37:21', '2025-09-14 09:37:21'),
(3, 1, NULL, 'emi_payment', 15000.00, 'TXN003', 'upi', 'razorpay', NULL, 'success', NULL, '2023-11-15 10:00:00', '2025-09-14 09:37:21', '2025-09-14 09:37:21'),
(4, 1, NULL, 'emi_payment', 15000.00, 'TXN004', 'upi', 'razorpay', NULL, 'success', NULL, '2023-12-15 10:00:00', '2025-09-14 09:37:21', '2025-09-14 09:37:21');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `marital_status` enum('single','married','divorced','widowed') DEFAULT NULL,
  `status` enum('active','inactive','suspended') DEFAULT 'active',
  `email_verified` tinyint(1) DEFAULT '0',
  `phone_verified` tinyint(1) DEFAULT '0',
  `kyc_completed` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `profile_completion_step` int NOT NULL DEFAULT '0',
  `profile_completed` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `phone`, `first_name`, `last_name`, `date_of_birth`, `gender`, `marital_status`, `status`, `email_verified`, `phone_verified`, `kyc_completed`, `created_at`, `updated_at`, `last_login_at`, `profile_completion_step`, `profile_completed`) VALUES
(1, 'atul.mishra@example.com', '9876543210', 'Atul', 'Mishra', NULL, NULL, NULL, 'active', 0, 0, 0, '2025-09-14 09:37:21', '2025-09-14 09:42:39', '2025-09-14 09:42:39', 4, 1),
(4, 'Mishrapintu8800@gmail.com', '8800899875', 'Atul', 'Mishra', '1999-12-10', 'male', 'single', 'active', 0, 1, 0, '2025-09-13 12:29:38', '2025-09-14 18:06:53', '2025-09-14 18:06:53', 5, 1),
(5, 'AMPROAPK@GMAIL.COM', '9966996655', 'Pintu', 'Mishra', '1999-12-10', 'male', 'single', 'active', 0, 1, 0, '2025-09-14 11:03:17', '2025-09-14 11:34:30', NULL, 4, 1),
(6, 'AMPROAPK2@GMAIL.COM', '9955447788', 'Atul', 'Mishra', '1998-12-10', 'male', 'single', 'active', 0, 1, 0, '2025-09-14 11:22:19', '2025-09-14 11:23:22', NULL, 4, 1),
(7, 'Mishrapintu84800@gmail.com', '9912458745', 'Atul', 'Mishra', '1995-12-10', 'male', 'single', 'active', 0, 1, 0, '2025-09-14 11:44:48', '2025-09-14 11:45:24', NULL, 4, 1),
(8, 'Mishrapintu8s800@gmail.com', '9856321547', 'Atul', 'Mishra', '1997-10-12', 'male', 'single', 'active', 0, 1, 0, '2025-09-14 11:52:54', '2025-09-14 12:00:57', '2025-09-14 12:00:40', 5, 1),
(9, 'Mishrapintu88030@gmail.com', '9988998874', 'Atul', 'Mishra', '1995-11-10', 'male', 'single', 'active', 0, 1, 0, '2025-09-14 18:08:15', '2025-09-14 18:09:09', NULL, 3, 0);

-- --------------------------------------------------------

--
-- Stand-in structure for view `user_profiles`
-- (See below for the actual view)
--
CREATE TABLE `user_profiles` (
`id` int
,`email` varchar(255)
,`phone` varchar(20)
,`first_name` varchar(100)
,`last_name` varchar(100)
,`date_of_birth` date
,`gender` enum('male','female','other')
,`marital_status` enum('single','married','divorced','widowed')
,`status` enum('active','inactive','suspended')
,`email_verified` tinyint(1)
,`phone_verified` tinyint(1)
,`kyc_completed` tinyint(1)
,`created_at` timestamp
,`last_login_at` timestamp
,`employment_type` enum('salaried','self_employed','business','unemployed')
,`company_name` varchar(255)
,`designation` varchar(100)
,`monthly_salary` decimal(12,2)
,`work_experience_years` int
,`work_experience_months` int
,`employment_verified` tinyint(1)
,`monthly_income` decimal(12,2)
,`monthly_expenses` decimal(12,2)
,`existing_loans` decimal(12,2)
,`credit_score` int
,`bank_name` varchar(255)
,`account_number` varchar(50)
,`ifsc_code` varchar(20)
,`account_holder_name` varchar(255)
,`account_type` enum('savings','current','salary')
,`financial_verified` tinyint(1)
);

-- --------------------------------------------------------

--
-- Table structure for table `verification_records`
--

CREATE TABLE `verification_records` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `document_type` enum('pan','aadhaar','address_proof','bank_statement','salary_slip') NOT NULL,
  `document_number` varchar(100) DEFAULT NULL,
  `document_path` varchar(500) DEFAULT NULL,
  `verification_status` enum('pending','verified','rejected') DEFAULT 'pending',
  `verified_by` int DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `verification_records`
--

INSERT INTO `verification_records` (`id`, `user_id`, `document_type`, `document_number`, `document_path`, `verification_status`, `verified_by`, `verified_at`, `rejection_reason`, `created_at`, `updated_at`) VALUES
(1, 4, 'pan', 'FBFBD4545D', NULL, 'pending', NULL, NULL, NULL, '2025-09-14 08:45:36', '2025-09-14 08:45:36'),
(2, 6, 'pan', 'FBFBD4545D', NULL, 'pending', NULL, NULL, NULL, '2025-09-14 11:23:22', '2025-09-14 11:23:22'),
(3, 5, 'pan', 'FBFBD4545H', NULL, 'pending', NULL, NULL, NULL, '2025-09-14 11:34:31', '2025-09-14 11:34:31'),
(4, 7, 'pan', 'FBFBD4545N', NULL, 'pending', NULL, NULL, NULL, '2025-09-14 11:45:25', '2025-09-14 11:45:25'),
(5, 8, 'pan', 'FBFBD4545W', NULL, 'pending', NULL, NULL, NULL, '2025-09-14 11:54:35', '2025-09-14 11:54:35');

-- --------------------------------------------------------

--
-- Table structure for table `video_kyc_records`
--

CREATE TABLE `video_kyc_records` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `session_id` varchar(100) NOT NULL,
  `video_path` varchar(500) DEFAULT NULL,
  `status` enum('scheduled','in_progress','completed','failed') DEFAULT 'scheduled',
  `verification_status` enum('pending','verified','rejected') DEFAULT 'pending',
  `verified_by` int DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text,
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
-- Indexes for table `addresses`
--
ALTER TABLE `addresses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_address_type` (`address_type`),
  ADD KEY `idx_is_primary` (`is_primary`);

--
-- Indexes for table `admin_users`
--
ALTER TABLE `admin_users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `api_logs`
--
ALTER TABLE `api_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_endpoint` (`endpoint`),
  ADD KEY `idx_status_code` (`status_code`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `bank_details`
--
ALTER TABLE `bank_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_primary_account` (`is_primary`),
  ADD KEY `idx_verified` (`is_verified`),
  ADD KEY `idx_bank_name` (`bank_name`),
  ADD KEY `idx_loan_application_id` (`loan_application_id`);

--
-- Indexes for table `digital_signatures`
--
ALTER TABLE `digital_signatures`
  ADD PRIMARY KEY (`id`),
  ADD KEY `verified_by` (`verified_by`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_signature_type` (`signature_type`),
  ADD KEY `idx_verification_status` (`verification_status`);

--
-- Indexes for table `employment_details`
--
ALTER TABLE `employment_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_employment_type` (`employment_type`),
  ADD KEY `idx_verified` (`employment_verified`);

--
-- Indexes for table `financial_details`
--
ALTER TABLE `financial_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_primary_account` (`is_primary`),
  ADD KEY `idx_verified` (`financial_verified`);

--
-- Indexes for table `loans`
--
ALTER TABLE `loans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `loan_number` (`loan_number`),
  ADD KEY `loan_application_id` (`loan_application_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_loan_number` (`loan_number`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_disbursed_at` (`disbursed_at`);

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
  ADD KEY `idx_loan_applications_bank_id` (`bank_id`);

--
-- Indexes for table `member_tiers`
--
ALTER TABLE `member_tiers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tier_name` (`tier_name`),
  ADD KEY `idx_tier_name` (`tier_name`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_notification_type` (`notification_type`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `references`
--
ALTER TABLE `references`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `idx_setting_key` (`setting_key`),
  ADD KEY `idx_is_public` (`is_public`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `transaction_id` (`transaction_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_loan_id` (`loan_id`),
  ADD KEY `idx_transaction_type` (`transaction_type`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

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
  ADD KEY `idx_profile_completion_step` (`profile_completion_step`);

--
-- Indexes for table `verification_records`
--
ALTER TABLE `verification_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `verified_by` (`verified_by`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_document_type` (`document_type`),
  ADD KEY `idx_verification_status` (`verification_status`);

--
-- Indexes for table `video_kyc_records`
--
ALTER TABLE `video_kyc_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `session_id` (`session_id`),
  ADD KEY `verified_by` (`verified_by`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_session_id` (`session_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_verification_status` (`verification_status`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `addresses`
--
ALTER TABLE `addresses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `admin_users`
--
ALTER TABLE `admin_users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `api_logs`
--
ALTER TABLE `api_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bank_details`
--
ALTER TABLE `bank_details`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `digital_signatures`
--
ALTER TABLE `digital_signatures`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `employment_details`
--
ALTER TABLE `employment_details`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `financial_details`
--
ALTER TABLE `financial_details`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `loans`
--
ALTER TABLE `loans`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `loan_applications`
--
ALTER TABLE `loan_applications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `member_tiers`
--
ALTER TABLE `member_tiers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `references`
--
ALTER TABLE `references`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `verification_records`
--
ALTER TABLE `verification_records`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `video_kyc_records`
--
ALTER TABLE `video_kyc_records`
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
-- Constraints for table `api_logs`
--
ALTER TABLE `api_logs`
  ADD CONSTRAINT `api_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `bank_details`
--
ALTER TABLE `bank_details`
  ADD CONSTRAINT `bank_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bank_details_ibfk_2` FOREIGN KEY (`loan_application_id`) REFERENCES `loan_applications` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `digital_signatures`
--
ALTER TABLE `digital_signatures`
  ADD CONSTRAINT `digital_signatures_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `digital_signatures_ibfk_2` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employment_details`
--
ALTER TABLE `employment_details`
  ADD CONSTRAINT `employment_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `financial_details`
--
ALTER TABLE `financial_details`
  ADD CONSTRAINT `financial_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `loans`
--
ALTER TABLE `loans`
  ADD CONSTRAINT `loans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `loans_ibfk_2` FOREIGN KEY (`loan_application_id`) REFERENCES `loan_applications` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `loan_applications`
--
ALTER TABLE `loan_applications`
  ADD CONSTRAINT `fk_loan_applications_bank_id` FOREIGN KEY (`bank_id`) REFERENCES `bank_details` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `loan_applications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `loan_applications_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `transactions`
--
ALTER TABLE `transactions`
  ADD CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `verification_records`
--
ALTER TABLE `verification_records`
  ADD CONSTRAINT `verification_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `verification_records_ibfk_2` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `video_kyc_records`
--
ALTER TABLE `video_kyc_records`
  ADD CONSTRAINT `video_kyc_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `video_kyc_records_ibfk_2` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
