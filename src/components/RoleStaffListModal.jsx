import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function RoleStaffListModal({ isOpen, onClose, role }) {
    const [copiedId, setCopiedId] = useState(null)
    const [staffList, setStaffList] = useState([])
    const [loading, setLoading] = useState(true)
    const [removingId, setRemovingId] = useState(null)

    useEffect(() => {
        if (!isOpen || !role) return;

        const fetchStaff = async () => {
            setLoading(true)

            // Get manager user IDs to exclude
            let managerIds = new Set();
            if (role.workspace_id) {
                const { data: mgrs } = await supabase
                    .from('workspace_members')
                    .select('user_id')
                    .eq('workspace_id', role.workspace_id)
                    .eq('role', 'MANAGER')
                if (mgrs) managerIds = new Set(mgrs.map(m => m.user_id));
            }

            // Fetch approved user_roles for this role
            const { data, error } = await supabase
                .from('user_roles')
                .select('id, user_id, status, created_at')
                .eq('role_id', role.id)
                .eq('status', 'approved')
                .order('created_at', { ascending: true })

            if (data) {
                // Exclude managers
                const filtered = data.filter(ur => !managerIds.has(ur.user_id))

                // Fetch profiles for these users
                const userIds = filtered.map(ur => ur.user_id).filter(Boolean)
                let profileMap = {}
                if (userIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, phone_number')
                        .in('id', userIds)
                    if (profiles) {
                        profiles.forEach(p => { profileMap[p.id] = p })
                    }
                }

                // Merge profile data into staff list
                const enriched = filtered.map(ur => ({
                    ...ur,
                    full_name: profileMap[ur.user_id]?.full_name || null,
                    phone_number: profileMap[ur.user_id]?.phone_number || null,
                }))
                setStaffList(enriched)
            } else if (error) {
                console.error("Error fetching staff list:", error)
            }
            setLoading(false)
        }

        fetchStaff()

        // Subscribe to changes on user_roles for realtime updates
        const channel = supabase.channel(`staff_list_${role.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_roles',
                filter: `role_id=eq.${role.id}`
            }, () => {
                fetchStaff()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [isOpen, role])

    const handleRemoveStaff = async (staff) => {
        setRemovingId(staff.id)

        // Delete user_role
        const { error: roleError } = await supabase
            .from('user_roles')
            .delete()
            .eq('id', staff.id)

        if (roleError) {
            console.error("Error removing user from role:", roleError)
            setRemovingId(null)
            return
        }

        // Also remove from workspace_members
        if (role.workspace_id) {
            await supabase
                .from('workspace_members')
                .delete()
                .eq('workspace_id', role.workspace_id)
                .eq('user_id', staff.user_id)
        }

        // Send notification to the removed employee
        await supabase.from('notifications').insert({
            user_id: staff.user_id,
            type: 'system',
            title: 'Removed from Role',
            message: `You have been removed from "${role.name}" by the manager.`
        })

        // Optimistic UI update
        setStaffList(prev => prev.filter(s => s.id !== staff.id))
        setRemovingId(null)
    }

    const handleCopyId = (userId) => {
        navigator.clipboard.writeText(userId)
        setCopiedId(userId)
        setTimeout(() => setCopiedId(null), 2000)
    }

    if (!isOpen || !role) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-white/10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="size-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <span className="material-symbols-outlined text-2xl">group</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">{role.name} Staff</h3>
                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{staffList.length} {staffList.length === 1 ? 'Employee' : 'Employees'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-text-secondary-light transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-4">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
                        </div>
                    ) : staffList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                            <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">group_off</span>
                            </div>
                            <p className="font-medium text-slate-500 dark:text-slate-400">No staff in this role yet</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Approved employees will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {staffList.map((staff) => {
                                const isRemoving = removingId === staff.id;
                                const shortId = staff.user_id?.substring(0, 8).toUpperCase();

                                return (
                                    <div key={staff.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold shrink-0 shadow-sm text-sm">
                                                {staff.full_name ? staff.full_name.charAt(0).toUpperCase() : <span className="material-symbols-outlined text-lg">person</span>}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                                                    {staff.full_name || 'Unknown Employee'}
                                                </span>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                                        ID: {shortId}
                                                    </span>
                                                    {staff.phone_number && (
                                                        <button
                                                            onClick={() => handleCopyId(staff.phone_number)}
                                                            className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark hover:text-primary transition-colors"
                                                            title="Click to copy phone number"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">call</span>
                                                            {staff.phone_number}
                                                            <span className="material-symbols-outlined text-[13px] ml-1">
                                                                {copiedId === staff.phone_number ? 'check' : 'content_copy'}
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleRemoveStaff(staff)}
                                            disabled={isRemoving}
                                            className="size-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                            title="Remove from role & workspace"
                                        >
                                            {isRemoving ? (
                                                <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-xl">close</span>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/30 border-t border-gray-100 dark:border-white/5 flex justify-between items-center shrink-0">
                    <span className="text-xs text-slate-400 font-medium">{staffList.length} {staffList.length === 1 ? 'Employee' : 'Employees'} in {role.name}</span>
                    <button onClick={onClose} className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div >
    )
}
