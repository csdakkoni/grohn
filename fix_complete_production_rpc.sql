-- Fix for complete_production and process_sale RPC functions
-- Drop existing versions to avoid return type or signature conflicts
DROP FUNCTION IF EXISTS complete_production(bigint,uuid,bigint,numeric,numeric,numeric,numeric,numeric,text,text,text,numeric,numeric,numeric);
DROP FUNCTION IF EXISTS complete_production(bigint,uuid,bigint,numeric,numeric,numeric,numeric,text,text,text,numeric);
DROP FUNCTION IF EXISTS process_sale(uuid,bigint,bigint,numeric,numeric,text,numeric,date,text);
DROP FUNCTION IF EXISTS process_sale(uuid,bigint,bigint,numeric,numeric,text,numeric,date,text,numeric,numeric,numeric,numeric,numeric,numeric);
DROP FUNCTION IF EXISTS send_production_to_qc(bigint,uuid);

CREATE OR REPLACE FUNCTION complete_production(
    p_production_id BIGINT,
    p_user_id UUID,
    p_packaging_id BIGINT,
    p_packaging_count NUMERIC,
    p_shipping_cost NUMERIC,
    p_overhead_cost NUMERIC,
    p_sale_term_days NUMERIC,
    p_profit_margin NUMERIC,
    p_qc_status TEXT,
    p_qc_notes TEXT,
    p_currency TEXT,
    p_monthly_interest_rate NUMERIC DEFAULT 4.5,
    p_usd_rate NUMERIC DEFAULT 34.5,
    p_eur_rate NUMERIC DEFAULT 37.5
)
RETURNS JSON AS $$
DECLARE
    v_prod RECORD;
    v_recipe RECORD;
    v_product RECORD;
    v_packaging RECORD;
    v_ingredient RECORD;
    v_lot_number TEXT;
    v_raw_cost NUMERIC := 0;
    v_pkg_cost NUMERIC := 0;
    v_pkg_qty NUMERIC;
    v_total_cost NUMERIC;
    v_unit_cost NUMERIC;
    v_sale_price NUMERIC;
    v_unit_sale_price NUMERIC;
    v_financing_cost NUMERIC;
    v_pay_term_sum NUMERIC := 0;
    v_cost_sum NUMERIC := 0;
    v_avg_term NUMERIC;
    v_fin_days NUMERIC;
    v_remaining_qty NUMERIC;
    v_lot_id BIGINT;
    v_lot_qty NUMERIC;
    v_current_stock NUMERIC;
    v_item_name TEXT;
    v_track_stock BOOLEAN;
    v_qc_batch_status TEXT;
