-- ==========================================
-- SAHİPSİZ (ORPHAN) STOK HAREKETLERİNİ TEMİZLE
-- ==========================================

-- 1. ADIM: Kaç tane sahipsiz kayıt olduğunu kontrol et (Bilgi amaçlı)
-- Satınalma tipinde olup, purchases tablosunda karşılığı kalmamış hareketleri bulur.
SELECT count(*) as orphan_count 
FROM stock_movements sm
WHERE sm.reason = 'Purchase' 
AND sm.type = 'In'
AND NOT EXISTS (
    SELECT 1 FROM purchases p WHERE p.id = sm.related_id
);

-- 2. ADIM: Sahipsiz hareketleri SİL
-- Bu işlem, silinmiş alımlardan kalan "hayalet" satırları temizler.
DELETE FROM stock_movements
WHERE reason = 'Purchase'
AND type = 'In'
AND NOT EXISTS (
    SELECT 1 FROM purchases p WHERE p.id = related_id
);

-- 3. ADIM: Son durumu raporla
SELECT id, item_name, amount, notes, created_at
FROM stock_movements
WHERE reason = 'Purchase'
ORDER BY created_at DESC
LIMIT 10;
