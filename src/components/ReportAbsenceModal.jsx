import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export function ReportAbsenceModal({ isOpen, onClose, currentShift, workspaceId }) {
    const { user } = useAuth();
    const [absenceReason, setAbsenceReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user || !currentShift || !absenceReason.trim()) return;
        setSubmitting(true);

        try {
            // 1. Create shift_request
            const { data: request, error: reqErr } = await supabase
                .from('shift_requests')
                .insert({
                    type: 'absence',
                    shift_id: currentShift.id,
                    requester_id: user.id,
                    reason: absenceReason,
                    status: 'pending_manager',
                })
                .select()
                .single();

            if (reqErr) throw reqErr;

            // 1b. Remove the requester's availability for this shift immediately
            // so they no longer appear in "Available Staff" for this shift
            const { data: shift } = await supabase.from('shifts')
                .select('role_id, date, start_time, end_time')
                .eq('id', currentShift.id).single();

            if (shift) {
                const { formatTime: ft } = await import('../utils/timeFormat');
                const normStart = ft(shift.start_time);
                const normEnd = ft(shift.end_time);

                // Fetch matching availabilities and delete by ID (avoids time format mismatch)
                const { data: myAvails } = await supabase.from('availabilities')
                    .select('id, start_time, end_time')
                    .eq('user_id', user.id)
                    .eq('date', shift.date)
                    .eq('role_id', shift.role_id);

                const toDelete = (myAvails || [])
                    .filter(a => ft(a.start_time) === normStart && ft(a.end_time) === normEnd)
                    .map(a => a.id);

                if (toDelete.length > 0) {
                    await supabase.from('availabilities').delete().in('id', toDelete);
                }
            }

            // 2. Find managers of the workspace
            const { data: managers, error: mgrErr } = await supabase
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', workspaceId)
                .in('role', ['manager', 'MANAGER']);



            // 3. Notify all managers
            const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
            const requesterName = profileData?.full_name || 'An employee';
            const managerNotifs = (managers || []).map(m => ({
                user_id: m.user_id,
                type: 'absence_request',
                title: `Absence Request — ${requesterName}`,
                message: `${requesterName} has reported an absence for shift "${currentShift.name}" (${currentShift.time}). \n\nReason: "${absenceReason}"`,
                reference_id: request?.id || null,
                is_read: false,
            }));



            if (managerNotifs.length > 0) {
                const { error: insertErr } = await supabase.from('notifications').insert(managerNotifs);
                if (insertErr) console.error("Error inserting absence notifs:", insertErr);
            }

            // Notify the requester that their request was sent
            await supabase.from('notifications').insert({
                user_id: user.id,
                type: 'system',
                title: 'Absence Request Sent ✉️',
                message: `Your absence request for shift "${currentShift.name}" (${currentShift.originalDateStr}, ${currentShift.time}) has been sent to managers for approval.`,
                reference_id: request?.id || null,
                is_read: false,
            });

            setSubmitSuccess(true);
            setTimeout(() => {
                onClose();
                setSubmitSuccess(false);
                setAbsenceReason('');
            }, 1800);
        } catch (err) {
            console.error('Error submitting absence report:', err);
        }
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#152e26] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-[#1e3a32] flex items-center justify-between bg-red-50/50 dark:bg-red-900/10">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-xl text-red-600 dark:text-red-400">
                            <span className="material-symbols-outlined text-[24px]">event_busy</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#0c1d17] dark:text-white">Report Absence</h2>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">Your manager will be notified and must approve.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e3a32] transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
                    {/* Shift Details */}
                    {currentShift && (
                        <div className="bg-gray-50 dark:bg-[#1a362e]/50 rounded-xl p-4 border border-gray-100 dark:border-[#1e3a32]/50 flex items-center gap-4">
                            <div className="bg-white dark:bg-[#152e26] border border-gray-200 dark:border-[#2a4e43] rounded-lg p-3 text-center min-w-[70px]">
                                <span className="block text-xs font-bold text-gray-500 uppercase">{currentShift.day}</span>
                                <span className="block text-2xl font-bold text-[#0c1d17] dark:text-white">{currentShift.date}</span>
                            </div>
                            <div>
                                <p className="text-lg font-bold text-[#0c1d17] dark:text-white">{currentShift.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1">
                                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                                    {currentShift.time}
                                    <span className="w-1 h-1 bg-gray-300 rounded-full mx-1"></span>
                                    {currentShift.duration}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-semibold text-[#0c1d17] dark:text-gray-300 mb-2">
                            Reason for Absence <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={absenceReason}
                            onChange={e => setAbsenceReason(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 dark:border-[#2a4e43] bg-white dark:bg-[#0f231c] px-4 py-3 text-sm text-[#0c1d17] dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400 min-h-[120px] resize-y placeholder-gray-400"
                            placeholder="Please explain why you cannot attend this shift (e.g., medical emergency, illness)..."
                            required
                        />
                    </div>

                    {/* Info */}
                    <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 border border-amber-100 dark:border-amber-900/30">
                        <span className="material-symbols-outlined text-[18px] text-amber-600 mt-0.5">info</span>
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                            After your manager approves, available colleagues will be notified to cover your shift.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-[#1e3a32] flex justify-end gap-3 bg-gray-50/50 dark:bg-[#1a362e]/50">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1e3a32] transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!absenceReason.trim() || submitting || submitSuccess}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white shadow-sm hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {submitSuccess ? (
                            <><span className="material-symbols-outlined text-[18px]">check_circle</span> Sent!</>
                        ) : submitting ? (
                            <><span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span> Sending...</>
                        ) : (
                            <><span className="material-symbols-outlined text-[18px]">event_busy</span> Submit Report</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
