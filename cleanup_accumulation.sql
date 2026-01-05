-- ==========================================
-- AKÜMÜLASYON VE MÜKERRER KAYIT TEMİZLİĞİ (DÜZELTİLMİŞ)
-- ==========================================

-- 1. ADIM: Hangi stok kayıtlarının (Lot) bir alımı yok? (Tespit)
SELECT 
    l.id as stok_id,
    i.name as urun,
    l.lot_no,
    l.qty as miktar,
    l.created_at
FROM lots l
JOIN inventory i ON l.inventory_id = i.id
LEFT JOIN purchases p ON i.name = p.item_name AND l.lot_no = p.lot_no
WHERE p.id IS NULL                  
AND l.lot_no NOT LIKE 'GR-%'       
ORDER BY l.created_at DESC;

-- 2. ADIM: TEMİZLİK
DELETE FROM lots
WHERE id IN (
    SELECT l.id
    FROM lots l
    JOIN inventory i ON l.inventory_id = i.id
    LEFT JOIN purchases p ON i.name = p.item_name AND l.lot_no = p.lot_no
    WHERE p.id IS NULL
    AND l.lot_no NOT LIKE 'GR-%'
);

-- 3. ADIM: DOĞRULAMA
SELECT 
    i.name, 
    SUM(l.qty) as dashboard_toplam,
    (SELECT SUM(qty) FROM purchases WHERE item_name = i.name) as satinalma_toplam
FROM inventory i
JOIN lots l ON l.inventory_id = i.id
GROUP BY i.name;
