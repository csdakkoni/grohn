-- ==========================================
-- STOK GEÇMİŞİ BAKİYE YENİDEN HESAPLAMA (LEDGER FIX)
-- ==========================================

-- 1. ADIM: Tüm geçmişi kronolojik olarak yeniden hesapla
-- Bu işlem, her satırdaki 'current_stock' değerini o ana kadarki tüm hareketlerin toplamı yapacaktır.
UPDATE stock_movements sm
SET current_stock = sub.running_balance
FROM (
    SELECT 
        id,
        SUM(amount) OVER (PARTITION BY inventory_id ORDER BY created_at ASC, id ASC) as running_balance
    FROM stock_movements
) sub
WHERE sm.id = sub.id;

-- 2. ADIM: Son durumu kontrol et
SELECT 
    created_at,
    item_name,
    amount,
    current_stock as bakiye,
    reason,
    notes
FROM stock_movements
ORDER BY created_at DESC
LIMIT 20;
