-- TEMİZLİK SCRİPTİ (RESET DATABASE)
-- Bu script veritabanındaki verileri siler.

-- 1. SEÇENEK: SADECE HAREKETLERİ SİL (Stok kartları ve Reçeteler KALIR)
-- Satış, Üretim, Satın Alma, Stok Hareketleri ve Kalite Kontrol sonuçları silinir.
-- Ama "Un", "Şeker" gibi stok tanımları ve "Kek Reçetesi" gibi tanımlar kalır.
-- Teste başlamak için genelde BU YETERLİDİR.
TRUNCATE TABLE 
  sales, 
  productions, 
  purchases, 
  stock_movements, 
  quality_results,
  quality_batches,
  recipe_ingredients,
  recipes, 
  inventory,
  quality_specs,
  accounts
  RESTART IDENTITY CASCADE;

-- NOT: Bakiyeler (Accounts) tablosunu sıfırlamak istiyorsanız, 2. seçenekteki 'accounts' kısmını kullanabilirsiniz.
