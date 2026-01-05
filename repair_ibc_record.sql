-- ==========================================
-- IBC KAYDI TAMİR SCRIPTİ
-- ==========================================

-- 1. ADIM: Satınalma kaydına geçici bir LOT numarası verin
-- (Sizin kaydınızda ID 2 ve LOT null göründüğü için bunu yapıyoruz)
UPDATE purchases 
SET lot_no = 'OTO-IBC-FIX' 
WHERE id = 2 AND lot_no IS NULL;

-- 2. ADIM: Dashboard için stok kaydını (lots) oluşturun
-- Bu işlem, IBC'nin Dashboard'da görünmesini sağlayacaktır.
INSERT INTO lots (inventory_id, lot_no, qty)
SELECT i.id, p.lot_no, p.qty
FROM purchases p
JOIN inventory i ON i.name = p.item_name
WHERE p.id = 2 
AND NOT EXISTS (SELECT 1 FROM lots WHERE lot_no = 'OTO-IBC-FIX');

-- 3. ADIM: Durumu kontrol edin
SELECT p.item_name, p.lot_no, p.qty as alim_miktari, l.qty as dashboard_stok
FROM purchases p
LEFT JOIN lots l ON l.lot_no = p.lot_no
WHERE p.id = 2;
