-- B2B API clients (Account Aggregator / bank statement) — NOT lead-sourcing partners

CREATE TABLE IF NOT EXISTS api_clients (
  id int NOT NULL AUTO_INCREMENT,
  client_uuid char(36) NOT NULL,
  client_id varchar(128) NOT NULL,
  client_secret varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  email varchar(255) DEFAULT NULL,
  public_key_path varchar(500) DEFAULT NULL,
  allowed_ips text DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_api_clients_client_uuid (client_uuid),
  UNIQUE KEY uk_api_clients_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_bank_statement_requests (
  id int NOT NULL AUTO_INCREMENT,
  api_client_id int NOT NULL,
  external_ref varchar(255) NOT NULL,
  client_ref_num varchar(255) NOT NULL,
  request_id int DEFAULT NULL,
  txn_id varchar(255) DEFAULT NULL,
  mobile_number varchar(15) NOT NULL,
  bank_name varchar(100) DEFAULT NULL,
  destination varchar(32) NOT NULL DEFAULT 'accountaggregator',
  return_url text NOT NULL,
  callback_url text DEFAULT NULL,
  digitap_url text DEFAULT NULL,
  expires_at timestamp NULL DEFAULT NULL,
  status varchar(64) NOT NULL DEFAULT 'pending',
  transaction_data json DEFAULT NULL,
  report_data longtext DEFAULT NULL,
  report_xml longtext DEFAULT NULL COMMENT 'Raw AA/FI XML from Digitap',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_api_client_external_ref (api_client_id, external_ref),
  UNIQUE KEY uk_absr_client_ref_num (client_ref_num),
  KEY idx_absr_request_id (request_id),
  KEY idx_absr_api_client_id (api_client_id),
  CONSTRAINT fk_absr_api_client_id FOREIGN KEY (api_client_id) REFERENCES api_clients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
