import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatTime } from '../utils/timeFormat'

export function AvailableStaffModal({ isOpen, onClose, shiftData }) {
    const [availableStaff, setAvailableStaff] = useState([])
    const [loading, setLoading] = useState(true)
    const [copiedPhone, setCopiedPhone] = useState(null)

    useEffect(() => {
        if (!isOpen || !shiftData) return

        const fetchStaff = async () => {
            setLoading(true)

            // 1. Fetch all approved user_roles for this role
            const { data: roleUsers, error: rolesError } = await supabase
                .from('user_roles')
                .select('id, user_id')
                .eq('role_id', shiftData.role_id)
                .eq('status', 'approved')

            // 2. Fetch users already assigned to this shift
            const { data: assignedData, error: assignedError } = await supabase
                .from('shift_assignments')
                .select('user_id')
                .eq('shift_id', shiftData.id)

            // 3. Fetch availabilities for this date
            const { data: availData, error: availError } = await supabase
                .from('availabilities')
                .select('user_id, start_time, end_time')
                .eq('role_id', shiftData.role_id)
                .eq('date', shiftData.date)

            if (roleUsers && assignedData && availData) {
                const assignedIds = new Set(assignedData.map(a => a.user_id))

                // Get ALL user IDs for this role, we want to show both assigned and unassigned available staff
                const allUserIds = roleUsers.map(ur => ur.user_id)

                // Fetch profiles manually to avoid PostgREST foreign key mapping issues
                let profileMap = {}
                if (allUserIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, username, phone_number, avatar_url')
                        .in('id', allUserIds)
                    if (profiles) {
                        profiles.forEach(p => { profileMap[p.id] = p })
                    }
                }

                // Map users and attach the isAssigned flag
                const allStaff = allUserIds.map(uid => {
                    const profile = profileMap[uid]
                    if (!profile) return null;
                    return {
                        ...profile,
                        isAssigned: assignedIds.has(uid)
                    }
                }).filter(Boolean)

                // Filter for explicitly available staff (100% Match) based on time
                // Use shared formatTime which handles all timestamp formats
                const sfStart = formatTime(shiftData.startTime || shiftData.start_time);
                const sfEnd = formatTime(shiftData.endTime || shiftData.end_time);

                const matched = allStaff.filter(staff => {
                    return availData.some(av => {
                        if (av.user_id !== staff.id) return false;
                        const avStart = formatTime(av.start_time);
                        const avEnd = formatTime(av.end_time);
                        return avStart <= sfStart && avEnd >= sfEnd;
                    });
                });

                setAvailableStaff(matched)
            } else {
                console.error("Error fetching staff for assignment:", rolesError || assignedError || availError)
                setAvailableStaff([])
            }

            setLoading(false)
        }

        fetchStaff()

        // Setup channels for user_roles, shift_assignments and availabilities
        const roleChannel = supabase.channel(`avail_roles_${shiftData.role_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `role_id=eq.${shiftData.role_id}` }, fetchStaff)
            .subscribe()

        const assignedChannel = supabase.channel(`avail_assign_${shiftData.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments', filter: `shift_id=eq.${shiftData.id}` }, fetchStaff)
            .subscribe()

        const availChannel = supabase.channel(`avail_avail_${shiftData.role_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'availabilities', filter: `role_id=eq.${shiftData.role_id}` }, fetchStaff)
            .subscribe()

        return () => {
            supabase.removeChannel(roleChannel)
            supabase.removeChannel(assignedChannel)
            supabase.removeChannel(availChannel)
        }
    }, [isOpen, shiftData])

    if (!isOpen || !shiftData) return null

    const handleAssignStaff = async (userId) => {
        const { error } = await supabase
            .from('shift_assignments')
            .insert({
                shift_id: shiftData.id,
                user_id: userId,
                is_manual_override: true
            })

        if (error) {
            console.error("Error assigning staff:", error)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-navy/60 backdrop-blur-sm p-4">
            <div className="bg-surface-light dark:bg-surface-dark rounded-[16px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-background-light/50 dark:bg-background-dark/50 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark line-clamp-1">Available Staff</h3>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{shiftData.name || "Shift"}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-text-secondary-light hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-2 min-h-[300px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
                        </div>
                    ) : availableStaff.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 h-full">
                            <span className="material-symbols-outlined text-4xl mb-3 text-slate-300 dark:text-slate-600">group_off</span>
                            <p>No available staff to assign.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {availableStaff.map(staff => (
                                <div key={staff.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/10 group">
                                    <div className="w-12 h-12 rounded-full border-2 border-primary/20 bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                        {staff.avatar_url ? (
                                            <img src={staff.avatar_url} alt={staff.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="font-bold text-slate-600 dark:text-slate-300">
                                                {(staff.full_name || staff.username || '?')[0].toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[15px] text-text-primary-light dark:text-white truncate">
                                            {staff.full_name || staff.username}
                                        </p>
                                        <p className="font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[11px] text-text-secondary-light dark:text-text-secondary-dark w-fit mt-1">
                                            ID: {staff.username ? staff.username : staff.id?.substring(0, 8).toUpperCase()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {staff.phone_number && (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(staff.phone_number)
                                                    setCopiedPhone(staff.phone_number)
                                                    setTimeout(() => setCopiedPhone(null), 2000)
                                                }}
                                                className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark hover:text-primary transition-colors cursor-pointer"
                                                title="Click to copy phone number"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">call</span>
                                                {staff.phone_number}
                                                <span className="material-symbols-outlined text-[13px] ml-1">
                                                    {copiedPhone === staff.phone_number ? 'check' : 'content_copy'}
                                                </span>
                                            </button>
                                        )}
                                        {staff.isAssigned ? (
                                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium text-xs border border-green-100 dark:border-green-800/50">
                                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                                <span>Assigned</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleAssignStaff(staff.id)}
                                                className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary hover:text-slate-900 hover:scale-110 active:scale-95 hover:shadow-md text-primary-dark dark:text-mint-green dark:bg-primary/10 dark:hover:bg-primary dark:hover:text-slate-900 flex items-center justify-center transition-all duration-200 shadow-sm"
                                                title="Assign to shift"
                                            >
                                                <span className="material-symbols-outlined font-bold text-xl">add</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-background-light/50 dark:bg-background-dark/50 shrink-0">
                    <button onClick={onClose} className="w-full py-3.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-text-primary-light dark:text-white font-bold transition-all transform active:scale-[0.98]">
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
