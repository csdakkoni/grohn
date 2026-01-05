import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FlaskConical } from 'lucide-react';

export default function Auth() {
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);

        let error;

        if (isSignUp) {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });
            error = signUpError;
            if (!error) {
                alert('Kayıt başarılı! Lütfen e-posta adresinize gelen onay linkine tıklayın.');
            }
        } else {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            error = signInError;
            if (!error) {
                // FORCE RELOAD to sync state with App.js
                window.location.reload();
                return;
            }
        }

        if (error) alert(error.message);
        setLoading(false);
    };

    const handleForgotPassword = async () => {
        if (!email) return alert('Lütfen önce e-posta adresinizi girin.');
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin, // This will use the current domain (e.g., https://grohn-kimya.vercel.app)
        });
        if (error) alert(error.message);
        else alert('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
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
                    <p className="text-[#86868b] text-sm">
                        {isSignUp ? 'Yeni Hesap Oluştur' : 'ERP Sistemine Giriş'}
                    </p>
                </div>
                <form onSubmit={handleAuth} className="space-y-4">
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
                        {loading ? 'İşlem Yapılıyor...' : (isSignUp ? 'Kayıt Ol' : 'Giriş Yap')}
                    </button>
                </form>

                <div className="mt-6 flex flex-col items-center gap-3 text-sm">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-[#0071e3] hover:underline font-medium"
                    >
                        {isSignUp ? 'Zaten hesabınız var mı? Giriş Yap' : 'Hesabınız yok mu? Kayıt Ol'}
                    </button>

                    {!isSignUp && (
                        <button
                            onClick={handleForgotPassword}
                            className="text-gray-500 hover:text-gray-700 text-xs"
                        >
                            Şifremi Unuttum
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
