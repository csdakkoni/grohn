-- 1. Add columns to productions table
ALTER TABLE public.productions ADD COLUMN IF NOT EXISTS target_packaging_id bigint REFERENCES inventory(id);
ALTER TABLE public.productions ADD COLUMN IF NOT EXISTS target_package_count numeric;

-- 2. Update the RPC function
DROP FUNCTION IF EXISTS public.create_production_plan(uuid, integer, numeric, date, text);
DROP FUNCTION IF EXISTS public.create_production_plan(uuid, bigint, numeric, date, text);

-- Note: We add p_target_packaging_id and p_target_package_count as optional (or required)
CREATE OR REPLACE FUNCTION public.create_production_plan(
    p_user_id uuid,
    p_recipe_id bigint,
    p_quantity numeric,
    p_production_date date,
    p_notes text,
    p_target_packaging_id bigint DEFAULT NULL,
    p_target_package_count numeric DEFAULT NULL,
    p_customer_id bigint DEFAULT NULL -- New parameter
)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
    v_lot_no text;
    v_prod_id bigint;
    v_prefix text;
BEGIN
    -- Generate LOT Number (YYMMDD-RECIPEID-RANDOM)
    v_prefix := 'LOT-' || to_char(p_production_date, 'yyMMdd') || '-' || p_recipe_id || '-';
    -- Simple random suffix
    v_lot_no := v_prefix || floor(random() * 1000)::text;

    INSERT INTO productions (
        user_id,
        recipe_id,
        quantity,
        production_date,
        notes,
        status,
        lot_number,
        target_packaging_id,
        target_package_count,
        created_at,
        customer_id
    ) VALUES (
        p_user_id,
        p_recipe_id,
        p_quantity,
        p_production_date,
        p_notes,
        'Planned',
        v_lot_no,
        p_target_packaging_id,
        p_target_package_count,
        now(),
        p_customer_id
    ) RETURNING id INTO v_prod_id;

    RETURN json_build_object('success', true, 'id', v_prod_id, 'lot_number', v_lot_no);
END;
$function$;
