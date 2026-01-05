-- [STOK KARTI SİLME - PRD-002 TEMİZLİK SCRIPTİ - V5]
-- Bu script, 'PRD-002' kodlu ürünün silinmesini engelleyen tüm bağlı kayıtları temizler.
-- V5: 'ibc_movements' temizliği eklendi.

DO $$
DECLARE
    v_target_code TEXT := 'PRD-002';
    v_inv_id BIGINT;
    v_inv_name TEXT;
    v_recipe_ids BIGINT[];
    v_prod_ids BIGINT[];
    v_sale_ids BIGINT[];
    v_sale_count INTEGER;
BEGIN
    -- 1. Ürün bilgilerini al
    SELECT id, name INTO v_inv_id, v_inv_name FROM inventory WHERE product_code = v_target_code;
    
    IF v_inv_id IS NULL THEN
        RAISE NOTICE 'Ürün (%) bulunamadı. Zaten silinmiş olabilir.', v_target_code;
        RETURN;
    END IF;

    RAISE NOTICE 'Ürün bulundu: ID=%, Kod=%, İsim="%"', v_inv_id, v_target_code, v_inv_name;

    -- 2. Bağlı Satışları Belirle (Production veya Lot üzerinden)
    SELECT array_agg(id) INTO v_recipe_ids FROM recipes WHERE product_id = v_inv_id;
    IF v_recipe_ids IS NOT NULL THEN
        SELECT array_agg(id) INTO v_prod_ids FROM productions WHERE recipe_id = ANY(v_recipe_ids);
        IF v_prod_ids IS NOT NULL THEN
            SELECT array_agg(id) INTO v_sale_ids FROM sales WHERE production_id = ANY(v_prod_ids);
        END IF;
    END IF;

    -- Lot üzerinden bağlı satışlar (varsa v_sale_ids'e ekle)
    SELECT array_agg(id) INTO v_sale_ids FROM (
        SELECT id FROM sales WHERE lot_no IN (SELECT lot_no FROM lots WHERE inventory_id = v_inv_id)
        UNION
        SELECT unnest(v_sale_ids)
    ) s;

    -- 3. IBC Hareketlerini Temizle
    IF v_sale_ids IS NOT NULL THEN
        RAISE NOTICE 'Bağlı IBC hareketleri temizleniyor (Satiş bazlı)...';
        DELETE FROM ibc_movements WHERE sale_id = ANY(v_sale_ids);
    END IF;
    
    -- Lot numarası bazlı IBC hareketleri temizle (Notlardan eşleştirerek)
    RAISE NOTICE 'Lot numarası bazlı IBC hareketleri temizleniyor (Notlardan eşleştirerek)...';
    DELETE FROM ibc_movements WHERE notes LIKE '%Lot: %' 
    AND (
        EXISTS (SELECT 1 FROM lots WHERE inventory_id = v_inv_id AND notes LIKE '%' || lot_no || '%')
        OR
        EXISTS (SELECT 1 FROM productions p JOIN recipes r ON p.recipe_id = r.id 
                WHERE r.product_id = v_inv_id AND notes LIKE '%' || p.lot_number || '%')
    );

    -- 4. Satışları Temizle
    IF v_sale_ids IS NOT NULL THEN
        RAISE NOTICE '% adet bağlı Satış siliniyor...', array_length(v_sale_ids, 1);
        DELETE FROM sales WHERE id = ANY(v_sale_ids);
    END IF;

    -- 5. Üretimleri ve Kalite Kontrol Kayıtlarını Temizle
    IF v_prod_ids IS NOT NULL THEN
        RAISE NOTICE '% adet bağlı Üretim kaydı temizleniyor...', array_length(v_prod_ids, 1);
        
        -- Kalite Kontrol
        DELETE FROM quality_batches WHERE production_id = ANY(v_prod_ids);
        
        -- Ek sarfiyatlar
        DELETE FROM production_adjustments WHERE production_id = ANY(v_prod_ids);
        
        -- Stok Hareketleri
        DELETE FROM stock_movements WHERE related_id = ANY(v_prod_ids) AND reason IN ('Production_Output', 'Production_Usage');
        
        -- Ana Üretim Kaydı
        DELETE FROM productions WHERE id = ANY(v_prod_ids);
    END IF;

    -- 6. Reçeteleri Temizle
    IF v_recipe_ids IS NOT NULL THEN
        RAISE NOTICE '% adet bağlı Reçete kaydı temizleniyor...', array_length(v_recipe_ids, 1);
        DELETE FROM recipe_ingredients WHERE recipe_id = ANY(v_recipe_ids);
        DELETE FROM recipes WHERE id = ANY(v_recipe_ids);
    END IF;

    -- 7. Bu ürünün hammadde olarak kullanıldığı diğer reçeteler
    DELETE FROM recipe_ingredients WHERE item_id = v_inv_id;

    -- 8. Kalite Şartnamelerini Temizle
    DELETE FROM quality_specs WHERE product_id = v_inv_id;

    -- 9. Satınalmaları Temizle
    DELETE FROM stock_movements WHERE related_id IN (SELECT id FROM purchases WHERE item_name = v_inv_name) AND reason = 'Purchase';
    DELETE FROM purchases WHERE item_name = v_inv_name;

    -- 10. LOT ve Stok Hareketlerini Temizle
    DELETE FROM lots WHERE inventory_id = v_inv_id;
    DELETE FROM stock_movements WHERE inventory_id = v_inv_id;

    -- 11. Final Silme
    DELETE FROM inventory WHERE id = v_inv_id;

    RAISE NOTICE 'Ürün % (% ID) ve tüm bağlı kayıtlar başarıyla silindi.', v_target_code, v_inv_id;

END $$;
