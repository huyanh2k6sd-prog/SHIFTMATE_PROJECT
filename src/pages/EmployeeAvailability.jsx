import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EmployeeHeader } from '../components/EmployeeHeader'
import { useAuth } from '../components/AuthContext'
import { supabase } from '../lib/supabase'
import { getDurationHours, formatTime, getVietnamTime, formatLocalDate } from '../utils/timeFormat'

const ShiftButton = ({ shift, isSelected, onClick, isLocked }) => {
    const hours = `${getDurationHours(shift.start_time, shift.end_time)}h`;
    const time = `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`;

    if (isSelected) {
        return (
            <button onClick={() => !isLocked && onClick(shift)} disabled={isLocked} className={`w-full text-left p-3 rounded-xl bg-primary dark:bg-primary/90 border border-transparent shadow-md transition-all relative overflow-hidden ${isLocked ? 'opacity-80 cursor-default' : ''}`}>
                <div className="absolute -right-2 -top-2 w-8 h-8 bg-white/20 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-text-main/70 uppercase truncate pr-2 max-w-[120px]">{shift.name}</span>
                    <div className="size-5 rounded-full bg-text-main text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                    </div>
                </div>
                <div className="text-sm font-bold text-text-main">{time}</div>
                <div className="text-xs text-text-main/70 mt-1">{hours}</div>
            </button>
        )
    }
    return (
        <button onClick={() => !isLocked && onClick(shift)} disabled={isLocked} className={`group w-full text-left p-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-[#e6f4ef] dark:border-surface-dark transition-all ${isLocked ? 'opacity-60 cursor-default' : 'hover:border-primary hover:shadow-md'}`}>
            <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-text-secondary uppercase truncate pr-2 max-w-[120px]">{shift.name}</span>
                <div className="size-5 rounded-full border-2 border-[#e6f4ef] group-hover:border-primary flex items-center justify-center shrink-0"></div>
            </div>
            <div className="text-sm font-bold text-text-main dark:text-white">{time}</div>
            <div className="text-xs text-text-secondary dark:text-slate-400 mt-1">{hours}</div>
        </button>
    )
}

