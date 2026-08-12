-- Per-client webhook HMAC secret (returned once at API client creation).
ALTER TABLE api_clients
  ADD COLUMN webhook_signing_secret varchar(128) NULL COMMENT 'Per-client callback HMAC secret' AFTER allowed_ips;
