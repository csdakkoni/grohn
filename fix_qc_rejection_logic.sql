-- 1. DROP OLD OVERLOADS (To prevent ambiguity)
DROP FUNCTION IF EXISTS send_production_to_qc(BIGINT, UUID);

-- 2. CREATE NEW VERSION
CREATE OR REPLACE FUNCTION send_production_to_qc(
    p_production_id BIGINT,
    p_user_id UUID,
    p_notes TEXT DEFAULT NULL
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
        -- Fallback to generating relative lot number
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
    -- Düzeltme: Yalnızca 'Pending' (Bekleyen) bir kayıt varsa oluşturma.
    -- 'Approved' veya 'Rejected' varsa yeni test talebine izin ver.
    INSERT INTO quality_batches (
        product_id, lot_no, status, production_id, reference_type, notes, created_at
    )
    SELECT v_product_id, v_lot_number, 'Pending', p_production_id, 'Production', COALESCE(p_notes, 'Üretimden talep edildi (Yeniden Test)'), NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM quality_batches 
        WHERE production_id = p_production_id 
        AND status = 'Pending'
    );
 
    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;
