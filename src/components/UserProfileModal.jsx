import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils'

export function UserProfileModal({ isOpen, onClose }) {
    const navigate = useNavigate();
    const { user, profile, signOut, refreshProfile } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [passwordError, setPasswordError] = useState(null);
    const [passwordSuccess, setPasswordSuccess] = useState(null);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        dob: '',
        username: '',
        phone: ''
    });

    // Populate form data from real profile
    useEffect(() => {
        if (profile || user) {
            setFormData({
                name: profile?.full_name || user?.user_metadata?.full_name || '',
                dob: user?.user_metadata?.dob || '',
                username: profile?.username || user?.user_metadata?.username || '',
                phone: profile?.phone_number || user?.user_metadata?.phone || ''
            });
        }
    }, [profile, user]);

    const handleSave = async () => {
        // Save updated profile to Supabase
        if (user) {
            await supabase.from('profiles').upsert({
                id: user.id,
                full_name: formData.name,
                phone_number: formData.phone
            });
            if (refreshProfile) refreshProfile();
        }
        setIsEditing(false);
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/auth');
    }

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError(null);
        setPasswordSuccess(null);

        if (!passwordData.current.trim()) {
            setPasswordError('Please enter your current password.');
            return;
        }
        if (passwordData.new.length < 6) {
            setPasswordError('New password must be at least 6 characters.');
            return;
        }
        if (passwordData.new !== passwordData.confirm) {
            setPasswordError('New passwords do not match.');
            return;
        }

        setPasswordLoading(true);

        // Verify current password
        const { error: authError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: passwordData.current
        });

        if (authError) {
            setPasswordError('Current password is incorrect.');
            setPasswordLoading(false);
            return;
        }

        // Update to new password
        const { error: updateError } = await supabase.auth.updateUser({
            password: passwordData.new
        });

        setPasswordLoading(false);

        if (updateError) {
            setPasswordError(updateError.message);
            return;
        }

        setPasswordSuccess('Password changed successfully!');
        setPasswordData({ current: '', new: '', confirm: '' });
        setTimeout(() => {
            setShowChangePassword(false);
            setPasswordSuccess(null);
        }, 2000);
    };

    const handleClose = () => {
        setShowChangePassword(false);
        setPasswordData({ current: '', new: '', confirm: '' });
        setPasswordError(null);
        setPasswordSuccess(null);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={handleClose}
            ></div>
            <div className="relative bg-white dark:bg-neutral-800 w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                        {showChangePassword ? 'Change Password' : 'Profile Information'}
                    </h3>
                    <button onClick={handleClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[80vh] no-scrollbar">
                    {showChangePassword ? (
                        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                            {passwordError && (
                                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                                    {passwordError}
                                </div>
                            )}
                            {passwordSuccess && (
                                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 text-sm border border-emerald-100">
                                    {passwordSuccess}
                                </div>
                            )}

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Current Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="Enter current password"
                                    value={passwordData.current}
                                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">New Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="Minimum 6 characters"
                                    value={passwordData.new}
                                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="Repeat new password"
                                    value={passwordData.confirm}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={passwordLoading}
                                className="w-full mt-4 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-neutral-900 font-bold transition-all disabled:opacity-50"
                            >
                                {passwordLoading ? 'Updating...' : 'Update Password'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowChangePassword(false)}
                                className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </form>
                    ) : (
                        <div className="flex flex-col items-center">
                            {/* Avatar */}
                            <div className="relative mb-6">
                                <div
                                    className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg"
                                    style={{ backgroundColor: getAvatarColor(formData.name) }}
                                >
                                    {profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        getAvatarInitials(formData.name)
                                    )}
                                </div>
                            </div>

                            {/* Details */}
                            <div className="w-full space-y-5 mb-8">
                                {[
                                    { label: 'NAME', icon: 'person', key: 'name', value: formData.name, editable: true },
                                    { label: 'ACCOUNT ID', icon: 'badge', key: 'id', value: `#${user?.id?.substring(0, 8).toUpperCase() || '------'}`, isMono: true },
                                    { label: 'EMAIL', icon: 'mail', key: 'email', value: user?.email || '', isEmail: true },
                                    { label: 'DATE OF BIRTH', icon: 'calendar_month', key: 'dob', value: formData.dob || '—', editable: true },
                                    { label: 'USERNAME', icon: 'alternate_email', key: 'username', value: formData.username || 'Not set' },
                                    { label: 'PHONE NUMBER', icon: 'call', key: 'phone', value: formData.phone || '—', editable: true }
                                ].map((item) => (
                                    <div key={item.key} className="flex items-start gap-4">
                                        <div className="mt-1 text-teal-600 dark:text-primary">
                                            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-0.5">{item.label}</p>
                                            {isEditing && item.editable ? (
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent text-sm font-bold text-neutral-800 dark:text-neutral-200 border-b border-primary/40 focus:border-primary outline-none py-0.5"
                                                    value={item.value}
                                                    onChange={(e) => setFormData({ ...formData, [item.key]: e.target.value })}
                                                />
                                            ) : (
                                                <p className={`text-sm font-bold text-neutral-700 dark:text-neutral-200 truncate ${item.isMono ? 'font-mono' : ''}`}>
                                                    {item.value}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="w-full flex flex-col gap-3">
                                {isEditing ? (
                                    <button
                                        onClick={handleSave}
                                        className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-neutral-900 font-bold transition-all shadow-md active:scale-95"
                                    >
                                        Save Changes
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="w-full py-3.5 rounded-xl bg-[#E6F4F1] dark:bg-emerald-900/20 text-teal-700 dark:text-primary font-bold transition-all hover:bg-[#dcf0ec] active:scale-95"
                                    >
                                        Edit Profile
                                    </button>
                                )}

                                <button
                                    onClick={() => setShowChangePassword(true)}
                                    className="w-full py-3.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 font-bold transition-all hover:bg-neutral-50 dark:hover:bg-neutral-700/50 flex items-center justify-center gap-2 shadow-sm active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-xl">vpn_key</span>
                                    Change Password
                                </button>

                                {showLogoutConfirm ? (
                                    <div className="mt-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 flex flex-col gap-3">
                                        <p className="text-xs font-bold text-red-600 text-center">Are you sure you want to logout?</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowLogoutConfirm(false)}
                                                className="flex-1 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-700"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleLogout}
                                                className="flex-1 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600"
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowLogoutConfirm(true)}
                                        className="mt-2 py-2 text-sm font-bold text-red-500 hover:text-red-700 transition-colors"
                                    >
                                        Logout
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
