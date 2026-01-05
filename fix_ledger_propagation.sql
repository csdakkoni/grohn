-- ======================================================
-- AUTOMATIC STOCK LEDGER RECALCULATION (RIPPLE EFFECT)
-- ======================================================

-- 1. FUNCTION: Recalculate balance for a specific product
CREATE OR REPLACE FUNCTION recalculate_item_ledger(p_inventory_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE stock_movements sm
    SET current_stock = sub.running_balance
    FROM (
        SELECT 
            id,
            SUM(amount) OVER (PARTITION BY inventory_id ORDER BY created_at ASC, id ASC) as running_balance
        FROM stock_movements
        WHERE inventory_id = p_inventory_id
    ) sub
    WHERE sm.id = sub.id
    AND (sm.current_stock IS DISTINCT FROM sub.running_balance); -- Optimize: Only update if changed
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER FUNCTION: Handle movements changes
CREATE OR REPLACE FUNCTION trg_recalculate_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_inv_id BIGINT;
BEGIN
    -- RECURSION GUARD: Prevent infinite trigger loops
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    -- Identify which product's ledger needs update
    IF (TG_OP = 'DELETE') THEN
        v_inv_id := OLD.inventory_id;
    ELSE
        v_inv_id := NEW.inventory_id;
    END IF;

    -- Trigger the recalculation
    PERFORM recalculate_item_ledger(v_inv_id);

    -- If product changed during update, recalculate OLD product too
    IF (TG_OP = 'UPDATE' AND OLD.inventory_id != NEW.inventory_id) THEN
        PERFORM recalculate_item_ledger(OLD.inventory_id);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. ATTACH TRIGGER
DROP TRIGGER IF EXISTS trigger_recalculate_stock_ledger ON stock_movements;
CREATE TRIGGER trigger_recalculate_stock_ledger
AFTER INSERT OR UPDATE OR DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION trg_recalculate_ledger();

-- 4. INITIAL SYNC: Recalculate everything once (Disable trigger temporarily to be faster/safer)
ALTER TABLE stock_movements DISABLE TRIGGER trigger_recalculate_stock_ledger;

UPDATE stock_movements sm
SET current_stock = sub.running_balance
FROM (
    SELECT 
        id,
        SUM(amount) OVER (PARTITION BY inventory_id ORDER BY created_at ASC, id ASC) as running_balance
    FROM stock_movements
) sub
WHERE sm.id = sub.id
AND (sm.current_stock IS DISTINCT FROM sub.running_balance);

ALTER TABLE stock_movements ENABLE TRIGGER trigger_recalculate_stock_ledger;