BEGIN
    -- Get Production Record
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı (ID: %)', p_production_id; END IF;
    IF v_prod.status = 'Completed' THEN RAISE EXCEPTION 'Bu üretim zaten tamamlanmış'; END IF;

    -- Get Recipe & Product
    SELECT * INTO v_recipe FROM recipes WHERE id = v_prod.recipe_id;
    SELECT * INTO v_product FROM inventory WHERE id = v_recipe.product_id;
    SELECT * INTO v_packaging FROM inventory WHERE id = p_packaging_id;

    -- Reuse LOT Number if exists, else generate
    v_lot_number := v_prod.lot_number;
    IF v_lot_number IS NULL OR v_lot_number = '' THEN
        v_lot_number := generate_lot_number(p_user_id, v_prod.production_date);
    END IF;

    -- Calculate Raw Material Costs & Deduct Stock
    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = v_prod.recipe_id LOOP
        DECLARE
            v_item_cost NUMERIC;
            v_item_term NUMERIC;
            v_req_qty NUMERIC;
            v_avail_qty NUMERIC;
            v_item_currency TEXT;
            v_rate_from NUMERIC;
            v_rate_to NUMERIC;
            v_converted_cost NUMERIC;
        BEGIN
            SELECT cost, payment_term, track_stock, currency, name INTO v_item_cost, v_item_term, v_track_stock, v_item_currency, v_item_name
            FROM inventory WHERE id = v_ingredient.item_id;
            
            -- Currency Conversion Logic
            v_rate_from := CASE WHEN v_item_currency = 'USD' THEN p_usd_rate WHEN v_item_currency = 'EUR' THEN p_eur_rate ELSE 1 END;
            v_rate_to := CASE WHEN p_currency = 'USD' THEN p_usd_rate WHEN p_currency = 'EUR' THEN p_eur_rate ELSE 1 END;
            v_converted_cost := (v_item_cost * COALESCE(v_rate_from, 1)) / COALESCE(v_rate_to, 1);

            v_req_qty := (v_prod.quantity * v_ingredient.percentage / 100);
            
            -- Check Stock ONLY if tracked
            IF v_track_stock THEN
                SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_ingredient.item_id;
                IF v_avail_qty < v_req_qty THEN
                    RAISE EXCEPTION 'Yetersiz stok: % (ID: %). Gerekli: %, Mevcut: %', v_item_name, v_ingredient.item_id, v_req_qty, v_avail_qty;
                END IF;

                -- Deduct Stock (FIFO)
                v_remaining_qty := v_req_qty;
                FOR v_lot_id, v_lot_qty IN 
                    SELECT id, qty FROM lots 
                    WHERE inventory_id = v_ingredient.item_id 
                    ORDER BY created_at ASC 
                LOOP
                    IF v_remaining_qty <= 0 THEN EXIT; END IF;
                    IF v_lot_qty <= v_remaining_qty THEN
                        DELETE FROM lots WHERE id = v_lot_id;
                        v_remaining_qty := v_remaining_qty - v_lot_qty;
                    ELSE
                        UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id;
                        v_remaining_qty := 0;
                    END IF;
                END LOOP;

                -- Log Usage
                SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_ingredient.item_id;
                INSERT INTO stock_movements (
                    user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
                ) VALUES (
                    p_user_id, v_ingredient.item_id, 'Out', v_item_name, -v_req_qty, v_current_stock, 'Production_Usage', p_production_id, 'Üretim Tamamlama: ' || v_lot_number
                );
            END IF;

            -- Cost Calcs
            v_raw_cost := v_raw_cost + (v_converted_cost * v_ingredient.percentage / 100 * v_prod.quantity);
            v_pay_term_sum := v_pay_term_sum + (v_converted_cost * v_ingredient.percentage / 100 * v_prod.quantity * COALESCE(v_item_term, 0));
            v_cost_sum := v_cost_sum + (v_converted_cost * v_ingredient.percentage / 100 * v_prod.quantity);
        END;
    END LOOP;

    -- Calculate Packaging Cost
    -- Use p_packaging_count if provided, otherwise auto-calculate
    IF p_packaging_count IS NOT NULL AND p_packaging_count > 0 THEN
        v_pkg_qty := p_packaging_count;
    ELSE
        v_pkg_qty := CEIL((v_prod.quantity / COALESCE(v_product.density, 1)) / COALESCE(v_packaging.capacity_value, 1000));
    END IF;
    v_pkg_cost := v_pkg_qty * COALESCE(v_packaging.cost, 0);

    -- Calculate Financing Cost
    v_avg_term := CASE WHEN v_cost_sum > 0 THEN v_pay_term_sum / v_cost_sum ELSE 0 END;
    v_fin_days := GREATEST(0, p_sale_term_days - v_avg_term);
    
    -- Financing: Raw materials benefit from supplier lead time, upfront costs (Pkg, Ship, Overhead) are paid at day 0
    v_financing_cost := (
        (v_raw_cost * (p_monthly_interest_rate / 100.0 / 30.0) * v_fin_days) +
        ((v_pkg_cost + p_shipping_cost + p_overhead_cost) * (p_monthly_interest_rate / 100.0 / 30.0) * p_sale_term_days)
    );

    -- Totals
    v_total_cost := v_raw_cost + v_pkg_cost + p_shipping_cost + p_overhead_cost + v_financing_cost;
    v_unit_cost := v_total_cost / NULLIF(v_prod.quantity, 0);
    v_sale_price := v_total_cost * (1 + p_profit_margin / 100);
    v_unit_sale_price := v_sale_price / NULLIF(v_prod.quantity, 0);

    -- Update Production Record
    UPDATE productions SET
        lot_number = v_lot_number,
        status = 'Completed',
        packaging_id = p_packaging_id,
        packaging_quantity = v_pkg_qty,
        raw_material_cost = v_raw_cost,
        packaging_cost = v_pkg_cost,
        shipping_cost = p_shipping_cost,
        overhead_cost = p_overhead_cost,
        sale_term_days = p_sale_term_days,
        financing_cost = v_financing_cost,
        total_cost = v_total_cost,
        unit_cost = v_unit_cost,
        profit_margin_percent = p_profit_margin,
        profit_amount = (v_sale_price - v_total_cost),
        sale_price = v_sale_price,
        unit_sale_price = v_unit_sale_price,
        currency = p_currency,
        qc_status = p_qc_status,
        qc_notes = p_qc_notes
    WHERE id = p_production_id;

    -- Add Finished Product to Stock
    INSERT INTO lots (inventory_id, lot_no, qty)
    VALUES (v_product.id, v_lot_number, v_prod.quantity);

    -- Log Output Movement
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product.id;
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_product.id, 'In', v_product.name, v_prod.quantity, v_current_stock, 'Production_Output', p_production_id, 'Üretim Çıktısı: ' || v_lot_number
    );

    -- DEDUCT PACKAGING STOCK if applicable
    IF p_packaging_id IS NOT NULL AND v_pkg_qty > 0 THEN
        DECLARE
            v_pkg_track_stock BOOLEAN;
            v_pkg_name TEXT;
        BEGIN
            SELECT track_stock, name INTO v_pkg_track_stock, v_pkg_name FROM inventory WHERE id = p_packaging_id;
            IF v_pkg_track_stock THEN
                -- Deduct Packaging Stock (FIFO)
                v_remaining_qty := v_pkg_qty;
                FOR v_lot_id, v_lot_qty IN 
                    SELECT id, qty FROM lots 
                    WHERE inventory_id = p_packaging_id 
                    ORDER BY created_at ASC 
                LOOP
                    IF v_remaining_qty <= 0 THEN EXIT; END IF;
                    IF v_lot_qty <= v_remaining_qty THEN
                        DELETE FROM lots WHERE id = v_lot_id;
                        v_remaining_qty := v_remaining_qty - v_lot_qty;
                    ELSE
                        UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id;
                        v_remaining_qty := 0;
                    END IF;
                END LOOP;

                -- Log Packaging Usage
                SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = p_packaging_id;
                INSERT INTO stock_movements (
                    user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
                ) VALUES (
                    p_user_id, p_packaging_id, 'Out', v_pkg_name, -v_pkg_qty, v_current_stock, 'Production_Packaging', p_production_id, 'Ambalaj Kullanımı: ' || v_lot_number
                );
            END IF;
        END;
    END IF;

    -- AUTO-CREATE QC BATCH if not already created
    INSERT INTO quality_batches (
        product_id, lot_no, status, production_id, reference_type, notes, created_at
    )
    SELECT v_product.id, v_lot_number, 'Pending', p_production_id, 'Production', 'Otomatik oluşturuldu (Üretim Tamamlandı)', NOW()
    WHERE NOT EXISTS (SELECT 1 FROM quality_batches WHERE production_id = p_production_id);

    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;

