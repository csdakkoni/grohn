DO $$
DECLARE
    v_id BIGINT;
BEGIN
    SELECT id INTO v_id FROM inventory WHERE product_code = 'PRD-002';
    
    IF v_id IS NULL THEN
        RAISE NOTICE 'Product PRD-002 not found in inventory.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found inventory id % for PRD-002', v_id;

    -- Check Lots
    RAISE NOTICE 'Lots: %', (SELECT count(*) FROM lots WHERE inventory_id = v_id);
    
    -- Check Purchases
    RAISE NOTICE 'Purchases: %', (SELECT count(*) FROM purchases WHERE inventory_id = v_id OR item_name = (SELECT name FROM inventory WHERE id = v_id));

    -- Check Recipes (as product)
    RAISE NOTICE 'Recipes (as product): %', (SELECT count(*) FROM recipes WHERE product_id = v_id);

    -- Check Recipe Ingredients
    RAISE NOTICE 'Recipe Ingredients: %', (SELECT count(*) FROM recipe_ingredients WHERE item_id = v_id);

    -- Check Productions (via recipes)
    RAISE NOTICE 'Productions (direct): %', (SELECT count(*) FROM productions WHERE recipe_id IN (SELECT id FROM recipes WHERE product_id = v_id));

    -- Check Stock Movements
    RAISE NOTICE 'Stock Movements: %', (SELECT count(*) FROM stock_movements WHERE inventory_id = v_id);

END $$;
