-- ==========================================
-- GEÇMİŞ SATINALMALARI STOK HAREKETLERİNE EKLE (ÇÖZÜLDÜ)
-- ==========================================

-- 0. ADIM: Eksik kolonu ekle
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS lot_no TEXT;

-- 1. ADIM: Eksik olan hareketleri tespit edip ekleyelim
-- NOT: Veritabanı sadece 'In' veya 'Out' değerlerini kabul ettiği için 'In' kullanıyoruz.
INSERT INTO stock_movements (user_id, type, item_name, amount, lot_no, notes, created_at)
SELECT 
    p.user_id,
    'In' as type,
    p.item_name,
    p.qty as amount,
    p.lot_no,
    'Geçmiş Satınalma Kaydı (Geriye Dönük)' as notes,
    p.created_at
FROM purchases p
LEFT JOIN stock_movements sm ON (p.lot_no = sm.lot_no OR (p.lot_no IS NULL AND sm.lot_no IS NULL)) 
    AND p.item_name = sm.item_name 
    AND sm.type = 'In'
WHERE sm.id IS NULL 
AND p.lot_no IS NOT NULL;

-- 2. ADIM: Durumu kontrol et
SELECT item_name, amount, lot_no, notes, created_at
FROM stock_movements
WHERE notes LIKE '%Satınalma%'
ORDER BY created_at DESC;
