-- TAM İŞLEM SIFIRLAMA SCRIPTI (Transactional Data Reset)
-- DİKKAT: Bu script tüm stok hareketlerini, üretimleri, satışları ve alımları SİLER.
-- Ürün listesi (inventory) ve Reçeteler (recipes) korunur.

BEGIN;

-- 1. Bağımlı tabloları temizle (Sıralama önemlidir)
TRUNCATE TABLE quality_results CASCADE;
TRUNCATE TABLE quality_batches CASCADE;
TRUNCATE TABLE production_adjustments CASCADE;
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE lots CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE productions CASCADE;
TRUNCATE TABLE purchases CASCADE;

-- 2. Eğer varsa özel sayaçları/sekansları sıfırla (Opsiyonel)
-- Bu kısımlar sizin sisteminizdeki sekans isimlerine göre değişebilir.
-- Genellikle gerek yoktur because serial/identity sütunları otomatik devam eder.

COMMIT;

-- Bilgi: Bu işlemden sonra "Stok Yönetimi" ve "Üretim" ekranlarınız tamamen boşalacaktır.
-- Yeni yapacağınız alımlar "L-YYMM-001" formatında ve 0 bakiye ile tertemiz başlayacaktır.
