
import { createClient } from '@supabase/supabase-js';

// Copy from supabaseClient.js (hardcoded fallback)
const supabaseUrl = 'https://ebynzzrcgpultcsnvsxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieW56enJjZ3B1bHRjc252c3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTY2NjcsImV4cCI6MjA3OTk5MjY2N30.w5gdtpDibXl4t1RbXIfqmK_9YdWPCOtRsbYm35bhUKA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFlow() {
    console.log("🚀 Starting QC Functional Test...");

    try {
        // 1. Setup: Get a Product ID (Inventory)
        let { data: products } = await supabase.from('inventory').select('id, name').limit(1);
        let product;

        if (!products || products.length === 0) {
            console.log("⚠️ No inventory items found. Creating a dummy product for testing...");
            const { data: newProd, error: prodError } = await supabase.from('inventory').insert({
                name: 'Test Product ' + Date.now(),
                type: 'Hammadde',
                unit: 'kg',
                cost: 10,
                track_stock: true
                // user_id might be needed if RLS enforces it. 
            }).select().single();

            if (prodError) throw new Error("Failed to create dummy product: " + prodError.message);
            product = newProd;
        } else {
            product = products[0];
        }
        console.log(`Using Product: ${product.name} (ID: ${product.id})`);

        // 2. Create a Spec
        console.log("Step 1: Creating a Test Spec...");
        const { data: spec, error: specError } = await supabase.from('quality_specs').insert({
            product_id: product.id,
            parameter_name: 'TestParam_' + Date.now(),
            min_value: 5.0,
            max_value: 10.0,
            unit: 'pH',
            method: 'AutoTest'
        }).select().single();

        if (specError) throw new Error("Spec creation failed: " + specError.message);
        console.log("✅ Spec created ID:", spec.id);

        // 3. Create a Batch
        console.log("Step 2: Creating a Test Batch...");
        const { data: batch, error: batchError } = await supabase.from('quality_batches').insert({
            product_id: product.id,
            lot_no: 'TEST-LOT-' + Date.now(),
            status: 'Pending',
            reference_type: 'AutoText'
        }).select().single();

        if (batchError) throw new Error("Batch creation failed: " + batchError.message);
        console.log("✅ Batch created ID:", batch.id);

        // 4. Add Result (Pass)
        console.log("Step 3: Adding a Result...");
        const { data: res, error: resError } = await supabase.from('quality_results').insert({
            batch_id: batch.id,
            spec_id: spec.id,
            parameter_name: spec.parameter_name,
            measured_value: 7.5,
            result: 'Pass',
            tested_by: 'Bot'
        }).select().single();

        if (resError) throw new Error("Result insertion failed: " + resError.message);
        console.log("✅ Result added ID:", res.id);

        // 5. Update Batch Status
        console.log("Step 4: Updating Batch Status...");
        const { error: updateError } = await supabase.from('quality_batches')
            .update({ status: 'Approved' })
            .eq('id', batch.id);

        if (updateError) throw new Error("Batch update failed: " + updateError.message);
        console.log("✅ Batch status updated to Approved.");

        // Clean up (Optional, maybe keep for debug)
        console.log("🎉 Functional Test Passed Successfully!");

    } catch (error) {
        console.error("❌ Test Failed:", error.message);
        process.exit(1);
    }
}

testFlow();
