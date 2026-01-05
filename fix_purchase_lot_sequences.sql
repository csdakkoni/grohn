-- ======================================================
-- SHORTER SEQUENTIAL PURCHASE LOT NUMBERS (L-YYMM-XXX)
-- ======================================================

-- 1. FUNCTION: Generate a shorter sequential lot number
CREATE OR REPLACE FUNCTION generate_purchase_lot_number(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
    v_date_prefix TEXT;
    v_count INTEGER;
    v_new_lot TEXT;
BEGIN
    -- Format: L + YYMM (e.g., L2501)
    v_date_prefix := 'L' || to_char(p_date, 'YYMM');

    -- Count existing lots for this month in both purchases and lots table
    -- To ensure we get the next number accurately
    SELECT COUNT(*) INTO v_count 
    FROM (
        SELECT lot_no FROM lots WHERE lot_no LIKE v_date_prefix || '-%'
        UNION
        SELECT lot_no FROM purchases WHERE lot_no LIKE v_date_prefix || '-%'
    ) sub;

    RETURN v_date_prefix || '-' || LPAD((v_count + 1)::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. UPDATE process_purchase to use this function
CREATE OR REPLACE FUNCTION process_purchase(
    p_user_id UUID,
    p_supplier_id BIGINT,
    p_item_name TEXT,
    p_item_type TEXT,
    p_unit TEXT,
    p_qty NUMERIC,
    p_price NUMERIC,
    p_currency TEXT,
    p_term_days NUMERIC,
    p_lot_no TEXT,
    p_is_new_item BOOLEAN,
    p_item_id BIGINT DEFAULT NULL,
    p_capacity_value NUMERIC DEFAULT NULL,
    p_capacity_unit TEXT DEFAULT NULL,
    p_tare_weight NUMERIC DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_inventory_id BIGINT;
    v_purchase_id BIGINT;
    v_total_amount NUMERIC;
    v_current_stock NUMERIC;
    v_active_lot TEXT;
BEGIN
    v_total_amount := p_qty * p_price;
    
    -- Handle Lot Number: If empty or "OTO-", generate a new one
    v_active_lot := p_lot_no;
    IF v_active_lot IS NULL OR v_active_lot = '' OR v_active_lot LIKE 'OTO-%' THEN
        v_active_lot := generate_purchase_lot_number(CURRENT_DATE);
    END IF;

    IF p_is_new_item THEN
        INSERT INTO inventory (
            user_id, name, type, unit, cost, currency, payment_term, track_stock,
            capacity_value, capacity_unit, tare_weight
        ) VALUES (
            p_user_id, p_item_name, p_item_type, p_unit, p_price, p_currency, p_term_days, TRUE,
            p_capacity_value, p_capacity_unit, p_tare_weight
        ) RETURNING id INTO v_inventory_id;
        
        -- Note: Trigger trigger_assign_product_code will assign the Product Code (RM/PKG)
    ELSE
        v_inventory_id := p_item_id;
        UPDATE inventory SET 
            cost = p_price, 
            currency = p_currency, 
            payment_term = p_term_days 
        WHERE id = v_inventory_id;
    END IF;

    INSERT INTO lots (inventory_id, lot_no, qty)
    VALUES (v_inventory_id, v_active_lot, p_qty);

    INSERT INTO purchases (
        user_id, supplier_id, item_name, qty, price, currency, total, payment_term, lot_no
    ) VALUES (
        p_user_id, p_supplier_id, p_item_name, p_qty, p_price, p_currency, v_total_amount, p_term_days, v_active_lot
    ) RETURNING id INTO v_purchase_id;

    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_inventory_id;

    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, 
        lot_no, supplier_id, price, currency, total_amount, notes
    ) VALUES (
        p_user_id, v_inventory_id, 'In', p_item_name, p_qty, v_current_stock, 'Purchase', v_purchase_id, 
        v_active_lot, p_supplier_id, p_price, p_currency, v_total_amount,
        'Satınalma: ' || p_item_name || ' - ' || v_active_lot
    );

    RETURN json_build_object('success', true, 'purchase_id', v_purchase_id, 'lot_no', v_active_lot);
END;
$$ LANGUAGE plpgsql;

-- 3. FUNCTION: Update an existing purchase
CREATE OR REPLACE FUNCTION process_purchase_update(
    p_purchase_id BIGINT,
    p_supplier_id BIGINT,
    p_item_name TEXT,
    p_qty NUMERIC,
    p_price NUMERIC,
    p_currency TEXT,
    p_term_days NUMERIC,
    p_lot_no TEXT
)
RETURNS JSON AS $$
DECLARE
    v_old_purchase RECORD;
    v_inv_id BIGINT;
    v_total_amount NUMERIC;
    v_active_lot TEXT;
BEGIN
    SELECT * INTO v_old_purchase FROM purchases WHERE id = p_purchase_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Satınalma kaydı bulunamadı'; END IF;

    SELECT id INTO v_inv_id FROM inventory WHERE name = p_item_name;
    IF NOT FOUND THEN RAISE EXCEPTION 'Envanter kaydı bulunamadı'; END IF;

    v_total_amount := p_qty * p_price;
    v_active_lot := COALESCE(NULLIF(p_lot_no, ''), v_old_purchase.lot_no);

    -- 1. Update Inventory Price
    UPDATE inventory SET 
        cost = p_price, 
        currency = p_currency, 
        payment_term = p_term_days 
    WHERE id = v_inv_id;

    -- 2. Update Lot
    -- Case: Lot number changed (tricky if it already exists or if we need to rename)
    IF v_old_purchase.lot_no IS DISTINCT FROM v_active_lot THEN
        UPDATE lots SET 
            lot_no = v_active_lot,
            qty = p_qty
        WHERE inventory_id = v_inv_id AND lot_no = v_old_purchase.lot_no;
        
        -- If old lot not found (maybe manual edit), try to find by new lot or create
        IF NOT FOUND THEN
             UPDATE lots SET qty = p_qty WHERE inventory_id = v_inv_id AND lot_no = v_active_lot;
             IF NOT FOUND THEN
                 INSERT INTO lots (inventory_id, lot_no, qty) VALUES (v_inv_id, v_active_lot, p_qty);
             END IF;
        END IF;
    ELSE
        UPDATE lots SET qty = p_qty WHERE inventory_id = v_inv_id AND lot_no = v_active_lot;
    END IF;

    -- 3. Update Purchase Record
    UPDATE purchases SET
        supplier_id = p_supplier_id,
        qty = p_qty,
        price = p_price,
        currency = p_currency,
        total = v_total_amount,
        payment_term = p_term_days,
        lot_no = v_active_lot
    WHERE id = p_purchase_id;

    -- 4. Update Stock Movement
    -- Trigger trigger_recalculate_stock_ledger will handle current_stock propagation
    UPDATE stock_movements SET
        amount = p_qty,
        lot_no = v_active_lot,
        supplier_id = p_supplier_id,
        price = p_price,
        currency = p_currency,
        total_amount = v_total_amount
    WHERE related_id = p_purchase_id AND reason = 'Purchase';

    RETURN json_build_object('success', true, 'lot_no', v_active_lot);
END;
$$ LANGUAGE plpgsql;
