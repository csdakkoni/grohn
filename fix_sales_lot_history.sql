-- FINAL LOT TRACEABILITY FIX (SALES & STOCK MOVEMENTS)
-- 1. Ensure the lot_no column exists in stock_movements
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS lot_no TEXT;

-- 2. Update process_sale to record lot_no in stock_movements
CREATE OR REPLACE FUNCTION process_sale(
    p_user_id UUID,
    p_customer_id BIGINT,
    p_production_id BIGINT,
    p_quantity NUMERIC,
    p_unit_price NUMERIC,
    p_currency TEXT,
    p_payment_term NUMERIC,
    p_sale_date DATE,
    p_notes TEXT,
    p_shipping_cost NUMERIC DEFAULT 0,
    p_overhead_cost NUMERIC DEFAULT 0,
    p_monthly_interest_rate NUMERIC DEFAULT 4.5,
    p_usd_rate NUMERIC DEFAULT 34.5,
    p_eur_rate NUMERIC DEFAULT 37.5
)
RETURNS BIGINT AS $$
DECLARE
    v_prod RECORD; v_product_id BIGINT; v_product_name TEXT; v_remaining_qty NUMERIC;
    v_lot_id BIGINT; v_lot_qty NUMERIC; v_current_stock NUMERIC; v_sale_id BIGINT;
    v_raw_cost_at_sale NUMERIC; v_pkg_cost_at_sale NUMERIC; v_avg_raw_term NUMERIC;
    v_fin_days NUMERIC; v_financing_cost NUMERIC; v_total_sale_cost NUMERIC; v_profit NUMERIC;
BEGIN
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim bulunamadı'; END IF;

    v_product_id := (SELECT product_id FROM recipes WHERE id = v_prod.recipe_id);
    SELECT name INTO v_product_name FROM inventory WHERE id = v_product_id;

    -- Financing Formula
    SELECT COALESCE(SUM( (inv.cost * (CASE WHEN inv.currency = 'USD' THEN p_usd_rate WHEN inv.currency = 'EUR' THEN p_eur_rate ELSE 1 END)) * (ri.percentage / 100.0) * inv.payment_term ), 0) /
           NULLIF(SUM( (inv.cost * (CASE WHEN inv.currency = 'USD' THEN p_usd_rate WHEN inv.currency = 'EUR' THEN p_eur_rate ELSE 1 END)) * (ri.percentage / 100.0) ), 0)
    INTO v_avg_raw_term FROM recipe_ingredients ri JOIN inventory inv ON ri.item_id = inv.id WHERE ri.recipe_id = v_prod.recipe_id;

    v_fin_days := GREATEST(0, p_payment_term - COALESCE(v_avg_raw_term, 0));
    v_raw_cost_at_sale := (v_prod.raw_material_cost / v_prod.quantity) * p_quantity;
    v_pkg_cost_at_sale := (v_prod.packaging_cost / v_prod.quantity) * p_quantity;
    
    v_financing_cost := (v_raw_cost_at_sale * (p_monthly_interest_rate / 100.0 / 30.0) * v_fin_days) +
                        ((v_pkg_cost_at_sale + p_shipping_cost + p_overhead_cost) * (p_monthly_interest_rate / 100.0 / 30.0) * p_payment_term);

    v_total_sale_cost := v_raw_cost_at_sale + v_pkg_cost_at_sale + p_shipping_cost + p_overhead_cost + v_financing_cost;
    v_profit := (p_unit_price * p_quantity) - v_total_sale_cost;

    INSERT INTO sales (
        user_id, customer_id, production_id, product_name, lot_number, quantity,
        unit_price, currency, total_amount, sale_date, payment_term, notes,
        raw_material_cost, packaging_cost, shipping_cost, overhead_cost, financing_cost,
        total_production_cost, profit_amount
    ) VALUES (
        p_user_id, p_customer_id, p_production_id, v_product_name, v_prod.lot_number, p_quantity,
        p_unit_price, p_currency, (p_quantity * p_unit_price), p_sale_date, p_payment_term, p_notes,
        v_raw_cost_at_sale, v_pkg_cost_at_sale, p_shipping_cost, p_overhead_cost, v_financing_cost,
        v_total_sale_cost, v_profit
    ) RETURNING id INTO v_sale_id;

    -- FIFO Deduction for Finished Goods
    v_remaining_qty := p_quantity;
    FOR v_lot_id, v_lot_qty IN SELECT id, qty FROM lots WHERE inventory_id = v_product_id ORDER BY created_at ASC LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;
        IF v_lot_qty <= v_remaining_qty THEN DELETE FROM lots WHERE id = v_lot_id; v_remaining_qty := v_remaining_qty - v_lot_qty;
        ELSE UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id; v_remaining_qty := 0; END IF;
    END LOOP;

    -- RECORD STOCK MOVEMENT (With lot_no parity)
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes, customer_id, price, currency, total_amount, lot_no
    ) VALUES (
        p_user_id, v_product_id, 'Out', v_product_name, -p_quantity, v_current_stock, 'Sale', v_sale_id, 'Satış: ' || v_prod.lot_number, p_customer_id, p_unit_price, p_currency, (p_quantity * p_unit_price), v_prod.lot_number
    );

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Backfill missing LOT numbers for past sales movements
UPDATE stock_movements sm
SET lot_no = s.lot_number
FROM sales s
WHERE sm.related_id = s.id 
AND sm.reason = 'Sale'
AND sm.lot_no IS NULL;
