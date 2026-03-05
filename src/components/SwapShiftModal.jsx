import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { getDurationHours, formatTime, formatLocalDate } from '../utils/timeFormat';

export function SwapShiftModal({ isOpen, onClose, currentShift, workspaceId }) {
    const { user } = useAuth();
    const [swapReason, setSwapReason] = useState('');
    const [selectedShiftIds, setSelectedShiftIds] = useState([]);
    const [weeklyShifts, setWeeklyShifts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    useEffect(() => {
        if (!isOpen || !currentShift || !user) return;

        const fetchShifts = async () => {
            setLoading(true);

            // Use the originalDateStr directly (e.g. "2026-02-28") — avoid new Date() timezone issues
            const rawDateStr = currentShift.originalDateStr;
            if (!rawDateStr) { console.error('SwapShiftModal: no originalDateStr on currentShift'); setLoading(false); return; }

            // Calculate week range from the raw date
            const shiftDate = new Date(rawDateStr + 'T12:00:00'); // noon to avoid timezone shifts
            const dayOfWeek = shiftDate.getDay();
            const diffToMonday = shiftDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const monday = new Date(shiftDate); monday.setDate(diffToMonday);

            const startDateStr = formatLocalDate(monday);
            const endOfWeek = new Date(monday); endOfWeek.setDate(monday.getDate() + 6);
            const endDateStr = formatLocalDate(endOfWeek);
            const todayStr = formatLocalDate(new Date());


            // 1. Fetch all shifts for the week in this workspace
            const { data: allShiftsData } = await supabase
                .from('shifts')
                .select('*, roles(name, min_hours_per_week, max_hours_per_week)')
                .eq('workspace_id', workspaceId)
                .gte('date', startDateStr)
                .lte('date', endDateStr)
                .order('date')
                .order('start_time');

            if (!allShiftsData || allShiftsData.length === 0) {
                setWeeklyShifts([]);
                setLoading(false);
                return;
            }

            const shiftIds = allShiftsData.map(s => s.id);

            // 2. Fetch assignments scoped to this week's shifts only
            const { data: allAssignmentsData } = await supabase
                .from('shift_assignments')
                .select('shift_id, user_id, profiles(full_name)')
                .in('shift_id', shiftIds);

            // 3. Fetch availabilities for Shift X's date (the date A wants to swap away from)
            const { data: availabilitiesData } = await supabase
                .from('availabilities')
                .select('user_id')
                .eq('date', rawDateStr);

            console.log('[SwapModal] Shifts found:', allShiftsData.length, '| Assignments:', allAssignmentsData?.length, '| Avails for', rawDateStr, ':', availabilitiesData?.length);

            const shiftX = currentShift;
            const availableUserIdsForX = new Set(availabilitiesData?.map(a => a.user_id) || []);
            const usersAssignedToX = new Set((allAssignmentsData || []).filter(a => a.shift_id === shiftX.id).map(a => a.user_id));
            const shiftIdsAssignedToA = new Set((allAssignmentsData || []).filter(a => a.user_id === user.id).map(a => a.shift_id));



            // Calculate users' weekly hours (needed for min/max hours check on BOTH sides)
            const userWeeklyHours = {};
            (allAssignmentsData || []).forEach(a => {
                const shift = allShiftsData.find(s => s.id === a.shift_id);
                if (shift) {
                    const duration = getDurationHours(shift.start_time, shift.end_time);
                    userWeeklyHours[a.user_id] = (userWeeklyHours[a.user_id] || 0) + duration;
                }
            });

            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const formatted = [];

            allShiftsData.forEach(shiftY => {
                if (shiftY.id === shiftX.id) return; // Cannot swap with own shift
                if (shiftY.date < todayStr) return; // Must be today or future
                if (shiftIdsAssignedToA.has(shiftY.id)) return; // A is already working this shift

                // Find C candidates: people assigned to shiftY who are available for shiftX's date
                const assignedUsersY = (allAssignmentsData || []).filter(a => a.shift_id === shiftY.id);
                const validCandidates = assignedUsersY.filter(cAssignment => {
                    const cId = cAssignment.user_id;
                    if (cId === user.id) return false; // Not yourself
                    if (!availableUserIdsForX.has(cId)) return false; // Must be available on X's date
                    if (usersAssignedToX.has(cId)) return false; // Not already assigned to X

                    // Hours check for BOTH sides
                    const dbShiftX = allShiftsData.find(s => s.id === shiftX.id);
                    if (!dbShiftX) return false;
                    const durX = getDurationHours(dbShiftX.start_time, dbShiftX.end_time);
                    const durY = getDurationHours(shiftY.start_time, shiftY.end_time);
                    const minH = dbShiftX.roles?.min_hours_per_week || 0;
                    const maxH = dbShiftX.roles?.max_hours_per_week || 999;

                    // C loses shiftY, gains shiftX
                    const newHoursC = (userWeeklyHours[cId] || 0) - durY + durX;
                    if (newHoursC < minH || newHoursC > maxH) return false;

                    // A loses shiftX, gains shiftY
                    const newHoursA = (userWeeklyHours[user.id] || 0) - durX + durY;
                    if (newHoursA < minH || newHoursA > maxH) return false;

                    return true;
                });

                if (validCandidates.length > 0) {
                    const dateObj = new Date(shiftY.date + 'T12:00:00');
                    formatted.push({
                        id: shiftY.id,
                        day: days[dateObj.getDay()],
                        date: dateObj.getDate(),
                        rawDate: shiftY.date,
                        name: shiftY.name,
                        startTime: formatTime(shiftY.start_time),
                        endTime: formatTime(shiftY.end_time),
                        duration: `${getDurationHours(shiftY.start_time, shiftY.end_time)}h`,
                        isAssigned: false,
                        candidates: validCandidates.map(c => c.profiles?.full_name).filter(Boolean),
                        candidateIds: validCandidates.map(c => c.user_id)
                    });
                }
            });

            console.log('[SwapModal] Eligible shifts for grid:', formatted.length, formatted.map(f => `${f.name} ${f.rawDate}`));
            setWeeklyShifts(formatted);
            setLoading(false);
        };

        fetchShifts();
    }, [isOpen, currentShift, user, workspaceId]);

    if (!isOpen) return null;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const groupedShifts = days.reduce((acc, day) => {
        acc[day] = weeklyShifts.filter(s => s.day === day);
        return acc;
    }, {});

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user || !currentShift || selectedShiftIds.length === 0) return;
        setSubmitting(true);

        try {
            // 1. Create shift_request records (one per offered shift) — directly pending_staff
            const insertRows = selectedShiftIds.map(offeredShiftId => ({
                type: 'swap',
                shift_id: currentShift.id,
                offered_shift_id: offeredShiftId,
                requester_id: user.id,
                reason: swapReason,
                status: 'pending_staff',
                approved_by_manager: true
            }));

            const { data: requests, error: reqErr } = await supabase
                .from('shift_requests')
                .insert(insertRows)
                .select();

            if (reqErr) throw reqErr;

            // 1b. Remove the requester's availability for currentShift immediately
            // so they no longer appear in "Available Staff" for the shift they want to swap away
            const { data: shiftInfo } = await supabase.from('shifts')
                .select('role_id, date, start_time, end_time')
                .eq('id', currentShift.id).single();

            if (shiftInfo) {
                const normStart = formatTime(shiftInfo.start_time);
                const normEnd = formatTime(shiftInfo.end_time);

                const { data: myAvails } = await supabase.from('availabilities')
                    .select('id, start_time, end_time')
                    .eq('user_id', user.id)
                    .eq('date', shiftInfo.date)
                    .eq('role_id', shiftInfo.role_id);

                const toDelete = (myAvails || [])
                    .filter(a => formatTime(a.start_time) === normStart && formatTime(a.end_time) === normEnd)
                    .map(a => a.id);

                if (toDelete.length > 0) {
                    await supabase.from('availabilities').delete().in('id', toDelete);
                }
            }

            // 2. Get requester's name
            const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
            const requesterName = profileData?.full_name || 'An employee';

            // 4. Build ONE combined notification per candidate listing all offered shifts
            const candidateShiftMap = new Map();
            selectedShiftIds.forEach(shiftId => {
                const shiftInGrid = weeklyShifts.find(s => s.id === shiftId);
                if (!shiftInGrid?.candidateIds) return;
                shiftInGrid.candidateIds.forEach(uid => {
                    if (!candidateShiftMap.has(uid)) candidateShiftMap.set(uid, []);
                    candidateShiftMap.get(uid).push({
                        name: shiftInGrid.name,
                        date: shiftInGrid.rawDate,
                        time: `${shiftInGrid.startTime} - ${shiftInGrid.endTime}`,
                        requestId: requests?.find(r => r.offered_shift_id === shiftId)?.id || requests?.[0]?.id
                    });
                });
            });

            const staffNotifs = [];
            candidateShiftMap.forEach((shifts, uid) => {
                const shiftDetails = shifts.map(s => `"${s.name}" (${s.date}, ${s.time})`).join(', ');
                staffNotifs.push({
                    user_id: uid,
                    type: 'swap_request',
                    title: `Swap Opportunity — ${requesterName}`,
                    message: `${requesterName} wants to swap their shift "${currentShift.name}" (${currentShift.originalDateStr}, ${currentShift.time}) for your shift ${shiftDetails}.`,
                    reference_id: shifts[0].requestId,
                    is_read: false,
                });
            });

            // 5. Info-only notification to manager(s) (no action buttons)
            const { data: managers } = await supabase
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', workspaceId)
                .in('role', ['manager', 'MANAGER']);

            const managerInfoNotifs = (managers || []).map(m => ({
                user_id: m.user_id,
                type: 'system',
                title: `Swap Request — ${requesterName}`,
                message: `${requesterName} has requested to swap their shift "${currentShift.name}" (${currentShift.originalDateStr}, ${currentShift.time}). \n\nReason: "${swapReason}"\n\nWaiting for an eligible colleague to accept.`,
                reference_id: requests?.[0]?.id || null,
                is_read: false,
            }));

            const allNotifs = [...staffNotifs, ...managerInfoNotifs];
            if (allNotifs.length > 0) {
                await supabase.from('notifications').insert(allNotifs);
            }

            // Notify the requester that their swap request was sent
            await supabase.from('notifications').insert({
                user_id: user.id,
                type: 'system',
                title: 'Swap Request Sent ✉️',
                message: `Your swap request for shift "${currentShift.name}" (${currentShift.originalDateStr}, ${currentShift.time}) has been sent to eligible colleagues.`,
                reference_id: requests?.[0]?.id || null,
                is_read: false,
            });

            setSubmitSuccess(true);
            setTimeout(() => {
                onClose();
                setSubmitSuccess(false);
                setSwapReason('');
                setSelectedShiftIds([]);
            }, 1800);
        } catch (err) {
            console.error('Error submitting swap request:', err);
        }
        setSubmitting(false);
    };

    const toggleShiftSelection = (shiftId) => {
        setSelectedShiftIds(prev =>
            prev.includes(shiftId) ? prev.filter(id => id !== shiftId) : [...prev, shiftId]
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#152e26] rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-[#1e3a32] flex items-center justify-between bg-gray-50/50 dark:bg-[#1a362e]/50">
                    <div>
                        <h2 className="text-xl font-bold text-[#0c1d17] dark:text-white">Request Shift Swap</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select shifts you're willing to work in exchange for yours.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e3a32] transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
                    {/* Current Shift */}
                    <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-4 border border-orange-100 dark:border-orange-900/30">
                        <h3 className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-2 uppercase tracking-wider">Shift You Want to Swap Away</h3>
                        {currentShift && (
                            <div className="flex items-center gap-4">
                                <div className="bg-white dark:bg-[#152e26] border border-orange-200 dark:border-orange-800/50 rounded-lg p-3 text-center min-w-[60px]">
                                    <span className="block text-xs font-bold text-orange-600 uppercase">{currentShift.day}</span>
                                    <span className="block text-xl font-bold text-[#0c1d17] dark:text-white">{currentShift.date}</span>
                                </div>
                                <div>
                                    <p className="font-bold text-[#0c1d17] dark:text-white">{currentShift.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                                        {currentShift.time} ({currentShift.duration})
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-semibold text-[#0c1d17] dark:text-gray-300 mb-2">Reason for Swap <span className="text-red-500">*</span></label>
                        <textarea
                            value={swapReason}
                            onChange={e => setSwapReason(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 dark:border-[#2a4e43] bg-white dark:bg-[#0f231c] px-4 py-3 text-sm text-[#0c1d17] dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[90px] resize-y placeholder-gray-400"
                            placeholder="e.g. I have a doctor appointment..."
                        />
                    </div>

                    {/* Shift Grid */}
                    <div>
                        <label className="block text-sm font-semibold text-[#0c1d17] dark:text-gray-300 mb-3">
                            Select shifts you can work instead <span className="text-xs text-gray-400">(select all that apply)</span>
                        </label>
                        <div className="border border-gray-200 dark:border-[#2a4e43] rounded-xl overflow-x-auto bg-white dark:bg-[#152e26] shadow-sm relative">
                            {loading && (
                                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                                </div>
                            )}
                            <div className="flex min-w-[900px]">
                                {days.map((day, index) => {
                                    let headerDate = '--';
                                    if (currentShift?.originalDateStr) {
                                        const base = new Date(currentShift.originalDateStr + 'T12:00:00');
                                        const dow = base.getDay();
                                        const diff = base.getDate() - dow + (dow === 0 ? -6 : 1);
                                        const mon = new Date(base); mon.setDate(diff);
                                        const cur = new Date(mon); cur.setDate(mon.getDate() + index);
                                        headerDate = cur.getDate();
                                    }
                                    return (
                                        <div key={day} className="flex-1 min-w-[120px] border-r last:border-r-0 border-gray-100 dark:border-[#1e3a32]">
                                            <div className="p-3 text-center border-b border-gray-100 dark:border-[#1e3a32] bg-gray-50 dark:bg-[#1a362e]/50">
                                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{day}</p>
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold text-[#0c1d17] dark:text-white">{headerDate}</div>
                                            </div>
                                            <div className="p-2 flex flex-col gap-2 min-h-[150px]">
                                                {groupedShifts[day]?.length > 0 ? groupedShifts[day].map(shift => (
                                                    <div
                                                        key={shift.id}
                                                        onClick={() => !shift.isAssigned && toggleShiftSelection(shift.id)}
                                                        className={`p-2 rounded-lg border text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[80px] ${shift.isAssigned
                                                            ? 'bg-gray-50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700/50 cursor-not-allowed opacity-50'
                                                            : selectedShiftIds.includes(shift.id)
                                                                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 cursor-pointer ring-1 ring-orange-400'
                                                                : 'bg-white dark:bg-[#1a362e]/30 border-gray-200 dark:border-[#2a4e43] cursor-pointer hover:border-orange-300'
                                                            }`}
                                                    >
                                                        {selectedShiftIds.includes(shift.id) && (
                                                            <div className="absolute top-0 right-0 w-0 h-0 border-t-[20px] border-t-orange-400 border-l-[20px] border-l-transparent">
                                                                <span className="material-symbols-outlined absolute -top-[18px] right-[1px] text-[10px] text-white font-bold">check</span>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-xs font-bold leading-tight mb-1 text-[#0c1d17] dark:text-white">{shift.name}</p>
                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{shift.startTime} - {shift.endTime}</p>
                                                        </div>
                                                        <div className="mt-2 flex justify-between items-center">
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-[#1e3a32] text-gray-600 dark:text-gray-300">{shift.duration}</span>
                                                            {shift.candidates && shift.candidates.length > 0 && (
                                                                <span className="text-[10px] font-semibold text-orange-500">{shift.candidates.length} candidate(s)</span>
                                                            )}
                                                            {shift.isAssigned && <span className="text-[10px] font-semibold text-gray-400">Assigned</span>}
                                                        </div>
                                                        {shift.candidates && shift.candidates.length > 0 && (
                                                            <div className="mt-1 text-[9px] text-gray-500 leading-tight">
                                                                Offers to: {shift.candidates.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )) : (
                                                    <div className="py-4 text-center">
                                                        <p className="text-[10px] text-gray-400 italic">No shifts</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {selectedShiftIds.length > 0 && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-semibold">{selectedShiftIds.length} shift(s) selected</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-[#1e3a32] flex justify-end gap-3 bg-gray-50/50 dark:bg-[#1a362e]/50">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1e3a32] transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={selectedShiftIds.length === 0 || !swapReason.trim() || submitting || submitSuccess}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white shadow-sm hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {submitSuccess ? (
                            <><span className="material-symbols-outlined text-[18px]">check_circle</span> Sent!</>
                        ) : submitting ? (
                            <><span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span> Sending...</>
                        ) : (
                            <><span className="material-symbols-outlined text-[18px]">swap_horiz</span> Submit Request</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
