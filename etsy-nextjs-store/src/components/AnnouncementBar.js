"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AnnouncementBar() {
    const [config, setConfig] = useState(null);

    useEffect(() => {
        async function fetchSettings() {
            const { data, error } = await supabase
                .from('store_settings')
                .select('value')
                .eq('key', 'announcement_bar')
                .single();

            if (data && data.value) {
                setConfig(data.value);
            }
        }
        fetchSettings();
    }, []);

    if (!config || !config.is_active || !config.text) return null;

    return (
        <div
            className="w-full py-2.5 px-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] transition-all animate-fade-in"
            style={{
                backgroundColor: config.bg_color || '#000000',
                color: '#FFFFFF'
            }}
        >
            {config.text}
        </div>
    );
}
