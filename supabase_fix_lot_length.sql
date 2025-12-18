-- Increase lot number column length in all relevant tables to avoid "value too long" errors
-- LOT numbers are generated as 'LOT-' + timestamp (13 digits) = 17 characters
-- Default varchar(15) is too short.

ALTER TABLE productions ALTER COLUMN lot_number TYPE TEXT;
ALTER TABLE purchases ALTER COLUMN lot_no TYPE TEXT;
ALTER TABLE lots ALTER COLUMN lot_no TYPE TEXT;
