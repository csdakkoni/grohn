-- Ürün Kodlarını (RM-001, FG-001 vb.) Otomatikleştiren Script

-- 1. Kod Üretme Fonksiyonu
CREATE OR REPLACE FUNCTION generate_product_code_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece product_code boşsa çalışır
    UPDATE inventory
    SET product_code = CASE 
        WHEN NEW.type = 'Hammadde' THEN 'RM-' || LPAD(NEW.id::text, 3, '0')
        WHEN NEW.type = 'Mamul' THEN 'FG-' || LPAD(NEW.id::text, 3, '0')
        WHEN NEW.type = 'Yarı Mamul' THEN 'SM-' || LPAD(NEW.id::text, 3, '0')
        WHEN NEW.type = 'Ambalaj' THEN 'PKG-' || LPAD(NEW.id::text, 3, '0')
        ELSE 'GEN-' || LPAD(NEW.id::text, 3, '0')
    END
    WHERE id = NEW.id AND product_code IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger Oluştur (Her yeni kayıttan sonra çalışır)
DROP TRIGGER IF EXISTS trg_set_product_code ON inventory;
CREATE TRIGGER trg_set_product_code
AFTER INSERT ON inventory
FOR EACH ROW
EXECUTE FUNCTION generate_product_code_trigger();

-- 3. Mevcut Kayıtları Düzelt (Geriye Dönük)
UPDATE inventory
SET product_code = CASE 
    WHEN type = 'Hammadde' THEN 'RM-' || LPAD(id::text, 3, '0')
    WHEN type = 'Mamul' THEN 'FG-' || LPAD(id::text, 3, '0')
    WHEN type = 'Yarı Mamul' THEN 'SM-' || LPAD(id::text, 3, '0')
    WHEN type = 'Ambalaj' THEN 'PKG-' || LPAD(id::text, 3, '0')
    ELSE 'GEN-' || LPAD(id::text, 3, '0')
END
WHERE product_code IS NULL OR product_code = '';
