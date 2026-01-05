-- "Hayalet" (Orphaned) Stok Hareketlerini Temizleme Scripti
-- Bu script, ana tabloları (productions, purchases, sales) silinmiş olmasına rağmen
-- stock_movements tablosunda kalan yetim kayıtları temizler.

BEGIN;

-- 1. Üretim kaynaklı hayalet kayıtları (Production_Usage veya Production_Output)
DELETE FROM stock_movements
WHERE (reason = 'Production_Usage' OR reason = 'Production_Output')
AND related_id NOT IN (SELECT id FROM productions);

-- 2. Alım kaynaklı hayalet kayıtları (Purchase)
DELETE FROM stock_movements
WHERE reason = 'Purchase'
AND related_id NOT IN (SELECT id FROM purchases);

-- 3. Satış kaynaklı hayalet kayıtları (Sale)
DELETE FROM stock_movements
WHERE reason = 'Sale'
AND related_id NOT IN (SELECT id FROM sales);

COMMIT;

-- Bilgi: Eğer veritabanınızda 'fix_ledger_propagation.sql' tetikleyicisi (trigger) yüklüyse, 
-- bu silme işlemlerinden sonra stok bakiyeleri otomatik olarak yeniden hesaplanacaktır.