-- Process Sale with Automatic IBC Tracking
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
    p_raw_material_cost NUMERIC DEFAULT 0,
    p_packaging_cost NUMERIC DEFAULT 0,
    p_shipping_cost NUMERIC DEFAULT 0,
    p_overhead_cost NUMERIC DEFAULT 0,
    p_financing_cost NUMERIC DEFAULT 0,
    p_total_production_cost NUMERIC DEFAULT 0
)
RETURNS BIGINT AS $$
DECLARE
    v_production RECORD;
    v_recipe RECORD;
    v_product_id BIGINT;
    v_avail_qty NUMERIC;
    v_remaining_qty NUMERIC;
    v_lot_id BIGINT;
    v_lot_qty NUMERIC;
    v_sale_id BIGINT;
    v_current_stock NUMERIC;
    v_product_name TEXT;
    v_pkg_name TEXT;
BEGIN
    -- Get Production Info
    SELECT * INTO v_production FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı'; END IF;

    SELECT * INTO v_recipe FROM recipes WHERE id = v_production.recipe_id;
    v_product_id := v_recipe.product_id;
    SELECT name INTO v_product_name FROM inventory WHERE id = v_product_id;

    -- Check Stock
    SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_product_id;
    IF v_avail_qty < p_quantity THEN
        RAISE EXCEPTION 'Yetersiz stok! Mevcut: %, İstenen: %', v_avail_qty, p_quantity;
    END IF;

    -- Insert Sale
    INSERT INTO sales (
        user_id, customer_id, production_id, product_name, lot_number, quantity,
        unit_price, currency, total_amount, sale_date, payment_term, notes,
        raw_material_cost, packaging_cost, shipping_cost, overhead_cost, financing_cost, total_production_cost
    ) VALUES (
        p_user_id, p_customer_id, p_production_id, v_product_name,
        v_production.lot_number, p_quantity, p_unit_price, p_currency,
        (p_quantity * p_unit_price), p_sale_date, p_payment_term, p_notes,
        p_raw_material_cost, p_packaging_cost, p_shipping_cost, p_overhead_cost, p_financing_cost, p_total_production_cost
    ) RETURNING id INTO v_sale_id;

    -- Deduct Stock (FIFO)
    v_remaining_qty := p_quantity;
    FOR v_lot_id, v_lot_qty IN 
        SELECT id, qty FROM lots 
        WHERE inventory_id = v_product_id 
        ORDER BY created_at ASC 
    LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;

        IF v_lot_qty <= v_remaining_qty THEN
            DELETE FROM lots WHERE id = v_lot_id;
            v_remaining_qty := v_remaining_qty - v_lot_qty;
        ELSE
            UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id;
            v_remaining_qty := 0;
        END IF;
    END LOOP;

    -- Log Movement
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_product_id, 'Out', v_product_name, -p_quantity, v_current_stock, 'Sale', v_sale_id, 'Satış: ' || v_production.lot_number
    );

    -- IBC TRACKING INTEGRATION
    IF v_production.packaging_id IS NOT NULL THEN
        SELECT name INTO v_pkg_name FROM inventory WHERE id = v_production.packaging_id;
        IF v_pkg_name ILIKE '%IBC%' THEN
            -- Check if IBC movement already exists for this production to avoid double tracking
            -- (e.g. if it was already tracked during production completion)
            IF NOT EXISTS (SELECT 1 FROM ibc_movements WHERE customer_id = p_customer_id AND notes LIKE '%' || v_production.lot_number || '%') THEN
                INSERT INTO ibc_movements (
                    user_id, customer_id, sale_id, type, quantity, notes
                ) VALUES (
                    p_user_id, p_customer_id, v_sale_id, 'Sent', v_production.packaging_quantity, 'Satış Sevkiyatı (Lot: ' || v_production.lot_number || ')'
                );
            END IF;
        END IF;
    END IF;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Corrected send_production_to_qc to allow re-testing
