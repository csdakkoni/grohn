import React, { useState, useEffect } from 'react';
import {
    FileText, ShieldCheck, Users, Calendar, Search, Plus, ExternalLink,
    Trash2, Edit, CheckCircle2, Clock, AlertCircle, X, Download, Save, Trash, Upload, Loader2
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function MarketingModule({ inventory, accounts, onRefresh, currentOwnerId, userRole, user }) {
    const [activeSubTab, setActiveSubTab] = useState('documents');
    const [isLoading, setIsLoading] = useState(false);

    const [documents, setDocuments] = useState([]);
    const [certs, setCerts] = useState([]);
    const [visits, setVisits] = useState([]);
    const [plans, setPlans] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);

    useEffect(() => {
        if (currentOwnerId) {
            fetchMarketingData();
            fetchTeamMembers();
        }
    }, [activeSubTab, currentOwnerId]);

    const fetchMarketingData = async () => {
        setIsLoading(true);
        try {
            if (activeSubTab === 'documents') {
                const { data, error } = await supabase.from('product_documents').select('*').eq('user_id', currentOwnerId);
                if (error) throw error;
                setDocuments(data || []);
            } else if (activeSubTab === 'certs') {
                const { data, error } = await supabase.from('product_certifications').select('*').eq('user_id', currentOwnerId);
                if (error) throw error;
                setCerts(data || []);
            } else if (activeSubTab === 'visits') {
                const { data, error } = await supabase.from('marketing_visits').select('*').eq('user_id', currentOwnerId).order('visit_date', { ascending: false });
                if (error) throw error;
                setVisits(data || []);
            } else if (activeSubTab === 'plans') {
                const { data, error } = await supabase.from('marketing_plans').select('*').eq('user_id', currentOwnerId).order('week_start_date', { ascending: false });
                if (error) throw error;
                setPlans(data || []);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTeamMembers = async () => {
        try {
            const { data, error } = await supabase
                .from('team_members')
                .select('*')
                .eq('owner_id', currentOwnerId);
            if (error) throw error;
            setTeamMembers(data || []);
        } catch (error) {
            console.error('Team fetch error:', error);
        }
    };

    const handleDelete = async (table, id) => {
        if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            fetchMarketingData();
        } catch (error) {
            alert('Silme hatası: ' + error.message);
        }
    };

    return (
        <div className="p-6 space-y-8 animate-fade-in font-sans text-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="heading-industrial text-2xl flex items-center gap-2">
                        <Users className="w-6 h-6 text-[#0071e3]" />
                        PAZARLAMA & CRM OPERASYONLARI
                    </h1>
                    <p className="text-[#86868b] text-sm mt-1">
                        Ürün dokümanlarını yönetin, sertifikaları takip edin ve müşteri ilişkilerini raporlayın.
                    </p>
                </div>
            </div>

            <div className="flex border-b border-[#d2d2d7] overflow-x-auto whitespace-nowrap scrollbar-hide">
                {[
                    { id: 'documents', label: 'DOKÜMAN KÜTÜPHANESİ', icon: FileText },
                    { id: 'certs', label: 'SERTİFİKA TAKİBİ', icon: ShieldCheck },
                    { id: 'visits', label: 'MÜŞTERİ ZİYARETLERİ', icon: Users },
                    { id: 'plans', label: 'HAFTALIK PLANLAMA', icon: Calendar },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`px-6 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${activeSubTab === tab.id
                            ? 'border-[#0071e3] text-[#0071e3]'
                            : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in duration-300">
                {activeSubTab === 'documents' && (
                    <DocumentLibrary
                        documents={documents}
                        inventory={inventory}
                        onRefresh={fetchMarketingData}
                        ownerId={currentOwnerId}
                        onDelete={handleDelete}
                    />
                )}
                {activeSubTab === 'certs' && (
                    <CertManagement
                        certs={certs}
                        inventory={inventory}
                        onRefresh={fetchMarketingData}
                        ownerId={currentOwnerId}
                        onDelete={handleDelete}
                    />
                )}
                {activeSubTab === 'visits' && (
                    <CRMModule
                        visits={visits}
                        accounts={accounts}
                        onRefresh={fetchMarketingData}
                        ownerId={currentOwnerId}
                        userId={user?.id}
                    />
                )}
                {activeSubTab === 'plans' && (
                    <WeeklyPlanner
                        plans={plans}
                        onRefresh={fetchMarketingData}
                        ownerId={currentOwnerId}
                        userId={user?.id}
                        userRole={userRole}
                        teamMembers={teamMembers}
                    />
                )}
            </div>
        </div>
    );
}

// --- HELPERS ---
const validateFile = (file) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
        alert('Sadece PDF, JPG veya PNG yükleyebilirsiniz.');
        return false;
    }
    if (file.size > maxSize) {
        alert('Dosya boyutu 5MB\'dan küçük olmalıdır.');
        return false;
    }
    return true;
};

const handleViewPrivateFile = async (bucket, filePath) => {
    if (!filePath) return alert('Dosya yolu bulunamadı.');
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(filePath, 3600); // 1 hour validity

        if (error) throw error;
        window.open(data.signedUrl, '_blank');
    } catch (error) {
        console.error('Signed URL error:', error);
        alert('Dosyaya erişilemedi: ' + error.message);
    }
};

// --- SUB-COMPONENTS ---

function DocumentLibrary({ documents, inventory, onRefresh, ownerId, onDelete }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newDoc, setNewDoc] = useState({ inventory_id: '', doc_type: 'SDS', file_name: '', file_url: '', notes: '' });

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!validateFile(file)) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${ownerId}/${Date.now()}.${fileExt}`;
            const filePath = `documents/${fileName}`;

            let { error: uploadError } = await supabase.storage
                .from('product-documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Store both URL (for compatibility) and path (for private access)
            setNewDoc({ ...newDoc, file_path: filePath, file_name: file.name, file_url: filePath });
        } catch (error) {
            alert('Dosya yükleme hatası: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newDoc.file_path) return alert('Lütfen bir dosya yükleyin!');

        try {
            const { error } = await supabase.from('product_documents').insert([{
                user_id: ownerId,
                ...newDoc
            }]);
            if (error) throw error;
            setIsModalOpen(false);
            onRefresh();
            setNewDoc({ inventory_id: '', doc_type: 'SDS', file_name: '', file_url: '', notes: '' });
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input type="text" placeholder="Ürün veya doküman ara..." className="input-industrial pl-9" />
                </div>
                <button onClick={() => setIsModalOpen(true)} className="btn-industrial flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Yeni Doküman Ekle
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {inventory.filter(item => item.type === 'Mamul').map(item => {
                    const itemDocs = documents.filter(d => d.inventory_id === item.id);
                    return (
                        <div key={item.id} className="card-industrial p-4 hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-slate-900 border-b pb-2 mb-3 truncate">{item.name}</h4>
                            <div className="space-y-3">
                                {['CoA', 'SDS', 'TDS'].map(type => {
                                    const doc = itemDocs.find(d => d.doc_type === type);
                                    return (
                                        <div key={type} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500 font-medium">{type}:</span>
                                            {doc ? (
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleViewPrivateFile('product-documents', doc.file_path || doc.file_url)}
                                                        className="flex items-center gap-1 text-[#0071e3] hover:underline font-bold"
                                                    >
                                                        Görüntüle <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={() => onDelete('product_documents', doc.id)} className="text-red-400 hover:text-red-600">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 italic">Yüklenmedi</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-md animate-in zoom-in duration-200">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-[12px]">
                            <h3 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-[#0071e3]" /> Yeni Doküman Kaydı</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAdd} className="p-6 space-y-4">
                            <div>
                                <label className="label-industrial">Ürün Seçin</label>
                                <select className="input-industrial" required value={newDoc.inventory_id} onChange={e => setNewDoc({ ...newDoc, inventory_id: e.target.value })}>
                                    <option value="">Seçiniz...</option>
                                    {inventory.filter(i => i.type === 'Mamul').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label-industrial">Doküman Türü</label>
                                <select className="input-industrial" value={newDoc.doc_type} onChange={e => setNewDoc({ ...newDoc, doc_type: e.target.value })}>
                                    <option value="SDS">SDS (Güvenlik)</option>
                                    <option value="TDS">TDS (Teknik)</option>
                                    <option value="CoA">CoA (Analiz)</option>
                                    <option value="Other">Diğer</option>
                                </select>
                            </div>
                            <div>
                                <label className="label-industrial">Dosya Yükle</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-[8px] hover:border-[#0071e3] transition-colors bg-slate-50 cursor-pointer relative">
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                    />
                                    <div className="space-y-1 text-center">
                                        {isUploading ? (
                                            <div className="flex flex-col items-center">
                                                <Loader2 className="w-10 h-10 text-[#0071e3] animate-spin" />
                                                <p className="text-xs text-slate-500 mt-2">Buluta Yükleniyor...</p>
                                            </div>
                                        ) : newDoc.file_url ? (
                                            <div className="flex flex-col items-center">
                                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                                                <p className="text-xs text-green-600 mt-2 font-bold">{newDoc.file_name}</p>
                                                <p className="text-[10px] text-slate-400">Değiştirmek için tıklayın</p>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="mx-auto h-10 w-10 text-slate-400" />
                                                <div className="flex text-sm text-slate-600">
                                                    <span className="font-bold text-[#0071e3] hover:underline">Dosya Seçin</span>
                                                </div>
                                                <p className="text-xs text-slate-500">PDF, JPG, PNG (Max 5MB)</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full btn-industrial py-3 mt-4"
                                disabled={isUploading || !newDoc.file_path}
                            >
                                BULUTA KAYDET
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function CertManagement({ certs, inventory, onRefresh, ownerId, onDelete }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newCert, setNewCert] = useState({ inventory_id: '', cert_name: 'ZDHC', status: 'Valid', expiry_date: '', certificate_url: '' });

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!validateFile(file)) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${ownerId}/${Date.now()}.${fileExt}`;
            const filePath = `certs/${fileName}`;

            let { error: uploadError } = await supabase.storage
                .from('certification-files')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            setNewCert({ ...newCert, file_path: filePath, certificate_url: filePath });
        } catch (error) {
            alert('Dosya yükleme hatası: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('product_certifications').insert([{
                user_id: ownerId,
                ...newCert
            }]);
            if (error) throw error;
            setIsModalOpen(false);
            onRefresh();
            setNewCert({ inventory_id: '', cert_name: 'ZDHC', status: 'Valid', expiry_date: '', certificate_url: '' });
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    return (
        <div className="card-industrial p-2 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                <h3 className="text-sm font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-600" /> Ürün Sertifika Matrisi</h3>
                <button onClick={() => setIsModalOpen(true)} className="btn-industrial py-1.5 px-3 flex items-center gap-2 text-xs">
                    <Plus className="w-4 h-4" /> Sertifika Ekle
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="table-industrial">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="text-left font-bold text-xs">Ürün Adı</th>
                            <th className="text-center text-xs">ZDHC</th>
                            <th className="text-center text-xs">Oeko-Tex</th>
                            <th className="text-center text-xs">GOTS</th>
                            <th className="text-center text-xs">Bluesign</th>
                            <th className="text-right text-xs">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.filter(item => item.type === 'Mamul').map(item => {
                            const itemCerts = certs.filter(c => c.inventory_id === item.id);
                            return (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="font-bold text-slate-700 text-sm max-w-[200px] truncate">{item.name}</td>
                                    {['ZDHC', 'Oeko-Tex', 'GOTS', 'Bluesign'].map(certName => {
                                        const cert = itemCerts.find(c => c.cert_name === certName);
                                        return (
                                            <td key={certName} className="text-center p-2">
                                                {cert ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold ${cert.status === 'Valid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                            {cert.status === 'Valid' ? 'GEÇERLİ' : 'GEÇERSİZ'}
                                                        </span>
                                                        {cert.certificate_url && (
                                                            <button
                                                                onClick={() => handleViewPrivateFile('certification-files', cert.file_path || cert.certificate_url)}
                                                                className="text-[8px] text-[#0071e3] mt-0.5 font-bold hover:underline"
                                                            >
                                                                BELGE
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-200">-</span>
                                                )}
                                            </td>
                                        )
                                    })}
                                    <td className="text-right p-2">
                                        <div className="flex justify-end gap-2">
                                            {itemCerts.length > 0 && (
                                                <button onClick={() => onDelete('product_certifications', itemCerts[0].id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-4 duration-300">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-[12px]">
                            <h3 className="font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-600" /> Sertifika Kaydı</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAdd} className="p-6 space-y-4">
                            <div>
                                <label className="label-industrial">Ürün Seçin</label>
                                <select className="input-industrial" required value={newCert.inventory_id} onChange={e => setNewCert({ ...newCert, inventory_id: e.target.value })}>
                                    <option value="">Seçiniz...</option>
                                    {inventory.filter(i => i.type === 'Mamul').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-industrial">Sertifika Türü</label>
                                    <select className="input-industrial" value={newCert.cert_name} onChange={e => setNewCert({ ...newCert, cert_name: e.target.value })}>
                                        <option value="ZDHC">ZDHC</option>
                                        <option value="Oeko-Tex">Oeko-Tex</option>
                                        <option value="GOTS">GOTS</option>
                                        <option value="Bluesign">Bluesign</option>
                                        <option value="Other">Diğer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label-industrial">Durum</label>
                                    <select className="input-industrial" value={newCert.status} onChange={e => setNewCert({ ...newCert, status: e.target.value })}>
                                        <option value="Valid">Geçerli</option>
                                        <option value="Pending">Beklemede</option>
                                        <option value="Expired">Süresi Doldu</option>
                                        <option value="NA">Yok</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="label-industrial">Sertifika Belgesi Yükle</label>
                                <input
                                    type="file"
                                    className="input-industrial text-xs pt-2"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                />
                                {isUploading && <p className="text-[10px] text-[#0071e3] mt-1 animate-pulse italic">Yükleniyor...</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-industrial">Bitiş Tarihi</label>
                                    <input type="date" className="input-industrial" value={newCert.expiry_date} onChange={e => setNewCert({ ...newCert, expiry_date: e.target.value })} />
                                </div>
                                <div className="pt-8">
                                    <button type="submit" className="w-full btn-industrial py-3" disabled={isUploading}>EKLE</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function CRMModule({ visits, accounts, onRefresh, ownerId, userId }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newVisit, setNewVisit] = useState({ customer_id: '', visit_date: new Date().toISOString().split('T')[0], visit_type: 'Potential', report_content: '', next_action: '' });

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('marketing_visits').insert([{
                user_id: ownerId,
                visitor_id: userId,
                ...newVisit
            }]);
            if (error) throw error;
            setIsModalOpen(false);
            onRefresh();
            setNewVisit({ customer_id: '', visit_date: new Date().toISOString().split('T')[0], visit_type: 'Potential', report_content: '', next_action: '' });
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card-industrial p-4 bg-blue-50/40 border-blue-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-blue-600 font-black uppercase tracking-wider mb-1">Toplam Ziyaret</p>
                        <p className="text-2xl font-black text-blue-900">{visits.length}</p>
                    </div>
                    <Users className="w-10 h-10 text-blue-200/50" />
                </div>
                <div className="card-industrial p-4 bg-orange-50/40 border-orange-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-orange-600 font-black uppercase tracking-wider mb-1">Potansiyel Aday</p>
                        <p className="text-2xl font-black text-orange-900">{visits.filter(v => v.visit_type === 'Potential').length}</p>
                    </div>
                    <Clock className="w-10 h-10 text-orange-200/50" />
                </div>
            </div>

            <div className="card-industrial p-0 shadow-xl border-slate-200 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-white">
                    <h3 className="font-black text-slate-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-500" /> Son Ziyaret Raporları</h3>
                    <button onClick={() => setIsModalOpen(true)} className="btn-industrial bg-slate-900 text-white hover:bg-black py-2 px-4 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Ziyaret Raporu Gir
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="table-industrial">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-50 border-b">
                                <th className="text-xs uppercase font-black text-slate-500">Tarih</th>
                                <th className="text-xs uppercase font-black text-slate-500">Müşteri</th>
                                <th className="text-xs uppercase font-black text-slate-500">Tür</th>
                                <th className="text-xs uppercase font-black text-slate-500">Görüşme Özeti</th>
                                <th className="text-xs uppercase font-black text-slate-500">Sıradaki Aksiyon</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {visits.map(visit => {
                                const customer = accounts.find(a => a.id === parseInt(visit.customer_id));
                                return (
                                    <tr key={visit.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="whitespace-nowrap font-mono text-[11px] text-slate-500 px-4 py-3">{visit.visit_date}</td>
                                        <td className="font-bold text-slate-900 px-4 py-3">{customer?.name || 'Bilinmeyen'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black ${visit.visit_type === 'Current' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'
                                                }`}>
                                                {visit.visit_type === 'Current' ? 'MEVCUT' : 'POTANSİYEL'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="max-w-[300px] text-xs text-slate-600 leading-relaxed italic">{visit.report_content}</p>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-xs text-indigo-600">{visit.next_action}</td>
                                    </tr>
                                );
                            })}
                            {visits.length === 0 && (
                                <tr><td colSpan="5" className="py-20 text-center text-slate-300 italic">Henüz ziyaret raporu girilmemiş.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="p-5 border-b flex justify-between items-center bg-slate-900 text-white">
                            <h3 className="font-black flex items-center gap-2"><Users className="w-5 h-5" /> Yeni Ziyaret Raporu</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAdd} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Müşteri / Cari</label>
                                    <select className="input-industrial" required value={newVisit.customer_id} onChange={e => setNewVisit({ ...newVisit, customer_id: e.target.value })}>
                                        <option value="">Seçiniz...</option>
                                        {accounts.filter(a => a.type === 'Müşteri' || a.type === 'Her İkisi').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Ziyaret Tarihi</label>
                                    <input type="date" className="input-industrial" required value={newVisit.visit_date} onChange={e => setNewVisit({ ...newVisit, visit_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Ziyaret Türü</label>
                                    <div className="flex bg-slate-100 p-1 rounded-[6px] gap-1">
                                        <button type="button" onClick={() => setNewVisit({ ...newVisit, visit_type: 'Potential' })} className={`flex-1 py-1.5 rounded-[4px] text-[10px] font-black transition-all ${newVisit.visit_type === 'Potential' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}>POTANSİYEL</button>
                                        <button type="button" onClick={() => setNewVisit({ ...newVisit, visit_type: 'Current' })} className={`flex-1 py-1.5 rounded-[4px] text-[10px] font-black transition-all ${newVisit.visit_type === 'Current' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>MEVCUT</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">İstenen Aksiyon</label>
                                    <input type="text" className="input-industrial" placeholder="Teklif, TDS Gönderimi vb." value={newVisit.next_action} onChange={e => setNewVisit({ ...newVisit, next_action: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Görüşme Notları / Rapor</label>
                                <textarea rows="4" className="input-industrial resize-none text-sm p-3" required placeholder="Görüşülen kişiler, konuşulan konular, sonuçlar..." value={newVisit.report_content} onChange={e => setNewVisit({ ...newVisit, report_content: e.target.value })}></textarea>
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-[8px] hover:bg-black transition-all shadow-lg active:scale-95">RAPORU KAYDET</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function WeeklyPlanner({ plans, onRefresh, ownerId, userId, userRole, teamMembers }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPlan, setNewPlan] = useState({
        staff_id: '',
        week_start_date: '',
        status: 'Draft',
        plan_data: [
            { day: 'Pazartesi', tasks: '' },
            { day: 'Salı', tasks: '' },
            { day: 'Çarşamba', tasks: '' },
            { day: 'Perşembe', tasks: '' },
            { day: 'Cuma', tasks: '' },
            { day: 'Cumartesi', tasks: '' }
        ]
    });

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('marketing_plans').insert([{
                user_id: ownerId,
                manager_id: userId,
                ...newPlan
            }]);
            if (error) throw error;
            setIsModalOpen(false);
            onRefresh();
            setNewPlan({
                staff_id: '',
                week_start_date: '',
                status: 'Draft',
                plan_data: [
                    { day: 'Pazartesi', tasks: '' },
                    { day: 'Salı', tasks: '' },
                    { day: 'Çarşamba', tasks: '' },
                    { day: 'Perşembe', tasks: '' },
                    { day: 'Cuma', tasks: '' },
                    { day: 'Cumartesi', tasks: '' }
                ]
            });
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const handleTaskChange = (index, value) => {
        const updatedData = [...newPlan.plan_data];
        updatedData[index].tasks = value;
        setNewPlan({ ...newPlan, plan_data: updatedData });
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#fefce8] border border-[#fef08a] p-4 rounded-[12px] flex items-start gap-4 shadow-sm">
                <div className="bg-[#fef08a] p-2 rounded-full">
                    <Calendar className="h-5 w-5 text-[#854d0e]" />
                </div>
                <div>
                    <h4 className="font-black text-[#854d0e] text-sm uppercase tracking-tight">Ekip Planlama & Saha Yönetimi</h4>
                    <p className="text-xs text-[#854d0e]/80 mt-1 leading-relaxed">
                        Buradan pazarlama ekibinin haftalık programlarını tasarlayabilir ve saha görevlerini atayabilirsiniz. Haftalık planlar CRM modülü ile senkronize çalışır.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map(plan => (
                    <div key={plan.id} className="card-industrial p-0 border-slate-200 hover:border-indigo-300 transition-all overflow-hidden group">
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-start">
                            <div>
                                <p className="text-[9px] font-black text-indigo-400 uppercase mb-0.5">Haftalık Program</p>
                                <h4 className="font-black text-slate-900 leading-tight">{plan.week_start_date} Haftası</h4>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-black ${plan.status === 'Confirmed' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {plan.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            {(plan.plan_data || []).slice(0, 3).map((d, i) => (
                                <div key={i} className="flex gap-3 items-start animate-in slide-in-from-left duration-200" style={{ animationDelay: `${i * 50}ms` }}>
                                    <span className="text-[10px] font-black text-slate-400 w-14 pt-0.5 uppercase">{d.day.slice(0, 3)}</span>
                                    <span className="text-xs text-slate-700 leading-normal line-clamp-2">{d.tasks}</span>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 pt-0">
                            <button className="w-full py-2.5 bg-white border border-slate-200 rounded-[6px] text-[10px] font-black text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all group-hover:border-indigo-200">
                                PROGRAMI AÇ VE DÜZENLE
                            </button>
                        </div>
                    </div>
                ))}

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="card-industrial p-8 border-dashed border-2 border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50/50 group"
                >
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest">Yeni Haftalık Plan</p>
                    <p className="text-[10px] mt-1 italic text-slate-400/80">Personel bazlı program oluşturun</p>
                </button>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="p-5 border-b flex justify-between items-center bg-indigo-900 text-white">
                            <h3 className="font-black flex items-center gap-2"><Calendar className="w-5 h-5" /> Haftalık Program Oluştur</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAdd} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Personel Seçin</label>
                                    <select className="input-industrial" required value={newPlan.staff_id} onChange={e => setNewPlan({ ...newPlan, staff_id: e.target.value })}>
                                        <option value="">Seçiniz...</option>
                                        <option value={userId}>Kendim (Yönetici)</option>
                                        {teamMembers.map(m => <option key={m.member_id} value={m.member_id}>{m.member_email} ({m.role})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Hafta Başlangıçı (Pazartesi)</label>
                                    <input type="date" className="input-industrial" required value={newPlan.week_start_date} onChange={e => setNewPlan({ ...newPlan, week_start_date: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-slate-900 border-b pb-2 uppercase tracking-widest">Günlük Görev Tanımları</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {newPlan.plan_data.map((day, index) => (
                                        <div key={day.day} className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">{day.day}</label>
                                            <input
                                                type="text"
                                                className="input-industrial"
                                                placeholder="Müşteri ziyaretleri, ofis işleri vb."
                                                value={day.tasks}
                                                onChange={e => handleTaskChange(index, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex bg-slate-50 p-4 rounded-[12px] justify-between items-center">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Durum</label>
                                    <select className="input-industrial py-1 text-xs" value={newPlan.status} onChange={e => setNewPlan({ ...newPlan, status: e.target.value })}>
                                        <option value="Draft">Taslak</option>
                                        <option value="Confirmed">Onaylandı / Yayınla</option>
                                    </select>
                                </div>
                                <button type="submit" className="bg-indigo-600 text-white font-black px-8 py-3 rounded-[8px] hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                                    PLANI KAYDET
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
