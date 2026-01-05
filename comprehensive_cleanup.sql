-- COMPREHENSIVE DATABASE CLEANUP SCRIPT (FULL RESET)
-- This script will delete ALL data from the system to allow a fresh start.
-- This includes Inventory, Recipes, Sales, Productions, and Quality Control data.

BEGIN;

-- 1. TRUNCATE ALL TABLES (Handles dependencies and restarts identities where applicable)
TRUNCATE TABLE 
    stock_movements, 
    quality_results, 
    quality_batches, 
    sales, 
    productions, 
    purchases, 
    lots,
    recipe_ingredients, 
    quality_specs, 
    quality_standards, 
    recipes, 
    inventory, 
    accounts,
    calculation_history
RESTART IDENTITY CASCADE;

-- 2. DYNAMIC CLEANUP FOR OPTIONAL TABLES
-- (Handles tables that might not exist in all environments)
DO $$ 
BEGIN
    EXECUTE (
        SELECT 'TRUNCATE TABLE ' || string_agg(quote_ident(table_name), ', ') || ' RESTART IDENTITY CASCADE'
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('team_members_invites', 'logs', 'settings')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = current_table AND table_schema = 'public') -- Extra safety
    );
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Additional tables not found or already empty, skipped.';
END $$;

COMMIT;

-- VERIFICATION
SELECT 'System Ready' as status, 
       (SELECT count(*) FROM inventory) as inventory_items,
       (SELECT count(*) FROM recipes) as recipe_count,
       (SELECT count(*) FROM sales) as sales_count;
