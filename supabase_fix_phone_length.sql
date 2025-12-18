-- Increase phone column length in accounts table to avoid "value too long" errors
ALTER TABLE accounts ALTER COLUMN phone TYPE TEXT;
ALTER TABLE accounts ALTER COLUMN contact TYPE TEXT;
