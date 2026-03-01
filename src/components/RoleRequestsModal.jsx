import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function RoleRequestsModal({ isOpen, onClose, role }) {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState(null)

    useEffect(() => {
        if (!isOpen || !role) return;

        const fetchRequests = async () => {
            setLoading(true)

            // Fetch pending user_roles and join with profiles table
            const { data, error } = await supabase
                .from('user_roles')
                .select('id, user_id, status, created_at, profiles(full_name, avatar_url)')
                .eq('role_id', role.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            if (data) {
                setRequests(data)
            } else if (error) {
                console.error("Error fetching requests:", error)
            }
            setLoading(false)
        }

        fetchRequests()

        // Subscribe to changes on user_roles for realtime updates
        const channel = supabase.channel(`role_requests_${role.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_roles',
                filter: `role_id=eq.${role.id}`
            }, () => {
                fetchRequests()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [isOpen, role])

    const handleAccept = async (req) => {
        setProcessingId(req.id)

        // Update user_role status to approved
        const { error } = await supabase
            .from('user_roles')
            .update({ status: 'approved' })
            .eq('id', req.id)

        if (error) {
            console.error("Error approving request:", error)
            setProcessingId(null)
            return
        }

        // Send notification to the employee
        const { error: notifError } = await supabase.from('notifications').insert({
            user_id: req.user_id,
            type: 'system',
            title: 'Role Request Approved ✅',
            message: `Your request to join "${role.name}" has been approved! You can now view shifts and submit availability.`,
            reference_id: req.id
        })

        if (notifError) {
            console.error("Error sending approval notification:", notifError)
        }

        // Optimistic UI update
        setRequests(prev => prev.filter(r => r.id !== req.id))
        setProcessingId(null)
    }

    const handleReject = async (req) => {
        setProcessingId(req.id)

        // Delete the user_role entry
        const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('id', req.id)

        if (error) {
            console.error("Error rejecting request:", error)
            setProcessingId(null)
            return
        }

        // Send rejection notification to the employee
        const { error: notifError } = await supabase.from('notifications').insert({
            user_id: req.user_id,
            type: 'system',
            title: 'Role Request Rejected ❌',
            message: `Your request to join "${role.name}" has been rejected by the manager.`,
            reference_id: req.id
        })

        if (notifError) {
            console.error("Error sending rejection notification:", notifError)
        }

        // Optimistic UI update
        setRequests(prev => prev.filter(r => r.id !== req.id))
        setProcessingId(null)
    }

    if (!isOpen || !role) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl bg-white dark:bg-surface-dark rounded-[16px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">person_add</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Role Requests</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{role.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                            <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">inbox</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">No pending requests</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">New requests will appear here.</p>
                        </div>
                    ) : (
                        requests.map(req => {
                            const isProcessing = processingId === req.id;
                            const timeAgo = getTimeAgo(req.created_at);
                            const employeeName = req.profiles?.full_name || 'Employee';
                            const employeeAvatar = req.profiles?.avatar_url;

                            return (
                                <div key={req.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-blue-200 dark:hover:border-blue-800/50 transition-all group">
                                    <div className="flex items-center gap-4">
                                        {employeeAvatar ? (
                                            <img src={employeeAvatar} alt={employeeName} className="w-12 h-12 rounded-full object-cover shadow-sm bg-slate-100" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                <span className="material-symbols-outlined">person</span>
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                                                {employeeName}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                                ID: {req.user_id?.substring(0, 8)}...
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">{timeAgo}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleReject(req)}
                                            disabled={isProcessing}
                                            className="px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800 transition-all disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleAccept(req)}
                                            disabled={isProcessing}
                                            className="px-4 py-2 text-sm font-bold text-neutral-900 bg-primary rounded-lg hover:bg-primary-dark hover:text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {isProcessing ? (
                                                <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-base">check</span>
                                            )}
                                            Accept
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                    <span className="text-xs text-slate-400 font-medium">{requests.length} Pending {requests.length === 1 ? 'Request' : 'Requests'}</span>
                    <button onClick={onClose} className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

function getTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}
