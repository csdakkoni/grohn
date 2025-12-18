-- DİKKAT: BU SCRİPT VERİTABANINDAKİ HER ŞEYİ SİLER!
-- Stok Kartları, Reçeteler, Müşteriler DAHİL her şey silinir.
-- TAMAMEN SIFIRDAN BAŞLAMAK İÇİNDİR.

BEGIN;

-- 1. İşlem Tabloları (Önce bağımlılar)
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE quality_results CASCADE;
TRUNCATE TABLE quality_batches CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE productions CASCADE;
TRUNCATE TABLE purchases CASCADE;
TRUNCATE TABLE lots CASCADE;

-- 2. Bağlantı Tabloları
TRUNCATE TABLE recipe_ingredients CASCADE;
TRUNCATE TABLE quality_specs CASCADE;

-- 3. Ana Veri Tabloları (Master Data)
TRUNCATE TABLE recipes CASCADE;
TRUNCATE TABLE inventory CASCADE;
TRUNCATE TABLE accounts CASCADE;
TRUNCATE TABLE quality_standards CASCADE;

-- Eğer Team/User tablolarını da silmek isterseniz buraya ekleyebilirsiniz ama Auth sistemi bozulabilir.
-- Genelde uygulama içi verileri silmek yeterlidir.

COMMIT;
