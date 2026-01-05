import React, { useState } from 'react';
import { Package, History, Layers, ClipboardCheck } from 'lucide-react';
import InventoryModule from './InventoryModule';
import StockHistoryModule from './StockHistoryModule';
import StockAdjustmentModule from './StockAdjustmentModule';
import IbcTrackingModule from './IbcTrackingModule';

export default function InventoryManagementModule({ inventory, onRefresh, onReconcile, onDeleteMovement, getItemStock, accounts, ibcMovements, onIbcReturn, onDeleteIbcMovement, globalSettings }) {
    const [activeSubTab, setActiveSubTab] = useState('inventory'); // 'inventory', 'history', 'reconcile', 'ibc'

    return (
        <div className="p-6 space-y-8 animate-fade-in font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="heading-industrial text-2xl flex items-center gap-2">
                        <Layers className="w-6 h-6 text-[#0071e3]" />
                        STOK YÖNETİM MERKEZİ
                    </h1>
                    <p className="text-[#86868b] text-sm mt-1">
                        Envanter kayıtlarını yönetin ve stok hareketlerini izleyin.
                    </p>
                </div>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex border-b border-[#d2d2d7] overflow-x-auto whitespace-nowrap">
                <button
                    onClick={() => setActiveSubTab('inventory')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'inventory'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" /> STOK KARTLARI
                    </div>
                </button>
                <button
                    onClick={() => setActiveSubTab('history')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'history'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <History className="w-4 h-4" /> STOK HAREKETLERİ
                    </div>
                </button>
                <button
                    onClick={() => setActiveSubTab('reconcile')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'reconcile'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4" /> STOK SAYIM / DÜZELTME
                    </div>
                </button>
                <button
                    onClick={() => setActiveSubTab('ibc')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'ibc'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" /> IBC TAKİBİ
                    </div>
                </button>
            </div>

            <div className="animate-in fade-in duration-300">
                {activeSubTab === 'inventory' && (
                    <InventoryModule inventory={inventory} onRefresh={onRefresh} isIntegrated={true} />
                )}
                {activeSubTab === 'history' && (
                    <StockHistoryModule inventory={inventory} accounts={accounts} onDeleteMovement={onDeleteMovement} isIntegrated={true} />
                )}
                {activeSubTab === 'reconcile' && (
                    <StockAdjustmentModule
                        inventory={inventory}
                        getItemStock={getItemStock}
                        onReconcile={onReconcile}
                    />
                )}
                {activeSubTab === 'ibc' && (
                    <IbcTrackingModule
                        accounts={accounts}
                        ibcMovements={ibcMovements}
                        onIbcReturn={onIbcReturn}
                        onDeleteMovement={onDeleteIbcMovement}
                        globalSettings={globalSettings}
                    />
                )}
            </div>


        </div>
    );
}
