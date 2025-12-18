-- FIX: Drop the ambiguous functions first
DROP FUNCTION IF EXISTS public.process_sale(uuid, bigint, bigint, numeric, numeric, text, integer, date, text);
DROP FUNCTION IF EXISTS public.process_sale(uuid, bigint, bigint, numeric, numeric, text, numeric, date, text);

-- FIX: Ensure sales table has necessary columns for the UI
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS lot_no text;

-- 3. Re-create the single correct function (using INTEGER for payment_term)
CREATE OR REPLACE FUNCTION public.process_sale(
    p_user_id uuid,
    p_customer_id bigint,
    p_production_id bigint,
    p_quantity numeric,
    p_unit_price numeric,
    p_currency text,
    p_payment_term integer,
    p_sale_date date,
    p_notes text
)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
    v_sale_id bigint;
    v_product_name text;
    v_lot_no text;
    v_total_amount numeric;
    v_customer_name text;
    v_current_qty numeric;
    v_product_id bigint;
BEGIN
    -- 1. Get Production Info (Lot No & Current Stock)
    SELECT p.lot_number, p.quantity, r.product_id 
    INTO v_lot_no, v_current_qty, v_product_id
    FROM productions p
    JOIN recipes r ON p.recipe_id = r.id
    WHERE p.id = p_production_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Üretim/Parti bulunamadı (ID: %)', p_production_id;
    END IF;

    -- 2. Validation: Check Stock
    IF v_current_qty < p_quantity THEN
         RAISE WARNING 'Stok yetersiz olabilir. Mevcut: %, Satılan: %', v_current_qty, p_quantity;
    END IF;

    -- 3. Get Product Name (via Inventory)
    SELECT name INTO v_product_name
    FROM inventory
    WHERE id = v_product_id;

    -- Fallback if name is null
    IF v_product_name IS NULL THEN
        v_product_name := 'Bilinmeyen Ürün';
    END IF;

    -- 4. Get Customer Name
    SELECT name INTO v_customer_name FROM accounts WHERE id = p_customer_id;

    -- 5. Calculate Total
    v_total_amount := p_quantity * p_unit_price;

    -- 6. Insert Sale
    INSERT INTO sales (
        user_id,
        customer_id,
        customer_name, -- Restored
        production_id,
        product_name,  -- Restored
        lot_no,        -- Restored
        quantity,
        unit_price,
        total_amount,
        currency,
        payment_term,
        sale_date,
        notes,
        created_at
    ) VALUES (
        p_user_id,
        p_customer_id,
        v_customer_name, -- Restored
        p_production_id,
        v_product_name,  -- Restored
        v_lot_no,       -- Restored
        p_quantity,
        p_unit_price,
        v_total_amount,
        p_currency,
        p_payment_term,
        p_sale_date,
        p_notes,
        now()
    ) RETURNING id INTO v_sale_id;

    -- 7. Update Stock (Reduce from Production)
    UPDATE productions
    SET quantity = quantity - p_quantity
    WHERE id = p_production_id;

    RETURN json_build_object('success', true, 'sale_id', v_sale_id);
END;
$function$;
