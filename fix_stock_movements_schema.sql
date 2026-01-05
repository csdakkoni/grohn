-- ==========================================
-- STOK HAREKETLERİ ŞEMA DÜZELTME
-- ==========================================

-- 1. ADIM: stock_movements tablosuna lot_no kolonunu ekle
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS lot_no TEXT;

-- 2. ADIM: lot_no kolonu için açıklama ekle (Opsiyonel)
COMMENT ON COLUMN stock_movements.lot_no IS 'Hangi LOT veya üretim partisine ait olduğu bilgisi.';

-- 3. ADIM: Verileri kontrol et
SELECT * FROM stock_movements LIMIT 5;
