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

            // Trigger Email API
            await fetch('/api/send-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    role: formData.role,
                    inviterName: currentUser.email // ideally name, but email works
                })
            });

            alert('Kullanıcı davet edildi ve e-posta gönderildi! 📧');
            setFormData({ email: '', role: 'operator' });
            setShowForm(false);
            fetchMembers();
        } catch (error) {
            console.error(error);
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
                <h2 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">
                    Takım Üyeleri & Yetkiler
                </h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <UserPlus className="h-4 w-4" /> Yeni Kullanıcı Ekle
                </button>
            </div>

            {showForm && (
                <div className="bg-[#fbfbfd] p-6 rounded-[6px] shadow-sm border border-[#d2d2d7] animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold text-lg mb-4 text-[#1d1d1f]">Yeni Kullanıcı Davet Et</h3>
                    <form onSubmit={handleInvite} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label-industrial block">E-posta Adresi</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="input-industrial"
                                    placeholder="ornek@sirket.com"
                                />
                            </div>
                            <div>
                                <label className="label-industrial block">Rol</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="select-industrial"
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
                                className="btn-secondary"
                            >
                                İptal
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                            >
                                Davet Et
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="rounded-[6px] border border-[#d2d2d7] overflow-hidden shadow-sm">
                <table className="table-industrial">
                    <thead>
                        <tr>
                            <th className="text-left py-3 px-4">Kullanıcı</th>
                            <th className="text-left py-3 px-4">Rol</th>
                            <th className="text-left py-3 px-4">Durum</th>
                            <th className="text-right py-3 px-4">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d2d2d7]">
                        {/* Always show the current user as Admin/Owner */}
                        <tr className="bg-[#f5f5f7]">
                            <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-[#e8f2ff] flex items-center justify-center text-[#0071e3] font-bold mr-3 border border-[#d0e6ff]">
                                        {currentUser.email[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-[#1d1d1f]">{currentUser.email}</div>
                                        <div className="text-xs text-[#86868b]">Hesap Sahibi</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className="badge-industrial badge-industrial-blue">
                                    Admin
                                </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm text-green-600 flex items-center gap-1 font-medium">
                                    <Shield className="h-4 w-4" /> Aktif
                                </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <span className="text-[#86868b]">-</span>
                            </td>
                        </tr>

                        {members.map((member) => (
                            <tr key={member.id} className="hover:bg-[#f5f5f7] transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-8 w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] font-bold mr-3 border border-[#d2d2d7]">
                                            {member.member_email[0].toUpperCase()}
                                        </div>
                                        <div className="text-sm font-medium text-[#1d1d1f]">{member.member_email}</div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`badge-industrial ${member.role === 'admin' ? 'badge-industrial-blue' :
                                        member.role === 'operator' ? 'badge-industrial-gray' :
                                            'bg-[#f5f5f7] text-[#1d1d1f] border-[#d2d2d7]'
                                        }`}>
                                        {member.role === 'admin' ? 'Yönetici' :
                                            member.role === 'operator' ? 'Operatör' :
                                                member.role === 'viewer' ? 'İzleyici' : member.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    {member.member_id ? (
                                        <span className="text-sm text-green-600 font-medium">Katıldı</span>
                                    ) : (
                                        <span className="text-sm text-[#ff9f0a] flex items-center gap-1 font-medium">
                                            <Mail className="h-4 w-4" /> Bekliyor
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleRemove(member.id)}
                                        className="text-[#d21e1e] hover:text-[#b91c1c] transition-colors"
                                        title="Yetkiyi Kaldır"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {members.length === 0 && (
                            <tr>
                                <td colSpan="4" className="px-4 py-8 text-center text-[#86868b]">
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
