import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatLocalDate } from '../utils/timeFormat'

export function CreateShiftModal({ isOpen, onClose, roleId, workspaceId, weekDays = [], onSuccess, onUndoableAction }) {
    const [shiftName, setShiftName] = useState('')
    const [date, setDate] = useState(formatLocalDate()) // Default to today 'YYYY-MM-DD'
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [requiredStaff, setRequiredStaff] = useState(3)
    const [copyToEntireWeek, setCopyToEntireWeek] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState(null)

    if (!isOpen) return null

    const handleCreateShift = async () => {
        if (!roleId) {
            setErrorMessage("No role selected")
            return
        }

        if (!shiftName || !startTime || !endTime || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
            setErrorMessage("Please fill in all fields correctly (time format HH:mm)")
            return
        }

        setLoading(true)
        setErrorMessage(null)

        // Combine date and time helper
        const getISOString = (d, t) => {
            // Validate HH:mm regex roughly before creating date
            const timeVal = /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t.length === 5 ? `${t}:00` : '00:00:00';
            return new Date(`${d}T${timeVal}`).toISOString();
        };

        try {
            let createdShiftIds = [];

            if (copyToEntireWeek) {
                // Use weekDays from parent to create shifts for the entire selected week
                const groupId = crypto.randomUUID();
                const weekShifts = weekDays.map(day => ({
                    role_id: roleId,
                    workspace_id: workspaceId,
                    group_id: groupId,
                    title: shiftName,
                    name: shiftName,
                    date: day.fullDate,
                    start_time: getISOString(day.fullDate, startTime),
                    end_time: getISOString(day.fullDate, endTime),
                    required_staff: requiredStaff
                }));

                const { data, error } = await supabase
                    .from('shifts')
                    .insert(weekShifts)
                    .select('id');

                if (error) throw error;
                if (data) createdShiftIds = data.map(d => d.id);
            } else {
                const { data, error } = await supabase
                    .from('shifts')
                    .insert({
                        role_id: roleId,
                        workspace_id: workspaceId,
                        title: shiftName,
                        name: shiftName,
                        date: date,
                        start_time: getISOString(date, startTime),
                        end_time: getISOString(date, endTime),
                        required_staff: requiredStaff
                    })
                    .select('id');

                if (error) throw error;
                if (data) createdShiftIds = data.map(d => d.id);
            }

            if (onUndoableAction && createdShiftIds.length > 0) {
                // COPY type treats data as an array of IDs to delete when undoing
                onUndoableAction({ type: 'COPY', data: createdShiftIds });
            }

            setLoading(false);
            if (onSuccess) onSuccess();
            onClose();
            // Reset form
            setShiftName('');
            setStartTime('');
            setEndTime('');
            setRequiredStaff(3);
            setCopyToEntireWeek(false);
        } catch (error) {
            setLoading(false);
            setErrorMessage(error.message || "Failed to create shift. Please check your permissions.");
            console.error("Error creating shift:", error);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative bg-surface-light dark:bg-surface-dark rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-primary/20">
                <div className="px-6 py-5 border-b border-primary/10 flex justify-between items-center bg-surface-light dark:bg-surface-dark">
                    <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Create New Shift</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-5 bg-surface-light dark:bg-surface-dark">
                    {errorMessage && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-4 border border-red-200 dark:border-red-900/50 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                            <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-1.5 uppercase tracking-wider text-[11px]">Shift Name</label>
                        <input
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                            type="text"
                            placeholder="e.g. Dinner Rush"
                            value={shiftName}
                            onChange={(e) => setShiftName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-1.5 uppercase tracking-wider text-[11px]">Date</label>
                        <div className="relative">
                            <input
                                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                            <span className="material-symbols-outlined absolute left-3.5 top-3 text-text-secondary-light dark:text-text-secondary-dark text-[20px]">calendar_today</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-1.5 uppercase tracking-wider text-[11px]">Start Time</label>
                            <div className="relative">
                                <input
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                                    type="text"
                                    maxLength="5"
                                    placeholder="e.g. 07:00"
                                    value={startTime}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/[^\d:]/g, '');
                                        if (val.length === 2 && !val.includes(':')) val += ':';
                                        setStartTime(val);
                                    }}
                                />
                                <span className="material-symbols-outlined absolute left-3.5 top-3 text-text-secondary-light dark:text-text-secondary-dark text-[20px]">schedule</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-1.5 uppercase tracking-wider text-[11px]">End Time</label>
                            <div className="relative">
                                <input
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                                    type="text"
                                    maxLength="5"
                                    placeholder="e.g. 15:30"
                                    value={endTime}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/[^\d:]/g, '');
                                        if (val.length === 2 && !val.includes(':')) val += ':';
                                        setEndTime(val);
                                    }}
                                />
                                <span className="material-symbols-outlined absolute left-3.5 top-3 text-text-secondary-light dark:text-text-secondary-dark text-[20px]">schedule</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/10">
                        <div>
                            <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider text-[11px] mb-0.5">Required Staff</label>
                            <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark font-medium">Number of people needed</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setRequiredStaff(Math.max(1, requiredStaff - 1))}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-white/5 shadow-sm border border-gray-100 dark:border-white/5 text-text-secondary-light hover:text-text-primary-light transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[18px]">remove</span>
                            </button>
                            <span className="text-lg font-bold min-w-[20px] text-center">{requiredStaff}</span>
                            <button
                                onClick={() => setRequiredStaff(requiredStaff + 1)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-white/5 shadow-sm border border-gray-100 dark:border-white/5 text-text-secondary-light hover:text-text-primary-light transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                            </button>
                        </div>
                    </div>

                    <div className="pt-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={copyToEntireWeek}
                                    onChange={(e) => setCopyToEntireWeek(e.target.checked)}
                                />
                                <div className={`w-12 h-6 rounded-full transition-all duration-300 ${copyToEntireWeek ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white dark:bg-gray-200 w-4 h-4 rounded-full shadow-md transition-all duration-300 ${copyToEntireWeek ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                            <div>
                                <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors">Copy to entire week</span>
                                <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">Repeat this shift from Monday to Sunday</p>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="px-6 py-6 bg-gray-50/50 dark:bg-black/20 border-t border-primary/10 flex gap-3 justify-end items-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-text-secondary-light hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateShift}
                        disabled={loading}
                        className="px-8 py-2.5 rounded-xl font-bold text-sm bg-primary text-dark-navy hover:bg-primary-hover shadow-lg shadow-primary/20 hover:shadow-primary/30 relative overflow-hidden transition-all transform active:scale-95 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed min-w-[140px]"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <span className="animate-spin rounded-full h-4 w-4 border-2 border-dark-navy border-t-transparent"></span>
                                <span>Processing...</span>
                            </div>
                        ) : (
                            'Create Shift'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
