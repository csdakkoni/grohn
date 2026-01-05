-- ======================================================
-- CATEGORY-BASED SEQUENTIAL PRODUCT CODES (RM, PKG, PRD)
-- ======================================================

-- 1. FUNCTION: Get next sequential code for a prefix
CREATE OR REPLACE FUNCTION generate_next_product_code(p_type TEXT)
RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_count INTEGER;
BEGIN
    v_prefix := CASE 
        WHEN p_type = 'Hammadde' THEN 'RM-'
        WHEN p_type = 'Ambalaj' THEN 'PKG-'
        WHEN p_type = 'Mamul' THEN 'PRD-'
        ELSE 'MISC-'
    END;

    SELECT COUNT(*) INTO v_count 
    FROM inventory 
    WHERE type = p_type;

    RETURN v_prefix || LPAD((v_count + 1)::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER: Automatically assign code on insert if not provided
CREATE OR REPLACE FUNCTION trg_assign_product_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.product_code IS NULL OR NEW.product_code = '' OR NEW.product_code LIKE 'HM-%' OR NEW.product_code LIKE 'AMB-%' OR NEW.product_code LIKE 'ITEM-%' THEN
        NEW.product_code := generate_next_product_code(NEW.type);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assign_product_code ON inventory;
CREATE TRIGGER trigger_assign_product_code
BEFORE INSERT ON inventory
FOR EACH ROW
EXECUTE FUNCTION trg_assign_product_code();

-- 3. MIGRATION: Update existing codes to the new format
-- We'll do this carefully to ensure sequential integrity
DO $$
DECLARE
    v_rec RECORD;
    v_new_code TEXT;
    v_counters JSONB := '{"Hammadde": 0, "Ambalaj": 0, "Mamul": 0}'::jsonb;
    v_type TEXT;
    v_prefix TEXT;
    v_count INTEGER;
BEGIN
    -- Temporary disable trigger during migration
    ALTER TABLE inventory DISABLE TRIGGER trigger_assign_product_code;

    FOR v_rec IN (SELECT id, type FROM inventory ORDER BY created_at ASC, id ASC) LOOP
        v_type := v_rec.type;
        v_prefix := CASE 
            WHEN v_type = 'Hammadde' THEN 'RM-'
            WHEN v_type = 'Ambalaj' THEN 'PKG-'
            WHEN v_type = 'Mamul' THEN 'PRD-'
            ELSE 'MISC-'
        END;
        
        v_count := (v_counters->>v_type)::int + 1;
        v_counters := v_counters || jsonb_build_object(v_type, v_count);
        
        v_new_code := v_prefix || LPAD(v_count::text, 3, '0');
        
        UPDATE inventory SET product_code = v_new_code WHERE id = v_rec.id;
    END LOOP;

    ALTER TABLE inventory ENABLE TRIGGER trigger_assign_product_code;
END $$;
