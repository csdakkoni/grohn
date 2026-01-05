-- Add GHS Symbols column to inventory
-- specific symbols: 'flammable', 'corrosive', 'toxic', 'oxidizing', 'irritant', 'environment', 'health'
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS ghs_symbols TEXT[] DEFAULT '{}';
