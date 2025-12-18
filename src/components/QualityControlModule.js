import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { ClipboardCheck, Plus, Save, FileText, CheckCircle, XCircle, Search, Beaker, AlertTriangle, RefreshCw, Book, Settings } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { preparePDFWithFont } from '../utils/exportUtils';

export default function QualityControlModule({ inventory, onRefresh }) {
    const [activeTab, setActiveTab] = useState('specs'); // 'specs', 'library', 'pending', 'input', 'certs'

    const [specs, setSpecs] = useState([]);
    const [standards, setStandards] = useState([]); // Master Library
    const [batches, setBatches] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    // -- STATE FOR SPECS --
    const [selectedProductForSpec, setSelectedProductForSpec] = useState('');
    const [selectedStandardId, setSelectedStandardId] = useState(''); // For dropdown
    const [newSpec, setNewSpec] = useState({ parameter_name: '', min_value: '', max_value: '', unit: '', method: '' });

    // -- STATE FOR STANDARDS LIBRARY --
    const [newStandard, setNewStandard] = useState({ id: null, name: '', unit: '', method: '' }); // Added id

    // -- STATE FOR INPUT --
    const [selectedBatchId, setSelectedBatchId] = useState(null);
    const [inputValues, setInputValues] = useState({}); // { specId: value }
    const [adjustmentNote, setAdjustmentNote] = useState(''); // [NEW] For rejected batches

    // Fetch Data
    const fetchData = useCallback(async () => {
        if (!inventory || inventory.length === 0) return;
        setLoading(true);
        const productIds = inventory.map(i => i.id);

        try {
            // Fetch Standards (Library)
            const { data: stdData, error: stdError } = await supabase
                .from('quality_standards')
                .select('*')
                .order('name', { ascending: true });

            if (stdError && stdError.code !== '42P01') throw stdError; // Ignore if table doesn't exist yet
            if (stdData) setStandards(stdData);

            // Fetch Specs
            const { data: specsData, error: specsError } = await supabase
                .from('quality_specs')
                .select('*')
                .in('product_id', productIds);

            if (specsError) throw specsError;
            if (specsData) setSpecs(specsData);

            // Fetch Batches
            const { data: batchesData, error: batchesError } = await supabase
                .from('quality_batches')
                .select('*')
                .in('product_id', productIds)
                .order('created_at', { ascending: false });

            if (batchesError) throw batchesError;
            if (batchesData) setBatches(batchesData);

            // Fetch Results
            if (batchesData && batchesData.length > 0) {
                const batchIds = batchesData.map(b => b.id);
                const { data: resultsData, error: resultsError } = await supabase
                    .from('quality_results')
                    .select('*')
                    .in('batch_id', batchIds);

                if (resultsError) throw resultsError;
                if (resultsData) setResults(resultsData);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error('Veri çekme hatası:', error);
            // Don't alert for table missing during migration phase
            if (error.code !== '42P01') alert('Veriler yüklenirken hata oluştu: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [inventory]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- ACTIONS ---

    const handleAddStandard = async () => {
        if (!newStandard.name) return alert('Lütfen standart adını giriniz.');

        try {
            if (newStandard.id) {
                // UPDATE
                const { error } = await supabase.from('quality_standards').update({
                    name: newStandard.name,
                    unit: newStandard.unit,
                    method: newStandard.method
                }).eq('id', newStandard.id);

                if (error) throw error;
                alert('Standart güncellendi.');
            } else {
                // INSERT
                const { error } = await supabase.from('quality_standards').insert({
                    name: newStandard.name,
                    unit: newStandard.unit,
                    method: newStandard.method
                });
                if (error) throw error;
                alert('Standart eklendi.');
            }

            setNewStandard({ id: null, name: '', unit: '', method: '' });
            fetchData(); // Reload all to be safe
        } catch (error) {
            console.error('Standart işlem hatası:', error);
            alert('Hata: ' + error.message);
        }
    };

    const handleEditStandard = (std) => {
        setNewStandard({ id: std.id, name: std.name, unit: std.unit || '', method: std.method || '' });
    };

    const handleDeleteStandard = async (id) => {
        if (!window.confirm('Bu standardı silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('quality_standards').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error) {
            alert('Silme hatası: ' + error.message);
        }
    };

    const handleAddSpec = async () => {
        if (!selectedProductForSpec || !newSpec.parameter_name) return alert('Lütfen ürün ve parametre seçiniz.');

        try {
            const { data, error } = await supabase.from('quality_specs').insert({
                product_id: parseInt(selectedProductForSpec),
                parameter_name: newSpec.parameter_name,
                min_value: parseFloat(newSpec.min_value),
                max_value: parseFloat(newSpec.max_value),
                unit: newSpec.unit,
                method: newSpec.method
            }).select().single();

            if (error) throw error;

            setSpecs([...specs, data]);
            setNewSpec({ parameter_name: '', min_value: '', max_value: '', unit: '', method: '' });
            setSelectedStandardId('');
            alert('Kriter ürüne eklendi.');
        } catch (error) {
            console.error('Ekleme hatası:', error);
            alert('Hata: ' + error.message);
        }
    };

    const handleStandardSelect = (stdId) => {
        setSelectedStandardId(stdId);
        if (!stdId) {
            setNewSpec({ ...newSpec, parameter_name: '', unit: '', method: '' });
            return;
        }
        const std = standards.find(s => s.id === parseInt(stdId));
        if (std) {
            setNewSpec({
                ...newSpec,
                parameter_name: std.name,
                unit: std.unit || '',
                method: std.method || ''
            });
        }
    };

    const handleCreateManualBatch = async () => {
        // Create a manual batch for testing purposes (e.g. for a random sample)
        // Ideally prompt user for product
        const productIdStr = prompt("Test etmek istediğiniz ürünün ID'si nedir? (Listeden bakınız: " + inventory.map(i => i.id + "-" + i.name).join(', ') + ")");
        if (!productIdStr) return;
        const productId = parseInt(productIdStr);
        const product = inventory.find(i => i.id === productId);
        if (!product) return alert('Geçersiz ürün ID');

        const lotNo = prompt("Lot No giriniz:", `TEST-${new Date().toISOString().slice(0, 10)}`);
        if (!lotNo) return;

        try {
            const { data, error } = await supabase.from('quality_batches').insert({
                product_id: productId,
                lot_no: lotNo,
                status: 'Pending',
                reference_type: 'Manual',
                notes: 'Manuel oluşturulan test kaydı'
            }).select().single();

            if (error) throw error;

            setBatches([data, ...batches]);
            alert('Parti oluşturuldu!');
        } catch (error) {
            console.error('Parti oluşturma hatası:', error);
            alert('Hata: ' + error.message);
        }
    };

    const handleSaveResults = async () => {
        if (!selectedBatchId) return;

        const batch = batches.find(b => b.id === parseInt(selectedBatchId));
        if (!batch) return;

        const batchSpecs = specs.filter(s => s.product_id === batch.product_id);
        if (batchSpecs.length === 0) return alert('Bu ürün için kriter tanımlanmamış!');

        const newResults = [];
        let allPass = true;

        for (const spec of batchSpecs) {
            const valStr = inputValues[spec.id];
            if (valStr !== undefined && valStr !== '') {
                const val = parseFloat(valStr);
                const pass = val >= spec.min_value && val <= spec.max_value;
                if (!pass) allPass = false;

                newResults.push({
                    batch_id: batch.id,
                    spec_id: spec.id,
                    parameter_name: spec.parameter_name,
                    measured_value: val,
                    result: pass ? 'Pass' : 'Fail',
                    tested_by: 'User' // In real app, get from session
                });
            } else {
                return alert(`Lütfen ${spec.parameter_name} için değer giriniz.`);
            }
        }

        try {
            // Insert Results
            const { data: insertedResults, error: resError } = await supabase
                .from('quality_results')
                .insert(newResults)
                .select();

            if (resError) throw resError;

            // Update Batch Status
            const newStatus = allPass ? 'Approved' : 'Rejected';
            const { error: batchError } = await supabase
                .from('quality_batches')
                .update({ status: newStatus })
                .eq('id', batch.id);

            if (batchError) throw batchError;

            // [NEW] Sync with Productions Table if linked
            if (batch.production_id) {
                const { error: prodError } = await supabase
                    .from('productions')
                    .update({
                        qc_status: newStatus,
                        adjustment_notes: adjustmentNote
                    }) // 'Approved' or 'Rejected'
                    .eq('id', batch.production_id);
                if (prodError) console.error('Üretim durumu güncellenemedi:', prodError);
            }

            setResults([...results, ...insertedResults]);
            setBatches(batches.map(b => b.id === batch.id ? { ...b, status: newStatus } : b));

            // Sync global state associated with productions
            if (onRefresh) onRefresh();

            alert(`Sonuçlar kaydedildi. Durum: ${newStatus === 'Approved' ? 'ONAYLANDI' : 'RED'}`);
            setActiveTab('certs');
            setSelectedBatchId(null);
            setInputValues({});

        } catch (error) {
            console.error('Kaydetme hatası:', error);
            alert('Hata: ' + error.message);
        }
    };

    const generateCoA = async (batch) => {
        const batchResults = results.filter(r => r.batch_id === batch.id);
        const product = inventory.find(i => i.id === batch.product_id);
        // Find specs to show limits
        // Note: results table doesn't store limits, specs table does. 
        // Ideally we should snapshot limits into results or join them.
        // For MVP, look up from specs (assuming they didn't change drastically)

        const doc = await preparePDFWithFont();
        const fontName = doc.activeFont || 'helvetica';

        // Header
        doc.setFillColor(41, 128, 185);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(20);
        doc.setFont(fontName, 'bold');
        doc.text('ANALİZ SERTİFİKASI (CoA)', 105, 18, null, null, 'center');

        doc.setFontSize(10);
        doc.setFont(fontName, 'normal');
        doc.text('GROHN Kimya A.Ş.', 105, 25, null, null, 'center');

        // Info Block
        doc.setTextColor(0, 0, 0);
        const startY = 45;

        doc.setDrawColor(200);
        doc.line(14, startY - 5, 196, startY - 5);

        doc.setFont(fontName, 'bold');
        doc.text('Ürün Adı:', 14, startY);
        doc.text('Lot Numarası:', 14, startY + 6);
        doc.text('Test Tarihi:', 14, startY + 12);

        doc.setFont(fontName, 'normal');
        doc.text(product ? product.name : '-', 60, startY);
        doc.text(batch.lot_no || '-', 60, startY + 6);
        doc.text(new Date(batch.created_at).toLocaleDateString('tr-TR'), 60, startY + 12);

        // Status Box
        doc.setFont(fontName, 'bold');
        doc.text('KARAR:', 140, startY);
        doc.setFontSize(14);
        doc.setTextColor(batch.status === 'Approved' ? 'green' : 'red');
        doc.text(batch.status === 'Approved' ? 'UYGUNDUR' : 'REDDEDİLDİ', 160, startY);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        // Results Table
        const tableBody = batchResults.map(r => {
            const spec = specs.find(s => s.id === r.spec_id);
            const range = spec ? `${spec.min_value} - ${spec.max_value} ${spec.unit}` : '-';
            const method = spec ? spec.method : '-';

            return [
                r.parameter_name,
                method,
                range,
                `${r.measured_value} ${spec?.unit || ''}`,
                r.result === 'Pass' ? 'Uygun' : 'Uygun Değil'
            ];
        });

        autoTable(doc, {
            startY: startY + 20,
            head: [['Parametre', 'Metot', 'Spesifikasyon', 'Ölçülen Değer', 'Sonuç']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, font: fontName, fontStyle: 'bold' },
            bodyStyles: { font: fontName },
        });

        // Footer / Signatures
        const finalY = doc.lastAutoTable.finalY + 30;

        doc.setFont(fontName, 'bold');
        doc.text('Kalite Kontrol Sorumlusu', 40, finalY);
        doc.text('Onaylayan', 150, finalY);

        doc.setLineWidth(0.5);
        doc.line(40, finalY + 15, 90, finalY + 15);
        doc.line(150, finalY + 15, 200, finalY + 15);

        doc.setFontSize(8);
        doc.setFont(fontName, 'italic');
        doc.text('Bu belge elektronik ortamda oluşturulmuştur, ıslak imza gerektirmez.', 105, 280, null, null, 'center');

        doc.save(`CoA_${product?.name || 'Urun'}_${batch.lot_no}.pdf`);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardCheck className="h-6 w-6 text-blue-600" /> Kalite Kontrol (QC)
                </h2>
                <button
                    onClick={fetchData}
                    className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
                    title="Yenile"
                >
                    <RefreshCw className={`h-5 w-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* TABS */}
            <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
                {[
                    { id: 'library', label: 'Kütüphane', icon: Book },
                    { id: 'specs', label: 'Ürün Kriterleri', icon: Settings },
                    { id: 'pending', label: 'Test Bekleyenler', icon: AlertTriangle },
                    { id: 'input', label: 'Test Girişi', icon: Beaker },
                    { id: 'certs', label: 'Sertifikalar', icon: FileText }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENT */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 min-h-[400px]">

                {/* 0. LIBRARY TAB */}
                {activeTab === 'library' && (
                    <div className="space-y-6">
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                            <h3 className="font-bold text-indigo-700 mb-2 flex items-center gap-2">
                                <Plus size={16} /> Yeni Standart Tanımla
                            </h3>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-500">Parametre Adı</label>
                                    <input
                                        className="w-full p-2 border rounded"
                                        placeholder="Örn: pH, Yoğunluk"
                                        value={newStandard.name}
                                        onChange={e => setNewStandard({ ...newStandard, name: e.target.value })}
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="text-xs font-bold text-slate-500">Birim</label>
                                    <input
                                        className="w-full p-2 border rounded"
                                        placeholder="g/cm3"
                                        value={newStandard.unit}
                                        onChange={e => setNewStandard({ ...newStandard, unit: e.target.value })}
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="text-xs font-bold text-slate-500">Metot</label>
                                    <input
                                        className="w-full p-2 border rounded"
                                        placeholder="ASTM..."
                                        value={newStandard.method}
                                        onChange={e => setNewStandard({ ...newStandard, method: e.target.value })}
                                    />
                                </div>
                                <button
                                    onClick={handleAddStandard}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded font-medium hover:bg-indigo-700"
                                >
                                    {newStandard.id ? 'Güncelle' : 'Ekle'}
                                </button>
                                {newStandard.id && (
                                    <button
                                        onClick={() => setNewStandard({ id: null, name: '', unit: '', method: '' })}
                                        className="bg-slate-200 text-slate-700 px-4 py-2 rounded font-medium hover:bg-slate-300"
                                    >
                                        İptal
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold text-slate-700 mb-2">Kayıtlı Standartlar</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {standards.map(std => (
                                    <div key={std.id} className="p-3 border rounded-lg hover:bg-slate-50 flex justify-between items-start group">
                                        <div>
                                            <div className="font-bold text-slate-800">{std.name}</div>
                                            <div className="text-xs text-slate-500 flex gap-2 mt-1">
                                                {std.unit && <span className="bg-slate-100 px-1 rounded">Birim: {std.unit}</span>}
                                                {std.method && <span className="bg-slate-100 px-1 rounded">Metot: {std.method}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEditStandard(std)}
                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                title="Düzenle"
                                            >
                                                <Settings size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStandard(std.id)}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                title="Sil"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {standards.length === 0 && <div className="text-slate-400 italic">Standart bulunamadı.</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* 1. SPECS TAB */}
                {activeTab === 'specs' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                            <h3 className="md:col-span-2 font-bold text-slate-700 block border-b pb-2">Ürüne Kriter Ata</h3>

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Ürün</label>
                                    <select
                                        className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 outline-none"
                                        value={selectedProductForSpec}
                                        onChange={e => setSelectedProductForSpec(e.target.value)}
                                    >
                                        <option value="">Seçiniz...</option>
                                        {inventory.map(i => <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Kriter (Kütüphaneden)</label>
                                    <select
                                        className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 outline-none"
                                        value={selectedStandardId}
                                        onChange={e => handleStandardSelect(e.target.value)}
                                    >
                                        <option value="">Parametre Seçiniz...</option>
                                        {standards.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                                    </select>
                                </div>
                            </div>

                            {selectedStandardId && (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Min Değer</label>
                                            <input
                                                type="number"
                                                className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 outline-none"
                                                value={newSpec.min_value}
                                                onChange={e => setNewSpec({ ...newSpec, min_value: e.target.value })}
                                                placeholder="Min"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Max Değer</label>
                                            <input
                                                type="number"
                                                className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 outline-none"
                                                value={newSpec.max_value}
                                                onChange={e => setNewSpec({ ...newSpec, max_value: e.target.value })}
                                                placeholder="Max"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Birim</label>
                                            <input
                                                placeholder="Birim"
                                                className="w-full p-2 border border-slate-300 rounded bg-slate-100"
                                                value={newSpec.unit}
                                                readOnly
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Metot</label>
                                            <input
                                                placeholder="Metot"
                                                className="w-full p-2 border border-slate-300 rounded bg-slate-100"
                                                value={newSpec.method}
                                                readOnly
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 flex justify-end mt-2">
                                        <button
                                            onClick={handleAddSpec}
                                            className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2 transition-colors"
                                        >
                                            <Plus size={16} /> Kriteri Kaydet
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* LIST */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border rounded-lg">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3">Ürün</th>
                                        <th className="px-4 py-3">Parametre</th>
                                        <th className="px-4 py-3">Limitler</th>
                                        <th className="px-4 py-3">Birim</th>
                                        <th className="px-4 py-3">Metot</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {specs.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center py-4 text-slate-400">Kayıtlı kriter yok.</td></tr>
                                    ) : (
                                        specs.map(s => {
                                            const p = inventory.find(i => i.id === s.product_id);
                                            return (
                                                <tr key={s.id} className="border-b hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-800">
                                                        <span className="text-xs text-slate-400 font-mono mr-2">{p?.product_code || p?.id}</span>
                                                        {p ? p.name : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">{s.parameter_name}</td>
                                                    <td className="px-4 py-3 text-slate-600 font-mono">{s.min_value} - {s.max_value}</td>
                                                    <td className="px-4 py-3">{s.unit}</td>
                                                    <td className="px-4 py-3 text-slate-500 italic">{s.method}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. PENDING TAB */}
                {activeTab === 'pending' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700">Test Bekleyen Partiler</h3>
                            <button
                                onClick={handleCreateManualBatch}
                                className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded hover:bg-indigo-100 transition-colors font-medium border border-indigo-200"
                            >
                                + Manuel Parti Oluştur
                            </button>
                        </div>
                        <div className="grid gap-4">
                            {batches.filter(b => b.status === 'Pending').map(batch => {
                                const prod = inventory.find(i => i.id === batch.product_id);
                                return (
                                    <div key={batch.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                                        <div className="mb-3 sm:mb-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 text-lg">{prod?.name || 'Bilinmeyen Ürün'}</span>
                                                <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{batch.reference_type || 'Manual'}</span>
                                            </div>
                                            <div className="text-sm text-slate-500 mt-1">
                                                Lot: <span className="font-mono text-slate-700 font-bold">{batch.lot_no}</span>
                                            </div>
                                            <div className="text-xs text-orange-500 font-bold mt-1 flex items-center gap-1">
                                                <AlertTriangle size={12} /> Bekliyor - {new Date(batch.created_at).toLocaleString('tr-TR')}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedBatchId(batch.id);
                                                setActiveTab('input');
                                            }}
                                            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors shadow-sm"
                                        >
                                            <Beaker size={18} /> Test Et
                                        </button>
                                    </div>
                                );
                            })}
                            {batches.filter(b => b.status === 'Pending').length === 0 && (
                                <div className="text-center text-slate-400 py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                    Bekleyen test kaydı bulunmuyor.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. INPUT TAB */}
                {activeTab === 'input' && (
                    <div className="space-y-6">
                        {!selectedBatchId ? (
                            <div className="text-center text-slate-500 py-12 bg-yellow-50 rounded-lg border border-yellow-100">
                                <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-yellow-400" />
                                <p>Lütfen önce "Test Bekleyenler" sekmesinden bir parti seçin.</p>
                                <button
                                    onClick={() => setActiveTab('pending')}
                                    className="mt-4 text-blue-600 underline font-medium"
                                >
                                    Bekleyenlere Git
                                </button>
                            </div>
                        ) : (
                            <>
                                {(() => {
                                    const batch = batches.find(b => b.id === parseInt(selectedBatchId));
                                    const prod = inventory.find(i => i.id === batch?.product_id);
                                    const batchSpecs = specs.filter(s => s.product_id === batch?.product_id);

                                    if (!batch) return <div>Hata: Parti bulunamadı.</div>;

                                    return (
                                        <div className="animate-fade-in">
                                            <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100 flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-blue-800 text-xl">{prod?.name}</h3>
                                                    <div className="text-blue-700 font-mono mt-1">LOT: {batch.lot_no}</div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedBatchId(null)}
                                                    className="text-blue-400 hover:text-blue-600"
                                                >
                                                    <XCircle size={24} />
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                {batchSpecs.length === 0 ? (
                                                    <div className="text-red-500 bg-red-50 p-4 rounded border border-red-100">
                                                        Bu ürün için tanımlı test kriteri (spesifikasyon) bulunamadı. Önce "Tanımlamalar" kısmından ekleyiniz.
                                                    </div>
                                                ) : (
                                                    batchSpecs.map(spec => (
                                                        <div key={spec.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                            <div className="w-1/3">
                                                                <div className="font-bold text-slate-700">{spec.parameter_name}</div>
                                                                <div className="text-xs text-slate-500 mt-1">
                                                                    Hedef: {spec.min_value} - {spec.max_value} {spec.unit}
                                                                </div>
                                                            </div>
                                                            <div className="w-1/3">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder="Ölçülen Değer"
                                                                    className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 outline-none text-lg font-mono"
                                                                    value={inputValues[spec.id] || ''}
                                                                    onChange={e => setInputValues({ ...inputValues, [spec.id]: e.target.value })}
                                                                />
                                                            </div>
                                                            <div className="w-1/3 text-right">
                                                                {inputValues[spec.id] && (
                                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold shadow-sm ${(parseFloat(inputValues[spec.id]) >= spec.min_value && parseFloat(inputValues[spec.id]) <= spec.max_value)
                                                                        ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-red-100 text-red-700 ring-1 ring-red-200'
                                                                        }`}>
                                                                        {(parseFloat(inputValues[spec.id]) >= spec.min_value && parseFloat(inputValues[spec.id]) <= spec.max_value)
                                                                            ? <><CheckCircle size={16} /> UYGUN</>
                                                                            : <><XCircle size={16} /> SAPMA</>
                                                                        }
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* REVISION NOTE INPUT */}
                                            <div className="mt-6 bg-orange-50 p-4 rounded-lg border border-orange-100">
                                                <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                                                    <AlertTriangle size={16} /> Revizyon / Düzeltme Talimatı (Opsiyonel)
                                                </h4>
                                                <p className="text-xs text-orange-600 mb-2">Eğer sonuçlar uygun değilse, üretime iletilecek düzeltme talimatlarını buraya giriniz (Örn: "500g Asetik Asit ekle").</p>
                                                <textarea
                                                    className="w-full p-3 border border-orange-200 rounded focus:border-orange-500 outline-none text-sm"
                                                    rows="3"
                                                    placeholder="Düzeltme reçetesi veya notları..."
                                                    value={adjustmentNote}
                                                    onChange={e => setAdjustmentNote(e.target.value)}
                                                />
                                            </div>

                                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                                                <button
                                                    onClick={() => setSelectedBatchId(null)}
                                                    className="px-6 py-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                                >
                                                    İptal
                                                </button>
                                                <button
                                                    onClick={handleSaveResults}
                                                    disabled={batchSpecs.length === 0}
                                                    className="bg-green-600 text-white px-8 py-2 rounded-lg shadow-lg hover:bg-green-700 flex items-center gap-2 font-bold transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Save size={18} /> Kaydet ve Onayla
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                )}

                {/* 4. CERTS TAB */}
                {activeTab === 'certs' && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-700 mb-4 pb-2 border-b">Tamamlanan Analizler & Sertifikalar</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3">Tarih</th>
                                        <th className="px-4 py-3">Ürün</th>
                                        <th className="px-4 py-3">Lot No</th>
                                        <th className="px-4 py-3">Durum</th>
                                        <th className="px-4 py-3">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.filter(b => b.status !== 'Pending').length === 0 ? (
                                        <tr><td colSpan="5" className="text-center py-4 text-slate-400">Henüz tamamlanmış analiz yok.</td></tr>
                                    ) : (
                                        batches.filter(b => b.status !== 'Pending').map(batch => {
                                            const prod = inventory.find(i => i.id === batch.product_id);
                                            return (
                                                <tr key={batch.id} className="border-b hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(batch.created_at).toLocaleDateString('tr-TR')}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-800">{prod?.name}</td>
                                                    <td className="px-4 py-3 font-mono text-slate-600">{batch.lot_no}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold inline-flex items-center gap-1 ${batch.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                            {batch.status === 'Approved' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                                            {batch.status === 'Approved' ? 'ONAYLI' : 'RED'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => generateCoA(batch)}
                                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium transition-colors"
                                                        >
                                                            <FileText size={16} /> CoA İndir
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
