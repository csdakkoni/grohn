import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { ClipboardCheck, Plus, Save, FileText, CheckCircle, XCircle, Search, Beaker, AlertTriangle, RefreshCw, Book, Settings, Mail } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { preparePDFWithFont } from '../utils/exportUtils';
import { drawCIHeader, drawCIFooter, drawCIMetadataGrid, drawCIWrappedText, CI_PALETTE } from '../utils/pdfCIUtils';

export default function QualityControlModule({ inventory, globalSettings = {}, onRefresh }) {
    const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'input', 'certs', 'specs', 'library'

    const [specs, setSpecs] = useState([]);
    const [standards, setStandards] = useState([]); // Master Library
    const [batches, setBatches] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    // -- STATE FOR SPECS --
    const [selectedProductForSpec, setSelectedProductForSpec] = useState('');
    const [selectedStandardId, setSelectedStandardId] = useState(''); // For dropdown
    const [newSpec, setNewSpec] = useState({ parameter_name: '', min_value: '', max_value: '', unit: '', method: '' });
    const [editingSpecId, setEditingSpecId] = useState(null);

    // -- STATE FOR STANDARDS LIBRARY --
    const [newStandard, setNewStandard] = useState({ id: null, name: '', unit: '', method: '' }); // Added id

    // -- STATE FOR INPUT --
    const [selectedBatchId, setSelectedBatchId] = useState(null);
    const [inputValues, setInputValues] = useState({}); // { specId: value }
    const [adjustmentNote, setAdjustmentNote] = useState(''); // [NEW] For rejected batches

    // -- STATE FOR MANUAL BATCH MODAL --
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualForm, setManualForm] = useState({ productId: '', lotNo: '' });

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
            // UPSERT with onConflict: 'name' to handle existing names in library
            const { error } = await supabase.from('quality_standards').upsert({
                ...(newStandard.id ? { id: newStandard.id } : {}),
                name: newStandard.name,
                unit: newStandard.unit,
                method: newStandard.method
            }, { onConflict: 'name' });

            if (error) throw error;
            alert(newStandard.id ? 'Standart güncellendi.' : 'Standart kütüphaneye eklendi/güncellendi.');

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
            if (editingSpecId) {
                // UPDATE
                const { data, error } = await supabase.from('quality_specs').update({
                    product_id: parseInt(selectedProductForSpec),
                    parameter_name: newSpec.parameter_name,
                    min_value: parseFloat(newSpec.min_value),
                    max_value: parseFloat(newSpec.max_value),
                    unit: newSpec.unit,
                    method: newSpec.method
                }).eq('id', editingSpecId).select().single();

                if (error) throw error;
                setSpecs(specs.map(s => s.id === editingSpecId ? data : s));
                alert('Kriter güncellendi.');
            } else {
                // INSERT
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
                alert('Kriter ürüne eklendi.');
            }

            setNewSpec({ parameter_name: '', min_value: '', max_value: '', unit: '', method: '' });
            setSelectedStandardId('');
            setEditingSpecId(null);
        } catch (error) {
            console.error('Kriter işlem hatası:', error);
            alert('Hata: ' + error.message);
        }
    };

    const handleEditSpec = (spec) => {
        setEditingSpecId(spec.id);
        setSelectedProductForSpec(spec.product_id.toString());
        setNewSpec({
            parameter_name: spec.parameter_name,
            min_value: spec.min_value.toString(),
            max_value: spec.max_value.toString(),
            unit: spec.unit || '',
            method: spec.method || ''
        });
        const std = standards.find(s => s.name === spec.parameter_name);
        if (std) setSelectedStandardId(std.id.toString());
    };

    const handleDeleteSpec = async (id) => {
        if (!window.confirm('Bu kriteri silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('quality_specs').delete().eq('id', id);
            if (error) throw error;
            setSpecs(specs.filter(s => s.id !== id));
        } catch (error) {
            alert('Silme hatası: ' + error.message);
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

    const handleCreateManualBatch = () => {
        // Just open the modal
        setManualForm({
            productId: '',
            lotNo: `TEST-${new Date().toISOString().slice(0, 10)}`
        });
        setShowManualModal(true);
    };

    const confirmCreateManualBatch = async () => {
        if (!manualForm.productId || !manualForm.lotNo) {
            return alert('Lütfen ürün ve Lot numarası seçiniz.');
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.from('quality_batches').insert({
                product_id: parseInt(manualForm.productId),
                lot_no: manualForm.lotNo,
                status: 'Pending',
                reference_type: 'Manual',
                notes: 'Manuel oluşturulan test kaydı'
            }).select().single();

            if (error) throw error;

            setBatches([data, ...batches]);
            setShowManualModal(false);
            alert('Parti başarıyla oluşturuldu!');
        } catch (error) {
            console.error('Parti oluşturma hatası:', error);
            alert('Hata: ' + error.message);
        } finally {
            setLoading(true);
            fetchData(); // Refresh to be safe
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

        const doc = await preparePDFWithFont();
        const fontName = doc.activeFont || 'helvetica';

        // Initial Header (Professional Layout)
        const docDate = new Date(batch.created_at).toLocaleDateString('tr-TR');
        drawCIHeader(doc, 'ANALİZ SERTİFİKASI', 'KALİTE KONTROL MERKEZİ', docDate, batch.lot_no);
        const startY = 45;

        // Unified Metadata Grid (Cleaned)
        const metaData = [
            { label: 'ÜRÜN ADI', value: product?.name || '-' },
            { label: 'ÜRÜN KODU', value: product?.product_code || product?.id?.toString() || '-' }
        ];
        let currY = drawCIMetadataGrid(doc, 14, startY, metaData, 2);
        currY += 5;

        // Status Decision Block (Integrated)
        const statusX = 14;
        const statusY = currY;

        doc.setFontSize(7);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(...CI_PALETTE.neutral_grey);
        doc.text('KALİTE KARARI', statusX, statusY);

        doc.setFontSize(14);
        const isApproved = batch.status === 'Approved';
        doc.setTextColor(...(isApproved ? CI_PALETTE.success_green : CI_PALETTE.error_red));
        doc.text(isApproved ? 'UYGUNDUR' : 'UYGUN DEĞİLDİR', statusX, statusY + 8);

        currY += 15;

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
            startY: currY,
            head: [['Parametre', 'Metot', 'Spesifikasyon', 'Ölçülen', 'Sonuç']],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: CI_PALETTE.pure_black,
                textColor: 255,
                font: fontName,
                fontStyle: 'bold',
                fontSize: 7,
                cellPadding: 3
            },
            bodyStyles: {
                font: fontName,
                fontSize: 8,
                cellPadding: 3,
                textColor: CI_PALETTE.pure_black
            },
            columnStyles: {
                0: { fontStyle: 'bold' },
                4: { halign: 'center', fontStyle: 'bold' }
            },
            margin: { top: 40, bottom: 35 },
            didDrawPage: (data) => {
                const docDate = new Date(batch.created_at).toLocaleDateString('tr-TR');
                drawCIHeader(doc, 'ANALİZ SERTİFİKASI', 'KALİTE KONTROL MERKEZİ', docDate, batch.lot_no);
                drawCIFooter(doc, globalSettings, 'Kalite Güvence Birimi v5.3.0');
            }
        });

        // High Precision Signatures
        let finalY = doc.lastAutoTable.finalY + 25;

        // Space Check
        if (finalY > 240) {
            doc.addPage();
            const docDate = new Date(batch.created_at).toLocaleDateString('tr-TR');
            drawCIHeader(doc, 'ANALİZ SERTİFİKASI', 'KALİTE KONTROL MERKEZİ', docDate, batch.lot_no);
            drawCIFooter(doc, globalSettings, 'Kalite Güvence Birimi v5.3.0');
            finalY = 45;
        }

        if (finalY < 250) {
            doc.setDrawColor(...CI_PALETTE.hairline_grey);
            doc.setLineWidth(0.05);

            // Left Sig
            doc.line(14, finalY + 15, 74, finalY + 15);
            doc.setFontSize(7);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(...CI_PALETTE.neutral_grey);
            doc.text('KALİTE KONTROL SORUMLUSU', 14, finalY);

            // Right Sig (System Seal)
            doc.line(136, finalY + 15, 196, finalY + 15);
            doc.text('SİSTEM ONAYI', 136, finalY);
            doc.setFont(fontName, 'italic');
            doc.setFontSize(6);
            doc.text(`Dijital Kimlik: ${batch.id}-${Date.now()}`, 136, finalY + 14);
        }

        return doc;
    };

    const downloadCoA = async (batch) => {
        const product = inventory.find(i => i.id === batch.product_id);
        const doc = await generateCoA(batch);
        doc.save(`Analiz_Sertifikasi_${product?.name || 'Urun'}_${batch.lot_no}.pdf`);
    };

    const handleSendCoAEmail = async (batch) => {
        const email = prompt('Müşteri e-posta adresini giriniz:');
        if (!email) return;

        setLoading(true);
        try {
            const doc = await generateCoA(batch);
            const pdfBlob = doc.output('blob');
            const product = inventory.find(i => i.id === batch.product_id);
            const fileName = `CoA_${batch.lot_no}_${Date.now()}.pdf`;

            // 1. Upload to Supabase Storage (certification-files)
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('certification-files')
                .upload(`temp_outbox/${fileName}`, pdfBlob, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 2. Get Public URL (or Signed URL if private)
            // Assuming private bucket, use Signed URL
            const { data: signedData, error: signError } = await supabase.storage
                .from('certification-files')
                .createSignedUrl(`temp_outbox/${fileName}`, 60 * 60 * 24); // 24 hours link

            if (signError) throw signError;

            // 3. Send Email via API
            await fetch('/api/send-coa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: email,
                    customerName: 'Sayın Müşterimiz',
                    productName: product?.name || 'Ürün',
                    batchNo: batch.lot_no,
                    fileUrl: signedData.signedUrl
                })
            });

            alert('CoA başarıyla e-posta olarak gönderildi! 📤');
        } catch (error) {
            console.error(error);
            alert('Gönderim hatası: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="heading-industrial text-2xl flex items-center gap-2">
                    <ClipboardCheck className="h-6 w-6 text-[#0071e3]" /> KALİTE KONTROL
                </h2>
                <button
                    onClick={fetchData}
                    className="p-2 bg-[#f5f5f7] rounded-full hover:bg-[#e5e5ea] transition-colors"
                    title="Yenile"
                >
                    <RefreshCw className={`h-5 w-5 text-[#86868b] ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* TABS */}
            <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
                {[
                    { id: 'pending', label: 'Test Bekleyenler', icon: AlertTriangle },
                    { id: 'input', label: 'Test Girişi', icon: Beaker },
                    { id: 'certs', label: 'Sertifikalar', icon: FileText },
                    { id: 'specs', label: 'Ürün Kriterleri', icon: Settings },
                    { id: 'library', label: 'Kütüphane', icon: Book }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-2 px-4 font-bold text-[11px] uppercase tracking-wider transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
                            ? 'text-[#0071e3] border-b-2 border-[#0071e3]'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENT */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 min-h-[400px]">

                {/* 0. LIBRARY TAB */}
                {activeTab === 'library' && (
                    <div className="space-y-6">
                        <div className="bg-[#fbfbfd] p-4 rounded-[6px] border border-[#d2d2d7]">
                            <h3 className="text-sm font-bold text-[#1d1d1f] mb-3 flex items-center gap-2 uppercase tracking-wide">
                                <Plus size={16} className="text-[#0071e3]" /> Yeni Standart Tanımla
                            </h3>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="label-industrial block">Parametre Adı</label>
                                    <input
                                        className="input-industrial"
                                        placeholder="Örn: pH, Yoğunluk"
                                        value={newStandard.name}
                                        onChange={e => setNewStandard({ ...newStandard, name: e.target.value })}
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="label-industrial block">Birim</label>
                                    <input
                                        className="input-industrial"
                                        placeholder="g/cm3"
                                        value={newStandard.unit}
                                        onChange={e => setNewStandard({ ...newStandard, unit: e.target.value })}
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="label-industrial block">Metot</label>
                                    <input
                                        className="input-industrial"
                                        placeholder="ASTM..."
                                        value={newStandard.method}
                                        onChange={e => setNewStandard({ ...newStandard, method: e.target.value })}
                                    />
                                </div>
                                <button
                                    onClick={handleAddStandard}
                                    className="btn-primary"
                                >
                                    {newStandard.id ? 'Güncelle' : 'Ekle'}
                                </button>
                                {newStandard.id && (
                                    <button
                                        onClick={() => setNewStandard({ id: null, name: '', unit: '', method: '' })}
                                        className="btn-secondary"
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
                        <div className="card-industrial p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <h3 className="md:col-span-2 text-sm font-bold text-[#1d1d1f] uppercase tracking-wide border-b border-[#d2d2d7] pb-2">Ürüne Kriter Ata</h3>

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label-industrial block">Ürün</label>
                                    <select
                                        className="select-industrial"
                                        value={selectedProductForSpec}
                                        onChange={e => setSelectedProductForSpec(e.target.value)}
                                    >
                                        <option value="">Seçiniz...</option>
                                        {inventory.map(i => <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label-industrial block">Kriter (Kütüphaneden)</label>
                                    <select
                                        className="select-industrial"
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
                                            <label className="label-industrial block">Min Değer</label>
                                            <input
                                                type="number"
                                                className="input-industrial"
                                                value={newSpec.min_value}
                                                onChange={e => setNewSpec({ ...newSpec, min_value: e.target.value })}
                                                placeholder="Min"
                                            />
                                        </div>
                                        <div>
                                            <label className="label-industrial block">Max Değer</label>
                                            <input
                                                type="number"
                                                className="input-industrial"
                                                value={newSpec.max_value}
                                                onChange={e => setNewSpec({ ...newSpec, max_value: e.target.value })}
                                                placeholder="Max"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="label-industrial block">Birim</label>
                                            <input
                                                placeholder="Birim"
                                                className="input-industrial bg-[#f5f5f7] cursor-not-allowed"
                                                value={newSpec.unit}
                                                readOnly
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="label-industrial block">Metot</label>
                                            <input
                                                placeholder="Metot"
                                                className="input-industrial bg-[#f5f5f7] cursor-not-allowed"
                                                value={newSpec.method}
                                                readOnly
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                                        {editingSpecId && (
                                            <button
                                                onClick={() => {
                                                    setEditingSpecId(null);
                                                    setNewSpec({ parameter_name: '', min_value: '', max_value: '', unit: '', method: '' });
                                                    setSelectedStandardId('');
                                                }}
                                                className="btn-secondary"
                                            >
                                                İptal
                                            </button>
                                        )}
                                        <button
                                            onClick={handleAddSpec}
                                            className="btn-primary flex items-center gap-2"
                                        >
                                            <Plus size={16} /> {editingSpecId ? 'Kriteri Güncelle' : 'Kriteri Kaydet'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* LIST */}
                        <div className="card-industrial overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="table-industrial">
                                    <thead>
                                        <tr>
                                            <th className="text-left w-1/4">Ürün</th>
                                            <th className="text-left w-1/4">Parametre</th>
                                            <th className="text-left w-1/4">Limitler</th>
                                            <th className="text-left w-1/6">Birim</th>
                                            <th className="text-left w-1/6">Metot</th>
                                            <th className="text-right w-12">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {specs.length === 0 ? (
                                            <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400 italic text-xs">Kayıtlı kriter yok.</td></tr>
                                        ) : (
                                            specs.map(s => {
                                                const p = inventory.find(i => i.id === s.product_id);
                                                return (
                                                    <tr key={s.id}>
                                                        <td>
                                                            <div className="font-medium text-[#1d1d1f]">{p ? p.name : '-'}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{p?.product_code || p?.id}</div>
                                                        </td>
                                                        <td>{s.parameter_name}</td>
                                                        <td className="font-mono text-gray-600 font-bold">{s.min_value} - {s.max_value}</td>
                                                        <td className="text-gray-500">{s.unit}</td>
                                                        <td className="text-gray-400 italic text-[10px]">{s.method}</td>
                                                        <td className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <button
                                                                    onClick={() => handleEditSpec(s)}
                                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                    title="Düzenle"
                                                                >
                                                                    <Settings size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteSpec(s.id)}
                                                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                                    title="Sil"
                                                                >
                                                                    <XCircle size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
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
                                                        <div key={spec.id} className="flex items-center gap-4 p-4 bg-white rounded-[6px] border border-[#d2d2d7]">
                                                            <div className="w-1/3">
                                                                <div className="font-bold text-[#1d1d1f] text-sm">{spec.parameter_name}</div>
                                                                <div className="text-[10px] text-[#86868b] mt-1 uppercase tracking-wide">
                                                                    Hedef: {spec.min_value} - {spec.max_value} {spec.unit}
                                                                </div>
                                                            </div>
                                                            <div className="w-1/3">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder="Ölçülen Değer"
                                                                    className="input-industrial font-mono text-center text-lg py-2"
                                                                    value={inputValues[spec.id] || ''}
                                                                    onChange={e => setInputValues({ ...inputValues, [spec.id]: e.target.value })}
                                                                />
                                                            </div>
                                                            <div className="w-1/3 text-right">
                                                                {inputValues[spec.id] && (
                                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${(parseFloat(inputValues[spec.id]) >= spec.min_value && parseFloat(inputValues[spec.id]) <= spec.max_value)
                                                                        ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-red-100 text-red-700 ring-1 ring-red-200'
                                                                        }`}>
                                                                        {(parseFloat(inputValues[spec.id]) >= spec.min_value && parseFloat(inputValues[spec.id]) <= spec.max_value)
                                                                            ? <><CheckCircle size={14} /> UYGUN</>
                                                                            : <><XCircle size={14} /> SAPMA</>
                                                                        }
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* REVISION NOTE INPUT */}
                                            <div className="mt-6 bg-[#fff9f0] p-4 rounded-[6px] border border-[#f5d0b0]">
                                                <h4 className="font-bold text-[#c76a16] mb-2 flex items-center gap-2 text-sm uppercase">
                                                    <AlertTriangle size={16} /> Revizyon / Düzeltme Talimatı (Opsiyonel)
                                                </h4>
                                                <p className="text-[10px] text-[#86868b] mb-2">Eğer sonuçlar uygun değilse, üretime iletilecek düzeltme talimatlarını buraya giriniz.</p>
                                                <textarea
                                                    className="w-full p-3 border border-[#f5d0b0] rounded-[6px] focus:border-[#c76a16] outline-none text-sm bg-white"
                                                    rows="3"
                                                    placeholder="Düzeltme reçetesi veya notları..."
                                                    value={adjustmentNote}
                                                    onChange={e => setAdjustmentNote(e.target.value)}
                                                />
                                            </div>

                                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-[#d2d2d7]">
                                                <button
                                                    onClick={() => setSelectedBatchId(null)}
                                                    className="btn-secondary"
                                                >
                                                    İptal
                                                </button>
                                                <button
                                                    onClick={handleSaveResults}
                                                    disabled={batchSpecs.length === 0}
                                                    className="btn-primary-green flex items-center gap-2"
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
                        <div className="card-industrial overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="table-industrial">
                                    <thead>
                                        <tr>
                                            <th className="text-left w-1/6">Tarih</th>
                                            <th className="text-left w-1/3">Ürün</th>
                                            <th className="text-left w-1/6">Parti (Lot) No</th>
                                            <th className="text-left w-1/6">Durum</th>
                                            <th className="text-right w-1/6">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batches.filter(b => b.status !== 'Pending').length === 0 ? (
                                            <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400 italic text-xs">Henüz tamamlanmış analiz yok.</td></tr>
                                        ) : (
                                            batches.filter(b => b.status !== 'Pending').map(batch => {
                                                const prod = inventory.find(i => i.id === batch.product_id);
                                                return (
                                                    <tr key={batch.id}>
                                                        <td className="font-mono text-gray-500 text-xs">{new Date(batch.created_at).toLocaleDateString('tr-TR')}</td>
                                                        <td className="font-medium text-[#1d1d1f]">{prod?.name || 'Bilinmeyen'}</td>
                                                        <td>
                                                            <span className="font-mono text-xs font-medium text-gray-700 bg-gray-50 px-1 py-0.5 rounded border border-gray-100">
                                                                {batch.lot_no}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`inline-flex px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase border ${batch.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                                                                }`}>
                                                                {batch.status === 'Approved' ? 'QC ONAYLI' : 'RED'}
                                                            </span>
                                                        </td>
                                                        <td className="text-right">
                                                            <button
                                                                onClick={() => downloadCoA(batch)}
                                                                className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 font-medium text-xs transition-colors"
                                                            >
                                                                <FileText size={14} /> İndir
                                                            </button>
                                                            <button
                                                                onClick={() => handleSendCoAEmail(batch)}
                                                                className="ml-3 text-green-600 hover:text-green-800 inline-flex items-center gap-1 font-medium text-xs transition-colors"
                                                            >
                                                                <Mail size={14} /> Gönder
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
                    </div>
                )}

                {/* MANUAL BATCH MODAL */}
                {showManualModal && (
                    <div className="modal-overlay-industrial flex items-center justify-center z-50 p-4">
                        <div className="modal-content-industrial w-full max-w-md animate-scale-in">
                            <div className="modal-header-industrial">
                                <h3 className="font-bold text-[#1d1d1f] flex items-center gap-2 uppercase text-sm tracking-wide">
                                    <Plus size={16} className="text-[#0071e3]" /> Manuel Parti Oluştur
                                </h3>
                                <button onClick={() => setShowManualModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <XCircle size={20} />
                                </button>
                            </div>

                            <div className="modal-body-industrial space-y-4">
                                <div>
                                    <label className="label-industrial block">Ürün Seçiniz</label>
                                    <select
                                        className="select-industrial"
                                        value={manualForm.productId}
                                        onChange={e => setManualForm({ ...manualForm, productId: e.target.value })}
                                    >
                                        <option value="">-- Ürün Filtreleniyor --</option>
                                        {inventory
                                            .filter(i => specs.some(s => s.product_id === i.id)) // ONLY SHOW PRODUCTS WITH SPECS
                                            .map(i => (
                                                <option key={i.id} value={i.id}>
                                                    {i.name} {i.product_code ? `(${i.product_code})` : ''}
                                                </option>
                                            ))
                                        }
                                    </select>
                                    {inventory.filter(i => specs.some(s => s.product_id === i.id)).length === 0 && (
                                        <p className="text-[10px] text-red-500 mt-1 italic">Henüz hiçbir ürün için test kriteri tanımlanmamış!</p>
                                    )}
                                </div>

                                <div>
                                    <label className="label-industrial block">Lot / Parti Numarası</label>
                                    <input
                                        className="input-industrial font-mono"
                                        value={manualForm.lotNo}
                                        onChange={e => setManualForm({ ...manualForm, lotNo: e.target.value })}
                                        placeholder="Örn: BATCH-001"
                                    />
                                </div>

                                <div className="bg-[#e8f2ff] p-3 rounded-[6px] border border-[#d0e6ff] italic text-[10px] text-[#0071e3]">
                                    ℹ️ Sadece kalite kriteri (pH, Yoğunluk vb.) tanımlanmış ürünler listelenmektedir.
                                </div>
                            </div>

                            <div className="modal-footer-industrial">
                                <button
                                    onClick={() => setShowManualModal(false)}
                                    className="btn-secondary"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={confirmCreateManualBatch}
                                    disabled={!manualForm.productId || !manualForm.lotNo}
                                    className="btn-primary"
                                >
                                    Partiyi Oluştur
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
