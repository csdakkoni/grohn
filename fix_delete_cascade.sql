-- Fix Delete Cascade for Productions
-- We want to allow deleting a production, which should automatically delete related QC batches and adjustments.

-- 1. Quality Batches
ALTER TABLE quality_batches
DROP CONSTRAINT IF EXISTS quality_batches_production_id_fkey,
ADD CONSTRAINT quality_batches_production_id_fkey
    FOREIGN KEY (production_id)
    REFERENCES productions(id)
    ON DELETE CASCADE;

-- 2. Production Adjustments (Already added in previous step but ensuring it)
ALTER TABLE production_adjustments
DROP CONSTRAINT IF EXISTS production_adjustments_production_id_fkey,
ADD CONSTRAINT production_adjustments_production_id_fkey
    FOREIGN KEY (production_id)
    REFERENCES productions(id)
    ON DELETE CASCADE;

-- Note: We DO NOT cascade SALES. If a sale exists, you cannot delete the production. This is correct.
-- Note: Stack Movements are loose logs (related_id is typically just an integer or loose reference in some schemas, 
-- but if we have a constraint, we should check).
-- Assuming related_id is NOT a foreign key in stock_movements (it usually isn't in this generic schema).
