-- Fix stock_movements_type_check constraint
-- The existing constraint is blocking 'In'/'Out' values.
-- We will drop it and recreate it to explicitly allow these values.

DO $$
BEGIN
    -- Try to drop the constraint if it exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_type_check') THEN
        ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_type_check;
    END IF;
END $$;

-- Add the constraint back with allowed values
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check CHECK (type IN ('In', 'Out'));

-- Ensure type column exists and is text
ALTER TABLE stock_movements ALTER COLUMN type TYPE TEXT;
