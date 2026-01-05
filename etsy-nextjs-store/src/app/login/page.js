"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            router.push('/profile');
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="section-spacing min-h-[70vh] flex items-center">
            <div className="container max-w-md">
                <div className="text-center mb-10">
                    <span className="text-accent text-[10px] font-bold tracking-[0.3em] uppercase mb-4 block italic">Welcome Back</span>
                    <h1 className="text-4xl font-heading mb-4">Member Access</h1>
                    <p className="text-sm text-muted font-light">Enter your details to manage your orders and profile.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6 bg-soft p-8 md:p-12 border border-light">
                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 text-xs border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-muted">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-4 bg-white border border-light focus:border-accent outline-none transition-all font-light"
                            placeholder="your@email.com"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-muted">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-4 bg-white border border-light focus:border-accent outline-none transition-all font-light"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`btn-primary w-full py-5 text-sm font-bold tracking-widest uppercase ${loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>

                    <div className="text-center pt-4">
                        <p className="text-xs text-muted">
                            New to AgoraLoom? {' '}
                            <Link href="/signup" className="text-main font-bold border-b border-light hover:border-accent transition-colors">
                                Create an Account
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
