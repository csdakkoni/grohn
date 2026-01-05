-- [SALES MANAGEMENT - EDIT & DELETE]
-- This script provides functionality to delete and update sales records with stock reconciliation.

-- 1. DELETE SALE
CREATE OR REPLACE FUNCTION delete_sale(p_sale_id BIGINT, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_sale RECORD;
    v_product_id BIGINT;
    v_current_stock NUMERIC;
BEGIN
    SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Satış kaydı bulunamadı'); END IF;

    -- Get product id from inventory by name
    SELECT id INTO v_product_id FROM inventory WHERE name = v_sale.product_name;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Envanter kaydı bulunamadı'); END IF;
    
    -- Re-add to lots (Reverting stock) - Use placeholder if LOT is missing
    INSERT INTO lots (inventory_id, lot_no, qty) 
    VALUES (v_product_id, COALESCE(NULLIF(v_sale.lot_no, ''), 'LEGACY-RESTORE'), v_sale.quantity);
    
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
    
    -- Log reversal movement
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, 
        lot_no, customer_id, price, currency, total_amount, notes
    ) VALUES (
        p_user_id, v_product_id, 'In', v_sale.product_name, v_sale.quantity, v_current_stock, 'Sale_Reversal', p_sale_id, 
        COALESCE(NULLIF(v_sale.lot_no, ''), 'LEGACY-RESTORE'), v_sale.customer_id, v_sale.unit_price, v_sale.currency, v_sale.total_amount, 
        'Satış İptali/Silme: ' || v_sale.product_name || ' - ' || COALESCE(NULLIF(v_sale.lot_no, ''), 'LEGACY')
    );

    DELETE FROM sales WHERE id = p_sale_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 2. UPDATE SALE (Includes stock adjustment if quantity changes)
CREATE OR REPLACE FUNCTION update_sale(
    p_sale_id BIGINT, p_user_id UUID, p_customer_id BIGINT, p_quantity NUMERIC, p_unit_price NUMERIC, 
    p_currency TEXT, p_payment_term NUMERIC, p_sale_date DATE, p_notes TEXT
)
RETURNS JSON AS $$
DECLARE
    v_sale RECORD;
    v_product_id BIGINT;
    v_qty_diff NUMERIC;
    v_current_stock NUMERIC;
    v_avail_qty NUMERIC;
    v_remaining_qty NUMERIC;
    v_lot_id BIGINT;
    v_lot_qty NUMERIC;
    v_customer_name TEXT;
BEGIN
    SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Satış kaydı bulunamadı'); END IF;
    
    SELECT name INTO v_customer_name FROM accounts WHERE id = p_customer_id;
    
    SELECT id INTO v_product_id FROM inventory WHERE name = v_sale.product_name;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Envanter kaydı bulunamadı'); END IF;
    
    v_qty_diff := p_quantity - v_sale.quantity;
    
    -- If quantity increased, deduct more stock
    IF v_qty_diff > 0 THEN
        SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_product_id;
        IF v_avail_qty < v_qty_diff THEN RETURN json_build_object('success', false, 'message', 'Yetersiz stok!'); END IF;
        
        -- FIFO Deduct
        v_remaining_qty := v_qty_diff;
        FOR v_lot_qty, v_lot_id IN SELECT qty, id FROM lots WHERE inventory_id = v_product_id ORDER BY created_at ASC LOOP
            IF v_remaining_qty <= 0 THEN EXIT; END IF;
            IF v_lot_qty <= v_remaining_qty THEN DELETE FROM lots WHERE id = v_lot_id; v_remaining_qty := v_remaining_qty - v_lot_qty;
            ELSE UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id; v_remaining_qty := 0; END IF;
        END LOOP;
        
        SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
        INSERT INTO stock_movements (
            user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, 
            lot_no, customer_id, price, currency, total_amount, notes
        ) VALUES (
            p_user_id, v_product_id, 'Out', v_sale.product_name, -v_qty_diff, v_current_stock, 'Sale_Update', p_sale_id, 
            COALESCE(NULLIF(v_sale.lot_no, ''), 'LEGACY-RESTORE'), v_sale.customer_id, p_unit_price, p_currency, (v_qty_diff * p_unit_price), 
            'Satış Güncelleme (Miktar Artışı): ' || COALESCE(NULLIF(v_sale.lot_no, ''), 'LEGACY')
        );
        
    -- If quantity decreased, return stock to lots
    ELSIF v_qty_diff < 0 THEN
        INSERT INTO lots (inventory_id, lot_no, qty) 
        VALUES (v_product_id, COALESCE(NULLIF(v_sale.lot_no, ''), 'LEGACY-RESTORE'), ABS(v_qty_diff));
        
        SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
        INSERT INTO stock_movements (
            user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, 
            lot_no, customer_id, price, currency, total_amount, notes
        ) VALUES (
            p_user_id, v_product_id, 'In', v_sale.product_name, ABS(v_qty_diff), v_current_stock, 'Sale_Update', p_sale_id, 
            COALESCE(NULLIF(v_sale.lot_no, ''), 'LEGACY-RESTORE'), v_sale.customer_id, p_unit_price, p_currency, (ABS(v_qty_diff) * p_unit_price), 
            'Satış Güncelleme (Miktar Azalışı): ' || COALESCE(NULLIF(v_sale.lot_no, ''), 'LEGACY')
        );
    END IF;

    -- Update the sales record
    UPDATE sales SET
        customer_id = p_customer_id,
        customer_name = v_customer_name,
        quantity = p_quantity,
        unit_price = p_unit_price,
        currency = p_currency,
        total_amount = (p_quantity * p_unit_price),
        sale_date = p_sale_date,
        payment_term = p_payment_term,
        notes = p_notes
    WHERE id = p_sale_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
