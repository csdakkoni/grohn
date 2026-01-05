const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ebynzzrcgpultcsnvsxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieW56enJjZ3B1bHRjc252c3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTY2NjcsImV4cCI6MjA3OTk5MjY2N30.w5gdtpDibXl4t1RbXIfqmK_9YdWPCOtRsbYm35bhUKA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function investigate() {
    console.log('--- Investigating PRD-002 ---');

    // 1. Get Inventory ID
    const { data: inv, error: invError } = await supabase
        .from('inventory')
        .select('id, name')
        .eq('product_code', 'PRD-002')
        .maybeSingle();

    if (invError) {
        console.error('Error fetching inventory:', invError);
        return;
    }

    if (!inv) {
        console.log('PRD-002 not found in inventory.');
        return;
    }

    const v_id = inv.id;
    console.log(`Found PRD-002: id=${v_id}, name="${inv.name}"`);

    // 2. Check Lots
    const { count: lotCount } = await supabase
        .from('lots')
        .select('*', { count: 'exact', head: true })
        .eq('inventory_id', v_id);
    console.log(`Lots: ${lotCount}`);

    // 3. Check Purchases
    const { count: purchaseCount } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('inventory_id', v_id);
    console.log(`Purchases (by inventory_id): ${purchaseCount}`);

    // 4. Check Recipes (as product)
    const { count: recipeCount } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', v_id);
    console.log(`Recipes (as product): ${recipeCount}`);

    // 5. Check Recipe Ingredients
    const { count: ingredientCount } = await supabase
        .from('recipe_ingredients')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', v_id);
    console.log(`Recipe Ingredients: ${ingredientCount}`);

    // 6. Check Productions (linked to recipes that output PRD-002)
    const { data: linkedRecipes } = await supabase
        .from('recipes')
        .select('id')
        .eq('product_id', v_id);

    if (linkedRecipes && linkedRecipes.length > 0) {
        const recipeIds = linkedRecipes.map(r => r.id);
        const { count: prodCount } = await supabase
            .from('productions')
            .select('*', { count: 'exact', head: true })
            .in('recipe_id', recipeIds);
        console.log(`Productions (linked via recipe): ${prodCount}`);
    } else {
        console.log('Productions (linked via recipe): 0');
    }

    // 7. Check Stock Movements
    const { count: moveCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('inventory_id', v_id);
    console.log(`Stock Movements: ${moveCount}`);

    console.log('--- Investigation Complete ---');
}

investigate();
