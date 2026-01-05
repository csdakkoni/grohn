"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    }
                }
            });

            if (authError) throw authError;

            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="section-spacing min-h-[70vh] flex items-center">
                <div className="container max-w-md text-center">
                    <div className="mb-8">
                        <div className="w-20 h-20 bg-soft border border-light flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">✉️</span>
                        </div>
                        <h2 className="text-3xl font-heading mb-4">Check Your Inbox</h2>
                        <p className="text-muted leading-relaxed">
                            We've sent a confirmation link to <strong>{email}</strong>. Please verify your email to activate your AgoraLoom account.
                        </p>
                    </div>
                    <Link href="/login" className="btn-primary inline-block py-4 px-12 text-sm font-bold tracking-widest uppercase">
                        Back to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="section-spacing min-h-[70vh] flex items-center">
            <div className="container max-w-md">
                <div className="text-center mb-10">
                    <span className="text-accent text-[10px] font-bold tracking-[0.3em] uppercase mb-4 block italic">Join the Collective</span>
                    <h1 className="text-4xl font-heading mb-4">Create Account</h1>
                    <p className="text-sm text-muted font-light">Join us to save your favorite pieces and track orders.</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-6 bg-soft p-8 md:p-12 border border-light">
                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 text-xs border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-muted">Full Name</label>
                        <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full p-4 bg-white border border-light focus:border-accent outline-none transition-all font-light"
                            placeholder="Julianne Moore"
                        />
                    </div>

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
                            placeholder="At least 6 characters"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`btn-primary w-full py-5 text-sm font-bold tracking-widest uppercase ${loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {loading ? 'Processing...' : 'Create Account'}
                    </button>

                    <div className="text-center pt-4">
                        <p className="text-xs text-muted">
                            Already a member? {' '}
                            <Link href="/login" className="text-main font-bold border-b border-light hover:border-accent transition-colors">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
