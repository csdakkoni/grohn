-- Kalite Kontrol Talep Mantığını Düzeltme
-- Sorun: Bir üretim daha önce RED aldıysa, `quality_batches` tablosunda kaydı olduğu için
-- sistem ikinci kez talep açılmasına izin vermiyordu ("WHERE NOT EXISTS" kısıtlaması yüzünden).

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
    -- Düzeltme: Eğer zaten 'Pending' (Bekleyen) veya 'Approved' (Onaylı) bir kayıt varsa oluşturma.
    -- Ama 'Rejected' (Red) varsa YENİ bir kayıt oluşturmaya izin ver.
    INSERT INTO quality_batches (
        product_id, lot_no, status, production_id, reference_type, notes, created_at
    )
    SELECT v_product_id, v_lot_number, 'Pending', p_production_id, 'Production', 'Üretimden talep edildi (Revize)', NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM quality_batches 
        WHERE production_id = p_production_id 
        AND status IN ('Pending', 'Approved')
    );

    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;
