import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export function DeleteShiftModal({ isOpen, onClose, shiftData, onSuccess, onUndoableAction }) {
    const [loading, setLoading] = useState(false)
    const [deleteAll, setDeleteAll] = useState(false)

    if (!isOpen || !shiftData) return null

    const handleDelete = async () => {
        setLoading(true)

        // If deleteAll is checked and shift has a group_id, delete all shifts in that group
        let query;
        let deletedShiftsData = [];

        if (deleteAll && shiftData.group_id) {
            // Fetch first to save for undo
            const { data } = await supabase.from('shifts').select('*').eq('group_id', shiftData.group_id);
            deletedShiftsData = data || [];
            query = supabase.from('shifts').delete().eq('group_id', shiftData.group_id);
        } else {
            deletedShiftsData = [shiftData];
            query = supabase.from('shifts').delete().eq('id', shiftData.id);
        }

        const { error } = await query;

        setLoading(false)
        if (!error) {
            if (onUndoableAction && deletedShiftsData.length > 0) {
                onUndoableAction({ type: 'CLEAR', data: deletedShiftsData }); // CLEAR type treats data as records to restore
            }
            if (onSuccess) onSuccess()
            onClose()
            setDeleteAll(false)
        } else {
            console.error("Error deleting shift:", error)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-danger-bg dark:bg-red-900/30 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-danger text-2xl">delete</span>
                    </div>
                    <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">Delete Shift?</h3>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-6 max-w-[280px]">
                        Are you sure you want to delete the <span className="font-bold text-text-primary-light dark:text-text-primary-dark">{shiftData.name || "Dinner Rush"}</span> shift? This action cannot be undone.
                    </p>

                    {shiftData.group_id && (
                        <div className="w-full bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-100 dark:border-white/5 mb-6 text-left">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="mt-1 relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={deleteAll}
                                        onChange={(e) => setDeleteAll(e.target.checked)}
                                    />
                                    <div className={`w-10 h-5 rounded-full transition-all duration-300 ${deleteAll ? 'bg-danger' : 'bg-gray-200 dark:bg-white/10'}`}></div>
                                    <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full shadow-md transition-all duration-300 ${deleteAll ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark group-hover:text-danger transition-colors">Delete all copies</span>
                                    <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">Delete all similar shifts that were copied for this week</p>
                                </div>
                            </label>
                        </div>
                    )}

                    <div className="flex gap-3 w-full border-t border-gray-100 dark:border-white/10 pt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={loading}
                            className="flex-1 py-3 px-4 bg-danger hover:bg-red-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                                    <span>Deleting...</span>
                                </span>
                            ) : "Delete"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
