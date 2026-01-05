-- FIX CALCULATION HISTORY SCHEMA
-- Aligns table with PriceCalculatorModule.js implementation

DROP TABLE IF EXISTS calculation_history;

CREATE TABLE calculation_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES team_members(id),
    recipe_id BIGINT REFERENCES recipes(id),
    product_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit_cost NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    currency TEXT NOT NULL,
    breakdown JSONB NOT NULL,
    parameters JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
