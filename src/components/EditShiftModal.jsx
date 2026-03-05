import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toISOStringWithOffset } from '../utils/timeFormat'

export function EditShiftModal({ isOpen, onClose, shiftData, onSuccess, onUndoableAction }) {
    const [shiftName, setShiftName] = useState('')
    const [date, setDate] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [requiredStaff, setRequiredStaff] = useState(1)
    const [applyToAll, setApplyToAll] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState(null)

    useEffect(() => {
        if (isOpen && shiftData) {
            setErrorMessage(null)
            setShiftName(shiftData.name || '')
            setDate(shiftData.date || '')
            setStartTime(shiftData.startTime || '')
            setEndTime(shiftData.endTime || '')
            setRequiredStaff(shiftData.requiredStaff || 1)
            setApplyToAll(false)
        }
    }, [isOpen, shiftData])

    if (!isOpen || !shiftData) return null

    const handleSaveChanges = async () => {
        setLoading(true)
        setErrorMessage(null)

        if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
            setErrorMessage("Please enter correct time format (HH:mm)")
            setLoading(false)
            return
        }

        const formattedStartTime = startTime.length === 5 ? `${startTime}:00` : startTime;
        const formattedEndTime = endTime.length === 5 ? `${endTime}:00` : endTime;

        try {
            let originalShiftsData = [];

            if (applyToAll && shiftData.group_id) {
                // Fetch all shifts in the same group to save for undo
                const { data: groupShifts, error: fetchError } = await supabase
                    .from('shifts')
                    .select('*')
                    .eq('group_id', shiftData.group_id);

                if (fetchError) throw fetchError;
                originalShiftsData = groupShifts || [];

                // Update each shift with correct date-specific timestamps
                const updates = groupShifts.map(gs => {
                    const startDateTime = toISOStringWithOffset(gs.date, startTime);
                    const endDateTime = toISOStringWithOffset(gs.date, endTime);
                    return supabase
                        .from('shifts')
                        .update({
                            title: shiftName,
                            name: shiftName,
                            start_time: startDateTime,
                            end_time: endDateTime,
                            required_staff: requiredStaff
                        })
                        .eq('id', gs.id);
                });

                const results = await Promise.all(updates);
                const firstError = results.find(r => r.error);
                if (firstError?.error) throw firstError.error;
            } else {
                // Fetch single original shift state for undo
                const { data: singleShift } = await supabase.from('shifts').select('*').eq('id', shiftData.id).single();
                if (singleShift) originalShiftsData = [singleShift];

                // Single shift update
                const startDateTime = toISOStringWithOffset(date, startTime);
                const endDateTime = toISOStringWithOffset(date, endTime);

                const { error } = await supabase
                    .from('shifts')
                    .update({
                        title: shiftName,
                        name: shiftName,
                        date: date,
                        start_time: startDateTime,
                        end_time: endDateTime,
                        required_staff: requiredStaff
                    })
                    .eq('id', shiftData.id)

                if (error) throw error;
            }

            setLoading(false)
            if (onUndoableAction && originalShiftsData.length > 0) {
                onUndoableAction({ type: 'EDIT', data: originalShiftsData });
            }
            if (onSuccess) onSuccess()
            onClose()
        } catch (error) {
            setLoading(false)
            setErrorMessage(error.message || "Failed to update shift.");
            console.error("Error updating shift:", error)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative bg-surface-light dark:bg-surface-dark rounded-[16px] shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-primary/20 flex justify-between items-center bg-background-light/30 dark:bg-background-dark/30">
                    <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Edit Shift</h3>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-white transition-colors disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-6 space-y-5">
                    {errorMessage && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-4 border border-red-200 dark:border-red-900/50 flex items-start gap-2">
                            <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                            <span>{errorMessage}</span>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-1.5">Shift Name</label>
                        <input
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-gray-400"
                            type="text"
                            value={shiftName}
                            onChange={(e) => setShiftName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-1.5">Date</label>
                        <div className="relative">
                            <input
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                disabled={applyToAll}
                            />
                            <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-secondary-light text-[20px]">calendar_today</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-1.5">Start Time</label>
                            <div className="relative">
                                <input
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    type="text"
                                    maxLength="5"
                                    placeholder="17:00"
                                    value={startTime}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/[^\d:]/g, '');
                                        if (val.length === 2 && !val.includes(':')) val += ':';
                                        setStartTime(val);
                                    }}
                                />
                                <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-secondary-light text-[20px]">schedule</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-1.5">End Time</label>
                            <div className="relative">
                                <input
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    type="text"
                                    maxLength="5"
                                    placeholder="22:00"
                                    value={endTime}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/[^\d:]/g, '');
                                        if (val.length === 2 && !val.includes(':')) val += ':';
                                        setEndTime(val);
                                    }}
                                />
                                <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-secondary-light text-[20px]">schedule</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-1.5">Required Staff</label>
                        <div className="relative flex items-center">
                            <button
                                onClick={() => setRequiredStaff(Math.max(1, requiredStaff - 1))}
                                className="absolute left-1 p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-md text-text-secondary-light transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">remove</span>
                            </button>
                            <input
                                className="w-full text-center px-10 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-medium"
                                type="number"
                                value={requiredStaff}
                                onChange={(e) => setRequiredStaff(parseInt(e.target.value) || 1)}
                            />
                            <button
                                onClick={() => setRequiredStaff(requiredStaff + 1)}
                                className="absolute right-1 p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-md text-text-secondary-light transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">add</span>
                            </button>
                        </div>
                    </div>

                    {/* Apply to all copies toggle - only show if shift has a group_id */}
                    {shiftData.group_id && (
                        <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                            <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setApplyToAll(!applyToAll)}>
                                <div className={`relative w-10 h-5 rounded-full transition-all duration-300 ${applyToAll ? 'bg-primary' : 'bg-gray-300 dark:bg-white/20'}`}>
                                    <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full shadow-md transition-all duration-300 ${applyToAll ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors">Apply to all copies</span>
                                    <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">Update name, times, and staff for all copies in this week</p>
                                </div>
                            </label>
                        </div>
                    )}
                </div>
                <div className="px-6 py-5 bg-gray-50/50 dark:bg-black/20 border-t border-primary/20 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm text-text-secondary-light hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveChanges}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm bg-mint-green text-dark-navy hover:bg-primary-hover shadow-sm hover:shadow relative overflow-hidden transition-all transform active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                        {loading && (
                            <span className="absolute inset-0 flex items-center justify-center bg-mint-green/80 z-10">
                                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-dark-navy"></span>
                            </span>
                        )}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    )
}
