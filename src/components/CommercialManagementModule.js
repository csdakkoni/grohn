import React, { useState } from 'react';
import { ShoppingBag, Building, Briefcase, Package } from 'lucide-react';
import PurchasingModule from './PurchasingModule';
import CurrentAccountsModule from './CurrentAccountsModule';
import IbcTrackingModule from './IbcTrackingModule';

export default function CommercialManagementModule({ purchases, inventory, accounts, onPurchase, onDeletePurchase, onUpdatePurchase, onAddAccount, onDeleteAccount, sales }) {
    const [activeSubTab, setActiveSubTab] = useState('purchasing'); // 'purchasing', 'accounts', or 'ibc'

    return (
        <div className="p-6 space-y-8 animate-fade-in font-sans">
            {/* Header */}
            <div>
                <h1 className="heading-industrial text-2xl flex items-center gap-2">
                    <ShoppingBag className="w-6 h-6 text-[#0071e3]" />
                    SATIN ALMA PORTALI
                </h1>
                <p className="text-[#86868b] text-sm mt-1">
                    Satınalma kayıtlarını ve cari hesap ilişkilerini yönetin.
                </p>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex border-b border-[#d2d2d7]">
                <button
                    onClick={() => setActiveSubTab('purchasing')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'purchasing'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" /> Satın Alma
                    </div>
                </button>
                <button
                    onClick={() => setActiveSubTab('accounts')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'accounts'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Building className="w-4 h-4" /> Cari Hesaplar
                    </div>
                </button>
            </div>

            <div className="animate-in fade-in duration-300">
                {activeSubTab === 'purchasing' ? (
                    <PurchasingModule
                        purchases={purchases}
                        inventory={inventory}
                        suppliers={accounts}
                        onPurchase={onPurchase}
                        onDelete={onDeletePurchase}
                        onUpdate={onUpdatePurchase}
                        isIntegrated={true}
                    />
                ) : (
                    <CurrentAccountsModule
                        accounts={accounts}
                        sales={sales}
                        purchases={purchases}
                        onAdd={onAddAccount}
                        onDelete={onDeleteAccount}
                        isIntegrated={true}
                    />
                )}
            </div>


        </div>
    );
}
