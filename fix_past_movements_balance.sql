-- ==========================================
-- STOK HAREKETLERİ VERİ TAMAMLAMA VE BAKİYE DÜZELTME
-- ==========================================

-- 1. ADIM: Eksik inventory_id ve reason alanlarını doldur
UPDATE stock_movements sm
SET 
    inventory_id = i.id,
    reason = CASE 
        WHEN sm.notes LIKE 'Satınalma%' THEN 'Purchase'
        WHEN sm.notes LIKE 'Üretim%Hammadde%' THEN 'Production_Usage'
        WHEN sm.notes LIKE 'Üretim%Mamul%' THEN 'Production_Output'
        WHEN sm.notes LIKE 'Üretim%Ambalaj%' THEN 'Production_Packaging'
        WHEN sm.reason IS NULL THEN 'Purchase' -- Varsayılan
        ELSE sm.reason
    END
FROM inventory i
WHERE sm.item_name = i.name 
AND (sm.inventory_id IS NULL OR sm.reason IS NULL);

-- 2. ADIM: Bakiyeleri (current_stock) Mevcut Stok Durumuna Göre Güncelle
-- Not: Bu adım, geçmişteki her adımın bakiyesini tam olarak hesaplamak yerine,
-- en son girilen hareketlerin bakiyesini DASHBOARD (lots) toplamı ile eşitler.
WITH current_totals AS (
    SELECT inventory_id, SUM(qty) as total_qty
    FROM lots
    GROUP BY inventory_id
)
UPDATE stock_movements sm
SET current_stock = ct.total_qty
FROM current_totals ct
WHERE sm.inventory_id = ct.inventory_id
AND (sm.current_stock IS NULL OR sm.current_stock = 0);

-- 3. ADIM: Kontrol Et
SELECT 
    sm.created_at,
    sm.item_name,
    i.product_code,
    sm.type,
    sm.reason,
    sm.amount,
    sm.current_stock as bakiye,
    sm.notes
FROM stock_movements sm
JOIN inventory i ON sm.inventory_id = i.id
ORDER BY sm.created_at DESC;
