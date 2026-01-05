import React, { useState } from 'react';
import { Settings, Save, Info, DollarSign, Percent, Users, Shield, LogOut } from 'lucide-react';
import RoleManagementModule from './RoleManagementModule';

export default function SettingsModule({ globalSettings, onSaveSetting, currentUser, onSignOut, userRole }) {
    const [activeSubTab, setActiveSubTab] = useState('general'); // 'general', 'users', or 'security'
    const [overhead, setOverhead] = useState(globalSettings.global_overhead_rate || 0.2);
    const [interest, setInterest] = useState(globalSettings.monthly_interest_rate || 4.0);
    const [companyName, setCompanyName] = useState(globalSettings.company_name || 'Grohn Tekstil Kimyasal Ürünler San. Tic. Ltd. Şti.');
    const [companyAddress, setCompanyAddress] = useState(globalSettings.company_address || 'Velimeşe OSB, Kervancı Ticaret Merkezi, B-12 Ergene / Tekirdağ');
    const [companyEmail, setCompanyEmail] = useState(globalSettings.company_email || 'grohn@grohn.com.tr');
    const [companyPhone, setCompanyPhone] = useState(globalSettings.company_phone || '+90 539 880 23 46');
    const [companyTaxOffice, setCompanyTaxOffice] = useState(globalSettings.company_tax_office || 'Çorlu V.D.');
    const [companyTaxNo, setCompanyTaxNo] = useState(globalSettings.company_tax_no || '4111172813');

    const handleSave = async () => {
        await onSaveSetting('global_overhead_rate', parseFloat(overhead));
        await onSaveSetting('monthly_interest_rate', parseFloat(interest));
        await onSaveSetting('company_name', companyName);
        await onSaveSetting('company_address', companyAddress);
        await onSaveSetting('company_email', companyEmail);
        await onSaveSetting('company_phone', companyPhone);
        await onSaveSetting('company_tax_office', companyTaxOffice);
        await onSaveSetting('company_tax_no', companyTaxNo);
        alert('Ayarlar başarıyla kaydedildi.');
    };

    return (
        <div className="p-6 space-y-8 animate-fade-in font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="heading-industrial text-2xl flex items-center gap-2">
                        <Settings className="w-6 h-6 text-[#0071e3]" />
                        Sistem Ayarları
                    </h1>
                    <p className="text-[#86868b] text-sm mt-1">
                        Kurumsal kimlik, finansal parametreler ve kullanıcı yetkilerini yönetin.
                    </p>
                </div>
                {activeSubTab === 'general' && (
                    <button
                        onClick={handleSave}
                        className="btn-primary flex items-center gap-2 self-start"
                    >
                        <Save className="w-4 h-4" />
                        Değişiklikleri Kaydet
                    </button>
                )}
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex border-b border-[#d2d2d7]">
                <button
                    onClick={() => setActiveSubTab('general')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'general'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Genel Ayarlar
                    </div>
                </button>
                <button
                    onClick={() => setActiveSubTab('users')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'users'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" /> Kullanıcı Yönetimi
                    </div>
                </button>
                <button
                    onClick={() => setActiveSubTab('security')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'security'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Güvenlik & Oturum
                    </div>
                </button>
            </div>

            {activeSubTab === 'general' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Section 1: Corporate Identity */}
                    <div className="card-industrial h-full">
                        <div className="p-4 border-b border-[#d2d2d7] bg-[#f5f5f7]">
                            <h2 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">
                                Kurumsal Kimlik
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="label-industrial">Firma Ünvanı</label>
                                <input
                                    type="text"
                                    className="input-industrial"
                                    value={companyName}
                                    onChange={e => setCompanyName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="label-industrial">Adres</label>
                                <textarea
                                    rows="3"
                                    className="input-industrial resize-none"
                                    value={companyAddress}
                                    onChange={e => setCompanyAddress(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="label-industrial">E-posta</label>
                                    <input
                                        type="email"
                                        className="input-industrial"
                                        value={companyEmail}
                                        onChange={e => setCompanyEmail(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="label-industrial">Telefon</label>
                                    <input
                                        type="text"
                                        className="input-industrial"
                                        value={companyPhone}
                                        onChange={e => setCompanyPhone(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Legal & Financial */}
                    <div className="card-industrial h-full">
                        <div className="p-4 border-b border-[#d2d2d7] bg-[#f5f5f7]">
                            <h2 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">
                                Yasal & Finansal
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="label-industrial">Vergi Dairesi</label>
                                    <input
                                        type="text"
                                        className="input-industrial"
                                        value={companyTaxOffice}
                                        onChange={e => setCompanyTaxOffice(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="label-industrial">Vergi Numarası</label>
                                    <input
                                        type="text"
                                        className="input-industrial font-mono"
                                        value={companyTaxNo}
                                        onChange={e => setCompanyTaxNo(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: System Framework */}
                    <div className="card-industrial h-full md:col-span-2">
                        <div className="p-4 border-b border-[#d2d2d7] bg-[#f5f5f7]">
                            <h2 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">
                                Finansal Parametreler
                            </h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="label-industrial flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-[#86868b]" />
                                    Genel Gider Payı (USD/kg)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input-industrial text-2xl font-bold h-16"
                                        value={overhead}
                                        onChange={e => setOverhead(e.target.value)}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#86868b] text-sm">USD</div>
                                </div>
                                <p className="text-xs text-[#86868b]">
                                    Üretim maliyetlerine eklenecek kilogram başına sabit genel gider tutarı.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="label-industrial flex items-center gap-2">
                                    <Percent className="w-4 h-4 text-[#86868b]" />
                                    Aylık Faiz Oranı (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="input-industrial text-2xl font-bold h-16"
                                        value={interest}
                                        onChange={e => setInterest(e.target.value)}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#86868b] text-sm">%</div>
                                </div>
                                <p className="text-xs text-[#86868b]">
                                    Vadeli işlemlerde ve finansman maliyeti hesaplamalarında kullanılacak aylık faiz oranı.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeSubTab === 'users' ? (
                <div className="animate-in fade-in duration-300">
                    <RoleManagementModule currentUser={currentUser} />
                </div>
            ) : (
                <div className="animate-in fade-in duration-300 space-y-6">
                    {/* User Profile Info */}
                    <div className="card-industrial max-w-2xl">
                        <div className="p-4 border-b border-[#d2d2d7] bg-[#f5f5f7]">
                            <h2 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">
                                Kullanıcı Profili
                            </h2>
                        </div>
                        <div className="p-8 flex items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-indigo-500/20">
                                {currentUser?.email ? currentUser.email[0].toUpperCase() : '?'}
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold text-[#1d1d1f]">{currentUser?.email}</h3>
                                <div className="flex items-center gap-2 text-indigo-600 font-medium">
                                    <Shield className="w-4 h-4" />
                                    {userRole === 'admin' ? 'Sistem Yöneticisi' : userRole === 'operator' ? 'Operatör' : 'İzleyici'}
                                </div>
                                <p className="text-sm text-[#86868b] mt-2">
                                    Bu hesap üzerinden sisteme erişim yetkiniz tanımlanmıştır.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card-industrial max-w-2xl">
                        <div className="p-4 border-b border-[#d2d2d7] bg-[#f5f5f7]">
                            <h2 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">
                                Oturum Yönetimi
                            </h2>
                        </div>
                        <div className="p-8 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-medium text-[#1d1d1f]">Hesap Oturumunu Kapat</h3>
                                <p className="text-sm text-[#86868b] mt-1">
                                    Mevcut oturumunuzu sonlandırarak güvenli bir şekilde çıkış yapın.
                                </p>
                            </div>
                            <button
                                onClick={onSignOut}
                                className="flex items-center gap-2 px-6 py-3 bg-[#d21e1e] text-white rounded-lg font-medium hover:bg-[#b01919] transition-colors shadow-lg shadow-red-500/10"
                            >
                                <LogOut className="w-4 h-4" />
                                Çıkış Yap
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-12 text-center text-xs text-[#d2d2d7] font-medium tracking-tight">
                Infrastructure v5.1.0 &bull; Studio Node
            </div>
        </div>
    );
}
