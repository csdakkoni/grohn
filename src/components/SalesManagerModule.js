import React, { useState } from 'react';
import { ShoppingCart, Calculator, TrendingUp } from 'lucide-react';
import SalesModule from './SalesModule';
import PriceCalculatorModule from './PriceCalculatorModule';

export default function SalesManagerModule({
    sales, inventory, accounts, productions, recipes, globalSettings, onSale, onDeleteSale, onUpdateSale, exchangeRates, onRefresh
}) {
    const [activeSubTab, setActiveSubTab] = useState('records'); // 'records' or 'calculator'

    return (
        <div className="p-6 space-y-8 animate-fade-in font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="heading-industrial text-2xl flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-[#107c10]" />
                        SATIŞ VE PAZARLAMA PORTALI
                    </h1>
                    <p className="text-[#86868b] text-sm mt-1">
                        Satış kayıtlarını izleyin ve maliyet tabanlı fiyat teklifleri oluşturun.
                    </p>
                </div>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex border-b border-[#d2d2d7]">
                <button
                    onClick={() => setActiveSubTab('records')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'records'
                        ? 'border-green-600 text-green-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" /> Satış Kayıtları
                    </div>
                </button>
                <button
                    onClick={() => setActiveSubTab('calculator')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'calculator'
                        ? 'border-green-600 text-green-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4" /> Fiyat Hesapla
                    </div>
                </button>
            </div>

            <div className="animate-in fade-in duration-300">
                {activeSubTab === 'records' ? (
                    <SalesModule
                        sales={sales}
                        inventory={inventory}
                        accounts={accounts}
                        productions={productions}
                        recipes={recipes}
                        globalSettings={globalSettings}
                        onSale={onSale}
                        onDeleteSale={onDeleteSale}
                        onUpdateSale={onUpdateSale}
                        exchangeRates={exchangeRates}
                        isIntegrated={true}
                    />
                ) : (
                    <PriceCalculatorModule
                        recipes={recipes}
                        inventory={inventory}
                        exchangeRates={exchangeRates}
                        globalSettings={globalSettings}
                        onRefresh={onRefresh}
                        isIntegrated={true}
                    />
                )}
            </div>


        </div>
    );
}
