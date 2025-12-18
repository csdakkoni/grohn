import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, UserPlus, Trash2, Shield, Mail } from 'lucide-react';

export default function RoleManagementModule({ currentUser }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        role: 'operator'
    });

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('owner_id', currentUser.id);

        if (error) console.error('Error fetching members:', error);
        else setMembers(data || []);
        setLoading(false);
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        try {
            // 1. Check if user exists (Optional: Supabase doesn't expose this easily without admin API)
            // For now, we just insert into team_members. 
            // The user must sign up with this email to be linked later.
            // Ideally, we would have a trigger to link member_id on signup.

            // Note: In a real app, you'd use supabase.auth.admin.inviteUserByEmail (server-side)
            // Here we just record the permission.

            const { error } = await supabase.from('team_members').insert({
                owner_id: currentUser.id,
                member_email: formData.email,
                role: formData.role
                // member_id is left null until they sign up/login and we link them
            });

            if (error) throw error;

            alert('Kullanıcı davet edildi (yetki verildi)!');
            setFormData({ email: '', role: 'operator' });
            setShowForm(false);
            fetchMembers();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const handleRemove = async (id) => {
        if (window.confirm('Bu kullanıcının yetkisini kaldırmak istediğinize emin misiniz?')) {
            await supabase.from('team_members').delete().eq('id', id);
            fetchMembers();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Users className="h-6 w-6 text-indigo-600" /> Kullanıcı Yönetimi
                </h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <UserPlus className="h-4 w-4" /> Yeni Kullanıcı Ekle
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Yeni Kullanıcı Davet Et</h3>
                    <form onSubmit={handleInvite} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">E-posta Adresi</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    placeholder="ornek@sirket.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                >
                                    <option value="operator">Operatör (Veri Girişi)</option>
                                    <option value="viewer">İzleyici (Sadece Okuma)</option>
                                    <option value="admin">Admin (Tam Yetki)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                            >
                                Davet Et
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kullanıcı</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rol</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Durum</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {/* Always show the current user as Admin/Owner */}
                        <tr className="bg-indigo-50/50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold mr-3">
                                        {currentUser.email[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">{currentUser.email}</div>
                                        <div className="text-xs text-slate-500">Hesap Sahibi</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800">
                                    Admin
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-green-600 flex items-center gap-1">
                                    <Shield className="h-4 w-4" /> Aktif
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <span className="text-slate-400">-</span>
                            </td>
                        </tr>

                        {members.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold mr-3">
                                            {member.member_email[0].toUpperCase()}
                                        </div>
                                        <div className="text-sm font-medium text-slate-900">{member.member_email}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${member.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                            member.role === 'operator' ? 'bg-blue-100 text-blue-800' :
                                                'bg-slate-100 text-slate-800'
                                        }`}>
                                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {member.member_id ? (
                                        <span className="text-sm text-green-600">Katıldı</span>
                                    ) : (
                                        <span className="text-sm text-orange-500 flex items-center gap-1">
                                            <Mail className="h-4 w-4" /> Bekliyor
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleRemove(member.id)}
                                        className="text-red-600 hover:text-red-900 transition-colors"
                                        title="Yetkiyi Kaldır"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {members.length === 0 && (
                            <tr>
                                <td colspan="4" className="px-6 py-10 text-center text-slate-500">
                                    Henüz başka kullanıcı eklenmemiş.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
