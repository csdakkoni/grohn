-- ==========================================
-- TANI VE DÜZELTME YARDIMCISI
-- ==========================================

-- 1. ADIM: MER MA05 ve IBC için stok dökümünü görün
-- Bu liste, Dashboard'daki (lots tablosundaki) tüm parçaları gösterir.
-- Fazlalık yapan (750kg gibi) satırı buradan tespit edebilirsiniz.
SELECT 
    l.id as stok_kayit_id,
    i.name as urun_adi, 
    l.lot_no, 
    l.qty as miktar, 
    l.created_at as kayit_tarihi
FROM lots l
JOIN inventory i ON l.inventory_id = i.id
WHERE i.name ILIKE '%MER MA05%' OR i.name ILIKE '%IBC%'
ORDER BY i.name, l.created_at;

-- 2. ADIM: Satınalma kayıtlarını görün
-- Bu liste, Satınalma modülündeki gerçek kayıtları gösterir.
SELECT 
    id as alim_id, 
    item_name, 
    qty as alim_miktari, 
    lot_no, 
    created_at 
FROM purchases 
WHERE item_name ILIKE '%MER MA05%' OR item_name ILIKE '%IBC%';

-- 3. ADIM: DÜZELTME (Eğer fazlalık bir kayıt bulursanız)
-- Yukarıdaki listeden 'stok_kayit_id' numarasını bularak silebilirsiniz:
-- DELETE FROM lots WHERE id = BURAYA_ID_YAZIN;

-- 4. ADIM: OTOMATİK EŞİTLEME (Satınalma miktarını Stok miktarına zorla eşitler)
-- Not: Bu işlem lot_no üzerinden eşleşenleri günceller.
UPDATE lots l
SET qty = p.qty
FROM purchases p
JOIN inventory i ON i.name = p.item_name
WHERE l.lot_no = p.lot_no
AND l.inventory_id = i.id
AND (i.name ILIKE '%MER MA05%' OR i.name ILIKE '%IBC%');
