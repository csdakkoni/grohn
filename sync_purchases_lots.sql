-- ==========================================
-- DATA SYNC & CLEANUP SCRIPT
-- ==========================================

-- 1. Sync lot quantities to match purchase records (Fixes edited IBC etc.)
UPDATE lots l
SET qty = p.qty
FROM purchases p
JOIN inventory i ON i.name = p.item_name
WHERE l.lot_no = p.lot_no
AND l.inventory_id = i.id;

-- 2. Identify "Ghost Lots" (Lots from purchases that might be duplicates or orphans)
-- This query helps YOU see if there are extra lots.
-- These are lots that don't match any purchase record but have typical purchase-like names.
SELECT l.id, i.name, l.lot_no, l.qty, l.created_at
FROM lots l
JOIN inventory i ON l.inventory_id = i.id
LEFT JOIN purchases p ON l.lot_no = p.lot_no AND i.name = p.item_name
WHERE p.id IS NULL 
AND NOT (l.lot_no LIKE 'GR-%') -- Exclude production outputs
ORDER BY l.created_at DESC;

-- 3. If you find extra 750kg for MER MA05, you can delete it specifically by its lot number.
-- Example: DELETE FROM lots WHERE lot_no = 'EXTRA-LOT-NO';

-- 4. Verify Total Stock per Item vs Purchase Totals
SELECT i.name, 
       SUM(l.qty) as current_stock_in_dashboard, 
       COALESCE((SELECT SUM(qty) FROM purchases WHERE item_name = i.name), 0) as total_purchased
FROM inventory i
LEFT JOIN lots l ON l.inventory_id = i.id
GROUP BY i.name
HAVING SUM(l.qty) != COALESCE((SELECT SUM(qty) FROM purchases WHERE item_name = i.name), 0);
