import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { formatTime, getDurationHours } from '../utils/timeFormat'

export function SwapSelectionModal({ isOpen, onClose, notification, onAcceptShift }) {
    const [shiftOptions, setShiftOptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedRequestId, setSelectedRequestId] = useState(null)
    const [confirming, setConfirming] = useState(false)

    useEffect(() => {
        if (!isOpen || !notification?.reference_id) return

        const fetchShiftOptions = async () => {
            setLoading(true)
            setSelectedRequestId(null)

            // Get the referenced shift_request to find the requester and shift
            const { data: baseReq } = await supabase
                .from('shift_requests')
                .select('shift_id, requester_id')
                .eq('id', notification.reference_id)
                .single()

            if (!baseReq) {
                setShiftOptions([])
                setLoading(false)
                return
            }

            // Find ALL related swap requests (same requester, same shift they want to swap away)
            const { data: relatedRequests } = await supabase
                .from('shift_requests')
                .select('id, offered_shift_id, status')
                .eq('shift_id', baseReq.shift_id)
                .eq('requester_id', baseReq.requester_id)
                .eq('type', 'swap')

            if (!relatedRequests || relatedRequests.length === 0) {
                setShiftOptions([])
                setLoading(false)
                return
            }

            // Filter to only pending (not completed) requests
            const pendingRequests = relatedRequests.filter(r => r.status !== 'completed')
            const offeredShiftIds = pendingRequests.map(r => r.offered_shift_id).filter(Boolean)

            if (offeredShiftIds.length === 0) {
                setShiftOptions([])
                setLoading(false)
                return
            }

            // Fetch shift details for each offered shift
            const { data: shifts } = await supabase
                .from('shifts')
                .select('id, name, date, start_time, end_time')
                .in('id', offeredShiftIds)
                .order('date')
                .order('start_time')

            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            const options = (shifts || []).map(shift => {
                const req = pendingRequests.find(r => r.offered_shift_id === shift.id)
                const dateObj = new Date(shift.date + 'T12:00:00')
                return {
                    requestId: req?.id,
                    shiftId: shift.id,
                    name: shift.name,
                    date: shift.date,
                    dayName: days[dateObj.getDay()],
                    dayNum: dateObj.getDate(),
                    startTime: formatTime(shift.start_time),
                    endTime: formatTime(shift.end_time),
                    duration: getDurationHours(shift.start_time, shift.end_time),
                    isCompleted: req?.status === 'completed'
                }
            }).filter(o => !o.isCompleted)

            setShiftOptions(options)
            setLoading(false)
        }

        fetchShiftOptions()
    }, [isOpen, notification])

    const handleConfirm = async () => {
        if (!selectedRequestId) return
        setConfirming(true)

        // Find the notification-like object with the correct reference_id for the selected shift
        const fakeNotif = { ...notification, reference_id: selectedRequestId }
        await onAcceptShift(fakeNotif)

        setConfirming(false)
        onClose()
    }

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white dark:bg-neutral-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Choose a Shift to Swap</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Select which of your shifts you'd like to exchange</p>
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Shift Options */}
                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="animate-spin material-symbols-outlined text-primary text-3xl">progress_activity</span>
                        </div>
                    ) : shiftOptions.length === 0 ? (
                        <div className="text-center py-8">
                            <span className="material-symbols-outlined text-4xl text-neutral-300 dark:text-neutral-600 mb-2 block">event_busy</span>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">No available shifts to swap</p>
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">This swap may have already been completed.</p>
                        </div>
                    ) : (
                        shiftOptions.map(option => (
                            <button
                                key={option.requestId}
                                onClick={() => setSelectedRequestId(option.requestId)}
                                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${selectedRequestId === option.requestId
                                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-400'
                                        : 'border-neutral-200 dark:border-neutral-700 hover:border-orange-300 dark:hover:border-orange-700 bg-white dark:bg-neutral-900/30'
                                    }`}
                            >
                                {/* Date block */}
                                <div className={`flex flex-col items-center justify-center min-w-[52px] py-2 px-3 rounded-lg ${selectedRequestId === option.requestId
                                        ? 'bg-orange-400 text-white'
                                        : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'
                                    }`}>
                                    <span className="text-[10px] font-bold uppercase">{option.dayName}</span>
                                    <span className="text-xl font-bold leading-tight">{option.dayNum}</span>
                                </div>

                                {/* Shift info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{option.name}</p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mt-1">
                                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                                        {option.startTime} - {option.endTime}
                                    </p>
                                    <span className="inline-block mt-1.5 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded">{option.duration}h</span>
                                </div>

                                {/* Selection indicator */}
                                <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedRequestId === option.requestId
                                        ? 'border-orange-400 bg-orange-400'
                                        : 'border-neutral-300 dark:border-neutral-600'
                                    }`}>
                                    {selectedRequestId === option.requestId && (
                                        <span className="material-symbols-outlined text-white text-sm">check</span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Footer */}
                {!loading && shiftOptions.length > 0 && (
                    <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-700/50 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedRequestId || confirming}
                            className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                        >
                            {confirming ? (
                                <><span className="animate-spin material-symbols-outlined text-sm">progress_activity</span> Confirming...</>
                            ) : (
                                <><span className="material-symbols-outlined text-sm">check</span> Confirm Swap</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
