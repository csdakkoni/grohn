CREATE OR REPLACE FUNCTION generate_lot_number(p_user_id UUID, p_date DATE)
RETURNS TEXT AS $$
DECLARE
    date_str TEXT;
    seq INTEGER;
    new_lot TEXT;
    exists_check BOOLEAN;
BEGIN
    date_str := to_char(p_date, 'DDMMYY');
    
    -- User requested format: GRDDMMYY-N (e.g., GR181225-1, GR181225-2)
    -- Prefix: GR + Date
    
    -- Find the highest sequence number for this date prefix
    -- Looking for patterns like 'GR181225-%'
    SELECT COALESCE(MAX(CAST(NULLIF(SPLIT_PART(lot_number, '-', 2), '') AS INTEGER)), 0) + 1
    INTO seq
    FROM productions
    WHERE lot_number LIKE 'GR' || date_str || '-%';

    -- Safety Loop to ensure uniqueness
    LOOP
        new_lot := 'GR' || date_str || '-' || seq::TEXT;
        
        -- Check both Productions and potential Inventory Lots to be safe
        SELECT EXISTS(SELECT 1 FROM productions WHERE lot_number = new_lot) INTO exists_check;
        
        IF NOT exists_check THEN
             -- Also check 'lots' table just in case manually created
             SELECT EXISTS(SELECT 1 FROM lots WHERE lot_no = new_lot) INTO exists_check;
             IF NOT exists_check THEN
                EXIT; -- Unique
             END IF;
        END IF;
        
        -- Collision, try next
        seq := seq + 1;
    END LOOP;

    RETURN new_lot;
END;
$$ LANGUAGE plpgsql;
