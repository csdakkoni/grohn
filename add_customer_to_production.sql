-- Add customer_id to productions table
ALTER TABLE productions
ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES accounts(id);

-- No need to backfill as it's optional and new productions will use it.
