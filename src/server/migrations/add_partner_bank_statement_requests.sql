-- DEPRECATED: use add_api_clients_and_bank_statement.sql (api_clients + api_bank_statement_requests).
-- Lead partners must NOT use this table for AA clients.

-- Partner-initiated bank statement / Account Aggregator requests (legacy — do not use for new integrations)
CREATE TABLE IF NOT EXISTS partner_bank_statement_requests (
  id int NOT NULL AUTO_INCREMENT,
  partner_id int NOT NULL,
  partner_ref varchar(255) NOT NULL,
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
  UNIQUE KEY uk_partner_partner_ref (partner_id, partner_ref),
  UNIQUE KEY uk_client_ref_num (client_ref_num),
  KEY idx_pbsr_request_id (request_id),
  KEY idx_pbsr_partner_id (partner_id),
  CONSTRAINT fk_pbsr_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
