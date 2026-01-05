-- PKG001 Kodlu Hayalet Kaydı Silme Scripti

BEGIN;

-- 1. İlgili hareketleri temizliyoruz
-- Not: item_name veya related_id üzerinden kontrol ederek en güvenli silmeyi yapıyoruz.
DELETE FROM stock_movements 
WHERE item_name LIKE '%PKG001%'
OR inventory_id IN (SELECT id FROM inventory WHERE name LIKE '%PKG001%');

COMMIT;

-- Bilgi: 'fix_ledger_propagation.sql' tetikleyicisi yüklü olduğu sürece
-- bu silme işleminden sonra PKG001'in tüm stok bakiyeleri otomatik olarak düzelecektir.