export function EmployeeAvailability() {
    const { workspaceId } = useParams();
    const { user } = useAuth();

    const [shiftsByDay, setShiftsByDay] = useState({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });
    const [selectedShifts, setSelectedShifts] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
    const [minHoursTarget, setMinHoursTarget] = useState(20);

    // Get current week dates (starting Monday)
    const getWeekDates = (offset = 0) => {
        const curr = getVietnamTime();
        curr.setDate(curr.getDate() + (offset * 7));

        const dayOfWeek = curr.getDay() || 7; // Convert Sunday(0) to 7
        const first = curr.getDate() - dayOfWeek + 1; // Monday

        const days = [];
        const daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

        for (let i = 0; i < 7; i++) {
            const next = new Date(curr.getTime());
            next.setDate(first + i);

            const yyyy = next.getFullYear();
            const mm = String(next.getMonth() + 1).padStart(2, '0');
            const dd = String(next.getDate()).padStart(2, '0');
            const localDateStr = `${yyyy}-${mm}-${dd}`;

            days.push({
                key: daysOfWeek[i],
                label: daysOfWeek[i].charAt(0).toUpperCase() + daysOfWeek[i].slice(1),
                dateInfo: next,
                dateNum: next.getDate(),
                isToday: localDateStr === formatLocalDate(getVietnamTime()),
                dateStr: localDateStr
            });
        }
        return days;
    };

    const daysConfig = getWeekDates(currentWeekOffset);

    useEffect(() => {
        if (!user || !workspaceId) return;

        const fetchData = async () => {
            setLoading(true);

            // 1. Get user's approved roles for this workspace
            const { data: userRolesData, error: rolesError } = await supabase
                .from('user_roles')
                .select('role_id')
                .eq('user_id', user.id)
                .eq('status', 'approved');

            if (rolesError || !userRolesData || userRolesData.length === 0) {
                setLoading(false);
                return;
            }

            const roleIds = userRolesData.map(ur => ur.role_id);

            // Fetch role details for hour targets (using the first role for now as primary)
            const { data: roleDetails } = await supabase
                .from('roles')
                .select('min_hours_per_week')
                .in('id', roleIds)
                .limit(1)
                .single();

            if (roleDetails) {
                setMinHoursTarget(roleDetails.min_hours_per_week || 0);
            }

            // 2. Get shifts for these roles in this week
            const startDate = daysConfig[0].dateStr;
            const endDate = daysConfig[6].dateStr;

            const { data: shiftsData, error: shiftsError } = await supabase
                .from('shifts')
                .select(`
                    id, name, date, start_time, end_time, role_id,
                    roles!inner(name, workspace_id)
                `)
                .in('role_id', roleIds)
                .eq('roles.workspace_id', workspaceId)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date')
                .order('start_time');

            // 3. Get existing user availabilities for this week
            const { data: availData, error: availError } = await supabase
                .from('availabilities')
                .select('role_id, date, start_time, end_time')
                .eq('user_id', user.id)
                .in('role_id', roleIds)
                .gte('date', startDate)
                .lte('date', endDate);

            if (shiftsData) {
                const newShiftsByDay = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
                shiftsData.forEach(shift => {
                    const d = new Date(shift.date);
                    // Match JS getDay() (0=Sun, 1=Mon...) to our keys
                    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                    const dayKey = dayKeys[d.getDay()];
                    if (newShiftsByDay[dayKey]) {
                        newShiftsByDay[dayKey].push(shift);
                    }
                });
                setShiftsByDay(newShiftsByDay);

                // Pre-select shifts based on existing availabilities
                const initiallySelected = new Set();
                const normalizeTime = t => t ? t.substring(0, 5) : '';
                const normalizeDate = d => new Date(d).toDateString();

                if (availData) {
                    shiftsData.forEach(shift => {
                        // Check if an availability record exists matching this shift
                        const hasAvail = availData.some(a =>
                            a.role_id === shift.role_id &&
                            normalizeDate(a.date) === normalizeDate(shift.date) &&
                            formatTime(a.start_time) === formatTime(shift.start_time) &&
                            formatTime(a.end_time) === formatTime(shift.end_time)
                        );
                        if (hasAvail) {
                            initiallySelected.add(shift.id);
                        }
                    });
                }
                setSelectedShifts(initiallySelected);
            }

            setLoading(false);
        };

        fetchData();
    }, [user, workspaceId, currentWeekOffset]);

    const toggleShift = (shift) => {
        setSelectedShifts(prev => {
            const next = new Set(prev);
            if (next.has(shift.id)) {
                next.delete(shift.id);
            } else {
                next.add(shift.id);
            }
            return next;
        });
    };

    const saveAvailabilityRecords = async (shiftsToSave) => {
        const startDate = daysConfig[0].dateStr;
        const endDate = daysConfig[6].dateStr;

        const allShifts = Object.values(shiftsByDay).flat();
        const selectedShiftObjects = allShifts.filter(s => shiftsToSave.has(s.id));

        const availabilityRecords = selectedShiftObjects.map(s => {
            // Helper to extract time if it's an ISO string instead of just time
            const normalizeTimeStr = (t) => {
                if (!t) return null;
                if (t.includes('T')) {
                    const d = new Date(t);
                    const hh = String(d.getHours()).padStart(2, '0');
                    const mm = String(d.getMinutes()).padStart(2, '0');
                    return `${hh}:${mm}`;
                }
                return t.substring(0, 8); // HH:mm:ss if it's longer, database accepts it
            };

            return {
                user_id: user.id,
                role_id: s.role_id,
                date: s.date,
                start_time: normalizeTimeStr(s.start_time),
                end_time: normalizeTimeStr(s.end_time)
            };
        });

        const { error: deleteError } = await supabase
            .from('availabilities')
            .delete()
            .eq('user_id', user.id)
            .gte('date', startDate)
            .lte('date', endDate);

        if (deleteError) {
            console.error("DEBUG: Delete error from Supabase:", deleteError);
            return { error: deleteError };
        }

        if (availabilityRecords.length > 0) {
            const { error: insertError } = await supabase
                .from('availabilities')
                .insert(availabilityRecords);
            if (insertError) {
                console.error("DEBUG: Insert error from Supabase:", insertError);
                return { error: insertError };
            }
        }
        return { error: null };
    };

    const handleSaveAvailability = async () => {
        setSaving(true);
        const { error } = await saveAvailabilityRecords(selectedShifts);
        if (error) {
            console.error("Error saving availability:", error);
            alert("Failed to save availability.");
        } else {
            alert("Availability saved successfully!");
        }
        setSaving(false);
    };

    const handleClearAll = () => {
        setSelectedShifts(new Set());
    };

    const handleCopyLastWeek = async () => {
        setSaving(true);
        try {
            const lastWeekDates = getWeekDates(currentWeekOffset - 1);

            // Get user's approved role IDs
            const { data: userRolesData } = await supabase
                .from('user_roles')
                .select('role_id')
                .eq('user_id', user.id)
                .eq('status', 'approved');

            const roleIds = (userRolesData || []).map(ur => ur.role_id);
            if (roleIds.length === 0) {
                alert('No approved roles found.');
                setSaving(false);
                return;
            }

            // Fetch last week's shifts for comparison
            const { data: lastWeekShifts } = await supabase
                .from('shifts')
                .select('id, name, date, start_time, end_time, role_id')
                .in('role_id', roleIds)
                .gte('date', lastWeekDates[0].dateStr)
                .lte('date', lastWeekDates[6].dateStr)
                .order('date')
                .order('start_time');

            // Compare shifts: build a "signature" for each week (day-of-week + time + role)
            const buildSignature = (shifts) => {
                return shifts.map(s => {
                    const d = new Date(s.date);
                    return `${d.getDay()}_${formatTime(s.start_time)}_${formatTime(s.end_time)}_${s.role_id}`;
                }).sort().join('|');
            };

            const thisWeekShifts = Object.values(shiftsByDay).flat();
            const lastSig = buildSignature(lastWeekShifts || []);
            const thisSig = buildSignature(thisWeekShifts);

            if (lastSig !== thisSig) {
                alert('Cannot copy: shifts have been changed by the manager compared to last week.');
                setSaving(false);
                return;
            }

            // Fetch last week's availabilities
            const { data: lastWeekAvail, error } = await supabase
                .from('availabilities')
                .select('*')
                .eq('user_id', user.id)
                .in('role_id', roleIds)
                .gte('date', lastWeekDates[0].dateStr)
                .lte('date', lastWeekDates[6].dateStr);

            if (error) throw error;
            if (!lastWeekAvail || lastWeekAvail.length === 0) {
                alert('No availability found for last week.');
                setSaving(false);
                return;
            }

            // Map last week's availabilities to this week's shift IDs
            const newSelected = new Set();
            lastWeekAvail.forEach(oldAvail => {
                const oldDateObj = new Date(oldAvail.date);
                const dayOfWeek = oldDateObj.getDay();

                const matchingShift = thisWeekShifts.find(s => {
                    const sDateObj = new Date(s.date);
                    return sDateObj.getDay() === dayOfWeek &&
                        formatTime(s.start_time) === formatTime(oldAvail.start_time) &&
                        formatTime(s.end_time) === formatTime(oldAvail.end_time) &&
                        s.role_id === oldAvail.role_id;
                });

                if (matchingShift) {
                    newSelected.add(matchingShift.id);
                }
            });

            if (newSelected.size > 0) {
                setSelectedShifts(newSelected);
                alert('Copied last week\'s availability! Click "Save Availability" to confirm.');
            } else {
                alert('Could not find matching shifts in the current week to copy to.');
            }
        } catch (error) {
            console.error('Error copying last week:', error);
            alert('Failed to copy last week\'s availability.');
        }
        setSaving(false);
    };

    const allKnownShifts = Object.values(shiftsByDay).flat();
    const totalSelectedHours = allKnownShifts
        .filter(s => selectedShifts.has(s.id))
        .reduce((sum, s) => sum + getDurationHours(s.start_time, s.end_time), 0);

    return (
        <div style={{
            '--color-primary': '#99ffda',
            '--color-primary-hover': '#7fecc7',
            '--color-primary-active': '#66d4af',
            '--color-background-light': '#f8fcfa',
            '--color-background-dark': '#0f231c',
            '--color-surface-light': '#ffffff',
            '--color-surface-dark': '#162e25',
            '--color-text-main': '#0c1d17',
            '--color-text-secondary': '#45a17f',
            '--color-border-color': '#e6f4ef',
            '--color-border-focus': '#cdeadf',
            '--color-mint-green': '#98FFD9',
            '--color-nav-inactive': '#059669',
            '--color-nav-inactive-dark': '#0fa968',
        }} className="bg-background-light dark:bg-background-dark text-text-main dark:text-slate-100 font-display min-h-screen flex flex-col relative">
            <EmployeeHeader />
            <div className="flex-1 flex justify-center w-full px-4 py-8 lg:px-8">
                <div className="w-full max-w-[1280px] flex flex-col gap-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">Set Your Availability</h1>
                            <p className="text-text-secondary dark:text-slate-400 text-base font-normal leading-normal max-w-xl">
                                Select specific shifts you can work this week. <br className="hidden sm:block" />Green cards indicate you are available.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-surface-light dark:bg-surface-dark p-1 rounded-lg border border-[#e6f4ef] dark:border-surface-dark shadow-sm">
                            <button
                                onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                                className="p-2 hover:bg-background-light dark:hover:bg-background-dark rounded-md transition-colors text-text-secondary dark:text-slate-400"
                            >
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <span className="text-sm font-bold px-2 text-text-main dark:text-white flex items-center justify-center min-w-[120px]">
                                {daysConfig[0].dateInfo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                &nbsp;-&nbsp;
                                {daysConfig[6].dateInfo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <button
                                onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                                className="p-2 hover:bg-background-light dark:hover:bg-background-dark rounded-md transition-colors text-text-secondary dark:text-slate-400"
                            >
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    </div>
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-[#e6f4ef] dark:border-surface-dark shadow-sm p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-[#e6f4ef] dark:border-surface-dark pb-4 md:pb-0 md:pr-4 last:border-0 last:pb-0 last:pr-0">
                            <div className="bg-mint-green/20 p-2.5 rounded-lg text-text-main flex items-center justify-center">
                                <span className="material-symbols-outlined text-xl">check_circle</span>
                            </div>
                            <div>
                                <p className="text-text-secondary dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Shifts Selected</p>
                                <p className="text-xl md:text-2xl font-bold text-text-main dark:text-white">{selectedShifts.size}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-[#e6f4ef] dark:border-surface-dark pb-4 md:pb-0 md:pr-4 last:border-0 last:pb-0 last:pr-0">
                            <div className="bg-mint-green/20 p-2.5 rounded-lg text-text-main flex items-center justify-center">
                                <span className="material-symbols-outlined text-xl">schedule</span>
                            </div>
                            <div>
                                <p className="text-text-secondary dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Total Available Hours</p>
                                <p className={`text-xl md:text-2xl font-bold flex items-center gap-2 ${totalSelectedHours >= minHoursTarget ? 'text-primary-active dark:text-primary' : 'text-text-main dark:text-white'}`}>
                                    {Number(totalSelectedHours.toFixed(2))}h
                                    {totalSelectedHours >= minHoursTarget && (
                                        <span className="material-symbols-outlined text-[20px]">verified</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-lg flex items-center justify-center ${totalSelectedHours >= minHoursTarget ? 'bg-primary/20 text-primary-active' : 'bg-mint-green/20 text-text-main'}`}>
                                <span className="material-symbols-outlined text-xl">{totalSelectedHours >= minHoursTarget ? 'task_alt' : 'arrow_upward'}</span>
                            </div>
                            <div>
                                <p className="text-text-secondary dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Minimum Required</p>
                                <p className="text-xl md:text-2xl font-bold text-text-main dark:text-white">{minHoursTarget}h</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-[#e6f4ef] dark:border-surface-dark shadow-sm overflow-hidden flex flex-col">
                        <div className="flex border-b border-[#e6f4ef] dark:border-surface-dark overflow-x-auto no-scrollbar">
                            <div className="grid grid-cols-7 min-w-[1000px] w-full">
                                {daysConfig.map((day) => (
                                    <div key={day.key} className={`p-4 text-center border-r border-[#e6f4ef] dark:border-surface-dark last:border-r-0 ${day.isToday ? 'bg-primary/5 dark:bg-primary/5' : ''}`}>
                                        <p className={`text-xs font-medium uppercase ${day.isToday ? 'text-primary-active dark:text-primary font-bold' : 'text-text-secondary dark:text-slate-400'}`}>{day.label}</p>
                                        <p className="text-lg font-bold text-text-main dark:text-white mt-1">{day.dateNum}</p>
                                        {day.isToday && <div className="mx-auto mt-1 w-1.5 h-1.5 rounded-full bg-primary"></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="overflow-x-auto no-scrollbar bg-background-light/30 dark:bg-background-dark/30">
                            <div className="grid grid-cols-7 min-w-[1000px] w-full min-h-[400px]">
                                {daysConfig.map((day) => (
                                    <div key={`shifts-${day.key}`} className={`p-3 border-r border-[#e6f4ef] dark:border-surface-dark last:border-r-0 flex flex-col gap-3 ${day.isToday ? 'bg-primary/5 dark:bg-primary/5' : ''}`}>
                                        {loading ? (
                                            <div className="flex justify-center mt-8">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-dark"></div>
                                            </div>
                                        ) : shiftsByDay[day.key]?.length > 0 ? (
                                            shiftsByDay[day.key].map(shift => (
                                                <ShiftButton
                                                    key={shift.id}
                                                    shift={shift}
                                                    isSelected={selectedShifts.has(shift.id)}
                                                    onClick={toggleShift}
                                                />
                                            ))
                                        ) : (
                                            <div className="w-full text-center p-8 rounded-xl border border-dashed border-[#e6f4ef] dark:border-surface-dark mt-4">
                                                <span className="material-symbols-outlined text-text-secondary/50 text-2xl mb-1">block</span>
                                                <p className="text-xs font-medium text-text-secondary/70">No shifts</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 items-end">
                        <div className="flex flex-col gap-4">
                            <h3 className="text-text-main dark:text-white text-lg font-bold">Quick Actions</h3>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={handleCopyLastWeek}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[#e6f4ef] dark:border-surface-dark bg-surface-light dark:bg-surface-dark hover:border-primary/50 hover:bg-primary/5 transition-colors group disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-text-secondary dark:text-slate-400 group-hover:text-primary-active">content_copy</span>
                                    <span className="text-sm font-medium text-text-main dark:text-white">Copy Last Week</span>
                                </button>
                                <button
                                    onClick={handleClearAll}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[#e6f4ef] dark:border-surface-dark bg-surface-light dark:bg-surface-dark hover:border-primary/50 hover:bg-primary/5 transition-colors group disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-text-secondary dark:text-slate-400 group-hover:text-primary-active">restart_alt</span>
                                    <span className="text-sm font-medium text-text-main dark:text-white">Clear All</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end mt-4 md:mt-0 flex-col items-end">
                            <button className="w-full md:w-auto flex-1 md:flex-none flex items-center justify-center gap-2 min-w-[160px] px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover dark:bg-primary/90 dark:hover:bg-primary text-text-main text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                                onClick={handleSaveAvailability}
                                disabled={saving}
                            >
                                {saving ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-dark-navy"></div>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[20px]">save</span>
                                        <span>Save Availability</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
