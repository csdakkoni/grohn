-- ==========================================
-- FULL DATABASE WIPE (FACTORY RESET)
-- ==========================================
-- WARNING: This will delete EVERYTHING! 
-- All Sales, Productions, Products, Recipes, and Customers will be GONE.
-- This action is IRREVERSIBLE.

-- 1. Transactional Data
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE productions CASCADE;
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE ibc_movements CASCADE;
TRUNCATE TABLE quality_batches CASCADE;
TRUNCATE TABLE quality_results CASCADE;
TRUNCATE TABLE production_adjustments CASCADE;
TRUNCATE TABLE calculation_history CASCADE;
TRUNCATE TABLE lots CASCADE;

-- 2. Master Data
TRUNCATE TABLE recipe_ingredients CASCADE;
TRUNCATE TABLE recipes CASCADE;
TRUNCATE TABLE inventory CASCADE;
TRUNCATE TABLE accounts CASCADE;
TRUNCATE TABLE quality_specs CASCADE;
TRUNCATE TABLE quality_standards CASCADE;
TRUNCATE TABLE settings CASCADE;
TRUNCATE TABLE team_members CASCADE;

-- Optional: Restart sequences to 1
-- ALTER SEQUENCE sales_id_seq RESTART WITH 1;
-- ...
