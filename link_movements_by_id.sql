-- ==========================================
-- STOK HAREKETLERİNİ SATINALMA ID İLE EŞLEŞTİR (DÜZENLEME SORUNU ÇÖZÜMÜ)
-- ==========================================

-- 1. ADIM: Mevcut Satınalma hareketlerini ilgili satınalma ID'si ile eşleştir
UPDATE stock_movements sm
SET related_id = p.id
FROM purchases p
WHERE sm.lot_no = p.lot_no 
AND sm.item_name = p.item_name 
AND sm.reason = 'Purchase'
AND sm.related_id IS NULL;

-- 2. ADIM: Mükerrer kayıt kontrolü (Opsiyonel Bilgilendirme)
-- Eğer aynı purchase ID için birden fazla movement kalmışsa, eski olanları silebiliriz.
-- Bu script şimdilik sadece eşleştirme yapar.

-- 3. ADIM: Durumu Kontrol Et
SELECT 
    sm.id as movement_id,
    sm.related_id as purchase_id,
    sm.item_name,
    sm.amount,
    sm.notes
FROM stock_movements sm
WHERE sm.reason = 'Purchase'
ORDER BY sm.created_at DESC
LIMIT 20;
