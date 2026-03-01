import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function AssignedStaffModal({ isOpen, onClose, shiftData }) {
    const [assignedStaff, setAssignedStaff] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isOpen || !shiftData) return

        const fetchAssigned = async () => {
            setLoading(true)

            const { data: assignments, error: assignError } = await supabase
                .from('shift_assignments')
                .select('id, user_id')
                .eq('shift_id', shiftData.id)

            if (assignments && assignments.length > 0) {
                const userIds = assignments.map(a => a.user_id)
                // Fetch profiles manually to avoid PostgREST foreign key mapping issues
                const { data: profiles, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, full_name, username, phone_number, avatar_url')
                    .in('id', userIds)

                let formattedStaff = []
                if (profiles) {
                    formattedStaff = assignments.map(item => {
                        const profile = profiles.find(p => p.id === item.user_id)
                        if (!profile) return null;
                        return {
                            assignment_id: item.id,
                            ...profile
                        }
                    }).filter(Boolean)
                }
                setAssignedStaff(formattedStaff)
            } else {
                setAssignedStaff([])
                if (assignError) console.error("Error fetching assigned staff:", assignError)
            }

            setLoading(false)
        }

        fetchAssigned()

        // Subscribe to changes on shift_assignments table for this shift
        const channel = supabase.channel(`assigned_staff_${shiftData.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shift_assignments',
                filter: `shift_id=eq.${shiftData.id}`
            }, () => {
                fetchAssigned()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [isOpen, shiftData])

    if (!isOpen || !shiftData) return null

    const handleRemoveStaff = async (assignmentId) => {
        const { error } = await supabase
            .from('shift_assignments')
            .delete()
            .eq('id', assignmentId)

        if (error) {
            console.error("Error removing staff:", error)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark-navy/60 backdrop-blur-sm p-4">
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-background-light/50 dark:bg-background-dark/50 shrink-0">
                    <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark line-clamp-1">Assigned Staff - {shiftData.name || "Shift"}</h3>
                    <button onClick={onClose} className="text-text-secondary-light hover:text-danger flex-shrink-0 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="overflow-y-auto flex-1 p-4 space-y-3 min-h-[200px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
                        </div>
                    ) : assignedStaff.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 h-full">
                            <span className="material-symbols-outlined text-4xl mb-3 text-slate-300 dark:text-slate-600">person_off</span>
                            <p>No staff assigned to this shift yet.</p>
                        </div>
                    ) : (
                        assignedStaff.map(staff => (
                            <div key={staff.assignment_id} className="flex items-center gap-4 p-3 hover:bg-background-light dark:hover:bg-background-dark/50 rounded-lg transition-colors border border-transparent hover:border-primary/20 group">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                    {staff.avatar_url ? (
                                        <img src={staff.avatar_url} alt={staff.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            {(staff.full_name || staff.username || '?')[0].toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-text-primary-light dark:text-text-primary-dark truncate capitalize">
                                        {staff.full_name || staff.username}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-mono truncate">
                                            #{staff.id.substring(0, 5).toUpperCase()}
                                        </p>
                                        {staff.phone_number && (
                                            <p className="text-xs text-text-secondary-light/80 dark:text-text-secondary-dark/80 flex items-center gap-1 truncate">
                                                <span className="material-symbols-outlined text-[14px]">phone</span>
                                                {staff.phone_number}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveStaff(staff.assignment_id)}
                                    className="w-8 h-8 rounded-full bg-red-50 text-red-500 dark:bg-red-900/10 flex items-center justify-center hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    title="Remove from shift"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-background-light/30 dark:bg-background-dark/30 shrink-0">
                    <button onClick={onClose} className="w-full py-3 rounded-lg bg-mint-green text-dark-navy font-bold hover:bg-primary-hover transition-colors shadow-md hover:shadow-lg">
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
