-- Add GHS Symbols column if it doesn't exist
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS ghs_symbols TEXT[] DEFAULT '{}';

-- Add Density column if it doesn't exist (used for Packaging Calculations)
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS density NUMERIC DEFAULT 1.0;
