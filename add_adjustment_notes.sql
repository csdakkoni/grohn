-- Add adjustment_notes column to productions table
ALTER TABLE productions 
ADD COLUMN IF NOT EXISTS adjustment_notes TEXT;