CREATE OR REPLACE FUNCTION send_production_to_qc(
    p_production_id BIGINT,
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_prod RECORD;
    v_lot_number TEXT;
    v_recipe RECORD;
    v_product_id BIGINT;
BEGIN
    -- Get Production
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı'; END IF;

    -- If already has LOT, keep it. Else generate.
    IF v_prod.lot_number IS NOT NULL AND v_prod.lot_number <> '' THEN
        v_lot_number := v_prod.lot_number;
    ELSE
        v_lot_number := generate_lot_number(p_user_id, v_prod.production_date);
    END IF;

    -- Get Product ID
    SELECT product_id INTO v_product_id FROM recipes WHERE id = v_prod.recipe_id;

    -- Update Production Status & LOT
    UPDATE productions SET 
        status = 'In QC', 
        lot_number = v_lot_number,
        qc_status = 'Pending'
    WHERE id = p_production_id;

    -- Create QC Batch
    -- Düzeltme: YENİ BİR TEST KAYDI OLUŞTUR.
    -- Sadece hali hazırda 'Pending' olan bir kayıt varsa oluşturma (çift kayıt olmasın diye).
    -- 'Approved' veya 'Rejected' olsa dahi yeni bir test kaydı (Pending) başlatsın.
    INSERT INTO quality_batches (
        product_id, lot_no, status, production_id, reference_type, notes, created_at
    )
    SELECT v_product_id, v_lot_number, 'Pending', p_production_id, 'Production', 'Üretimden talep edildi (Revize/Yeniden Test)', NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM quality_batches 
        WHERE production_id = p_production_id 
        AND status = 'Pending'
    );

    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;
