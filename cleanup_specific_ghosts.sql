-- PKG-001 ve RM-002 Hayalet Kayıt Temizleme (Hata Giderilmiş - V2)
-- Bu script hem ürün kodu hem de isim üzerinden eşleşme yapar.

BEGIN;

-- 1. İlgili Ürün ID'lerini bulalım
CREATE TEMP TABLE items_to_clean AS
SELECT id FROM inventory 
WHERE name ILIKE ANY (ARRAY['%PKG-001%', '%RM-002%', '%PKG001%', '%RM002%'])
   OR product_code ILIKE ANY (ARRAY['%PKG-001%', '%RM-002%', '%PKG001%', '%RM002%']);

-- 2. Stok Hareketlerini Sil
DELETE FROM stock_movements 
WHERE inventory_id IN (SELECT id FROM items_to_clean)
   OR item_name ILIKE ANY (ARRAY['%PKG-001%', '%RM-002%', '%PKG001%', '%RM002%']);

-- 3. Lot Kayıtlarını Sil
DELETE FROM lots 
WHERE inventory_id IN (SELECT id FROM items_to_clean)
   OR lot_no ILIKE ANY (ARRAY['%PKG-001%', '%RM-002%', '%PKG001%', '%RM002%']);

-- 4. Üretim Kayıtlarını Sil
DELETE FROM productions 
WHERE recipe_id IN (SELECT id FROM recipes WHERE product_id IN (SELECT id FROM items_to_clean))
   OR lot_number ILIKE ANY (ARRAY['%PKG-001%', '%RM-002%', '%PKG001%', '%RM002%']);

-- 5. Alım Kayıtlarını Sil (purchases tablosunda inventory_id yoktur, isim/lot kullanılır)
DELETE FROM purchases 
WHERE item_name ILIKE ANY (ARRAY['%PKG-001%', '%RM-002%', '%PKG001%', '%RM002%'])
   OR lot_no ILIKE ANY (ARRAY['%PKG-001%', '%RM-002%', '%PKG001%', '%RM002%']);

-- 6. Satış Kayıtlarını Sil (lot_number kullanılır)
DELETE FROM sales 
WHERE production_id IN (
    SELECT id FROM productions 
    WHERE recipe_id IN (SELECT id FROM recipes WHERE product_id IN (SELECT id FROM inventory WHERE name ILIKE ANY (ARRAY['%PKG-001%', '%RM-002%', '%PKG001%', '%RM002%'])))
) OR lot_number ILIKE ANY (ARRAY['%PKG-001%', '%RM-002%', '%PKG001%', '%RM002%']);

-- 7. Kalite Kontrol ve Diğer Bağlı Kayıtları Sil
DELETE FROM quality_batches WHERE product_id IN (SELECT id FROM items_to_clean);
DELETE FROM production_adjustments WHERE production_id IN (
    SELECT id FROM productions 
    WHERE recipe_id IN (SELECT id FROM recipes WHERE product_id IN (SELECT id FROM items_to_clean))
);

COMMIT;
