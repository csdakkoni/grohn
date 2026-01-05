-- Üretim Silme Mantığını Düzeltme (Gelişmiş İade Mantığı)
-- Bu fonksiyon hem üretimi siler hem de kullanılan malzemeleri stoğa geri yükler.

CREATE OR REPLACE FUNCTION delete_production(p_production_id BIGINT)
RETURNS JSON AS $body$
DECLARE
    v_prod RECORD;
    v_item_id BIGINT;
    v_move RECORD;
BEGIN
    -- 1. Üretim bilgisini al
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN 
        RETURN json_build_object('success', false, 'error', 'Üretim kaydı bulunamadı.'); 
    END IF;

    -- 2. Eğer bu üretimden satış yapılmışsa silmeye izin verme
    IF EXISTS (SELECT 1 FROM sales WHERE production_id = p_production_id) THEN
        RETURN json_build_object('success', false, 'error', 'Bu üretimden satış yapılmış! Önce ilgili satış kayıtlarını silmelisiniz.');
    END IF;

    -- 3. Stok İadesi (Geri Yükleme)
    -- Üretimde harcanan hammadde ve ambalajları geri stoğa ekle
    FOR v_move IN 
        SELECT inventory_id, amount 
        FROM stock_movements 
        WHERE related_id = p_production_id 
        AND type = 'Out' 
        AND reason IN ('Production_Usage', 'Production_Plan', 'Adjustment_Usage')
    LOOP
        -- Harcanan miktar kadar yeni bir lot girişi yap (Geri iade olarak)
        INSERT INTO lots (inventory_id, lot_no, qty)
        VALUES (v_move.inventory_id, 'RE-' || COALESCE(v_prod.lot_number, p_production_id::text), ABS(v_move.amount));
    END LOOP;

    -- 4. Mamul Stok Temizliği
    -- Reçeteden ürün ID'sini bul
    SELECT product_id INTO v_item_id FROM recipes WHERE id = v_prod.recipe_id;
    IF v_item_id IS NOT NULL THEN
        DELETE FROM lots WHERE lot_no = v_prod.lot_number AND inventory_id = v_item_id;
    END IF;

    -- 5. Kayıtları Sil
    -- Stok Hareketlerini Sil
    DELETE FROM stock_movements WHERE related_id = p_production_id;
    -- Kalite Kontrol Kayıtlarını Sil
    DELETE FROM quality_batches WHERE production_id = p_production_id;
    -- Ek sarfiyatları sil
    DELETE FROM production_adjustments WHERE production_id = p_production_id;
    -- Üretim Kaydını Sil
    DELETE FROM productions WHERE id = p_production_id;

    RETURN json_build_object('success', true);
END;
$body$ LANGUAGE plpgsql;
