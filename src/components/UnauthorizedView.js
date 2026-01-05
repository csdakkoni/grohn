import React from 'react';
import { ShieldAlert, LogOut, Mail, Lock } from 'lucide-react';

export default function UnauthorizedView({ onSignOut, email }) {
    return (
        <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white rounded-[20px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="bg-[#1d1d1f] p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="bg-red-500/20 p-4 rounded-full mb-4 ring-1 ring-red-500/50">
                            <Lock className="w-12 h-12 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">Erişim Yetkisi Yok</h1>
                        <p className="text-slate-400 text-sm mt-2">Bu alana giriş izniniz bulunmamaktadır.</p>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex gap-4 items-start">
                        <ShieldAlert className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-bold text-orange-900">Hesap Onayı Bekleniyor</h3>
                            <p className="text-xs text-orange-800 mt-1 leading-relaxed">
                                <strong>{email}</strong> hesabınız başarıyla oluşturuldu, ancak organizasyon yöneticisi tarafından henüz yetkilendirilmediniz.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wider border-b pb-2">Ne Yapabilirsiniz?</h4>
                        <ul className="space-y-3">
                            <li className="flex gap-3 text-sm text-[#424245]">
                                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                                <div>
                                    <span className="font-bold text-[#1d1d1f]">Yönetici ile İletişime Geçin:</span>
                                    <p className="text-xs mt-0.5">Yöneticinizden size "Takım Üyeleri" ekranından davet göndermesini isteyin.</p>
                                </div>
                            </li>
                            <li className="flex gap-3 text-sm text-[#424245]">
                                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                                <div>
                                    <span className="font-bold text-[#1d1d1f]">Davet Geldi mi?</span>
                                    <p className="text-xs mt-0.5">Eğer davet edildiyseniz, lütfen çıkış yapıp tekrar giriş yapmayı deneyin.</p>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                        <button
                            onClick={onSignOut}
                            className="w-full btn-industrial py-3 flex items-center justify-center gap-2 bg-[#f5f5f7] hover:bg-[#e5e5e5] text-[#1d1d1f] border border-[#d2d2d7]"
                        >
                            <LogOut className="w-4 h-4" /> Güvenli Çıkış Yap
                        </button>
                    </div>
                </div>

                <div className="bg-[#f5f5f7] p-4 text-center border-t border-[#d2d2d7]">
                    <p className="text-[10px] text-[#86868b] flex items-center justify-center gap-1">
                        <Mail className="w-3 h-3" /> Destek: support@grohn.com
                    </p>
                </div>
            </div>
        </div>
    );
}
