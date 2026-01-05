import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FlaskConical } from 'lucide-react';

export default function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
            <div className="card-industrial p-8 w-full max-w-md shadow-lg bg-white">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-[#e8f2ff] p-3 rounded-full mb-4 border border-[#d0e6ff]">
                        <FlaskConical className="h-8 w-8 text-[#0071e3]" />
                    </div>
                    <h1 className="text-2xl font-bold text-[#1d1d1f]">GROHN</h1>
                    <p className="text-[#86868b] text-sm">ERP Sistemine Giriş</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="label-industrial block">E-posta</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-industrial"
                            placeholder="ornek@sirket.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="label-industrial block">Şifre</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-industrial"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full"
                    >
                        {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                    </button>
                </form>
            </div>
        </div>
    );
}
