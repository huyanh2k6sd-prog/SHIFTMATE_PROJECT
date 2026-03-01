import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formatTime, formatLocalDate, getVietnamTime } from '../utils/timeFormat'
import { ManagerHeader } from '../components/ManagerHeader'
import { AvailableStaffModal } from '../components/AvailableStaffModal'
import { EditShiftModal } from '../components/EditShiftModal'
import { DeleteShiftModal } from '../components/DeleteShiftModal'
import { CreateShiftModal } from '../components/CreateShiftModal'
import { ManagerAvailabilityGrid } from '../components/ManagerAvailabilityGrid'
import { ManagerAssignmentGrid } from '../components/ManagerAssignmentGrid'
import { AssignedStaffModal } from '../components/AssignedStaffModal'
import { supabase } from '../lib/supabase'

export function ManagerDashboard() {
    const { workspaceId, roleId } = useParams()
    const navigate = useNavigate()

    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
    const [isAssignedStaffModalOpen, setIsAssignedStaffModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    const [activeShiftData, setActiveShiftData] = useState(null)
    const [viewMode, setViewMode] = useState('availability')

    const [roles, setRoles] = useState([])
    const [activeRole, setActiveRole] = useState(null)
    const [shifts, setShifts] = useState([])
    const [loading, setLoading] = useState(true)
    const [isActioning, setIsActioning] = useState(false)
    const [undoStack, setUndoStack] = useState([])
    const [weekOffset, setWeekOffset] = useState(0)

    // Helper to get week dates based on offset from current week
    const getWeekDates = (offset = 0) => {
        const today = getVietnamTime();
        const date = new Date(today);
        date.setDate(date.getDate() + (offset * 7));
        const day = date.getDay(); // 0 is Sunday, 1 is Monday...
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
        weekStart.setHours(0, 0, 0, 0);

        const days = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            days.push({
                key: dayNames[d.getDay()],
                label: labels[d.getDay()],
                dateNum: d.getDate(),
                fullDate: formatLocalDate(d),
                isToday: formatLocalDate(d) === formatLocalDate(getVietnamTime())
            });
        }

        const first = days[0];
        const last = days[6];
        const label = `${monthNames[new Date(first.fullDate).getMonth()]} ${first.dateNum} - ${monthNames[new Date(last.fullDate).getMonth()]} ${last.dateNum}, ${new Date(last.fullDate).getFullYear()}`;

        return { days, label };
    };

    const { days: weekDays, label: currentWeekLabel } = getWeekDates(weekOffset);
    const weekStartDate = weekDays[0]?.fullDate;
    const weekEndDate = weekDays[6]?.fullDate;

    const fetchData = React.useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true)

        // Fetch roles for this workspace
        const { data: rolesData } = await supabase
            .from('roles')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('name')

        if (rolesData && rolesData.length > 0) {
            setRoles(rolesData)

            // Determine active role
            let selectedRole = rolesData.find(r => r.id === roleId)
            if (!selectedRole) {
                selectedRole = rolesData[0]
                navigate(`/manager/dashboard/${workspaceId}/${selectedRole.id}`, { replace: true })
            }
            setActiveRole(selectedRole)

            if (selectedRole) {
                // Ensure workspace manager is explicitly added to user_roles as a manager to pass RLS
                const { data: { user } } = await supabase.auth.getUser();
                const { data: wsData } = await supabase.from('workspaces').select('manager_id').eq('id', workspaceId).single();
                if (user && wsData && wsData.manager_id === user.id) {
                    const { data: existingRole } = await supabase.from('user_roles')
                        .select('id').eq('user_id', user.id).eq('role_id', selectedRole.id).single();
                    if (!existingRole) {
                        await supabase.from('user_roles').insert({
                            user_id: user.id,
                            role_id: selectedRole.id,
                            status: 'approved',
                            is_manager: true
                        });
                    }
                }

                // Fetch shifts for the active role, filtered by current week
                const { data: shiftsData } = await supabase
                    .from('shifts')
                    .select('*')
                    .eq('role_id', selectedRole.id)
                    .gte('date', weekStartDate)
                    .lte('date', weekEndDate)
                    .order('date')
                    .order('start_time')

                if (shiftsData && shiftsData.length > 0) {
                    const shiftIds = shiftsData.map(s => s.id);

                    // Fetch assignment counts manually to bypass FK errors
                    const { data: assignedData } = await supabase
                        .from('shift_assignments')
                        .select('shift_id')
                        .in('shift_id', shiftIds);

                    const counts = {};
                    if (assignedData) {
                        assignedData.forEach(a => {
                            counts[a.shift_id] = (counts[a.shift_id] || 0) + 1;
                        });
                    }

                    // Fetch availabilities for this role and date range
                    const { data: availData } = await supabase
                        .from('availabilities')
                        .select('user_id, date, start_time, end_time')
                        .eq('role_id', selectedRole.id)
                        .in('date', shiftsData.map(s => s.date));

                    const enhancedShifts = shiftsData.map(shift => {
                        const assignedCount = counts[shift.id] || 0;

                        // Extract HH:MM:SS from ISO string or use as is if already time format
                        const sTime = shift.start_time.includes('T') ? shift.start_time.split('T')[1].substring(0, 8) : shift.start_time;
                        const eTime = shift.end_time.includes('T') ? shift.end_time.split('T')[1].substring(0, 8) : shift.end_time;

                        // Filter users who have explicitly submitted availability for this shift's date/time
                        const availableUsers = availData ? availData.filter(av => {
                            if (av.date !== shift.date) return false;

                            const avStart = formatTime(av.start_time);
                            const avEnd = formatTime(av.end_time);
                            const sfStart = formatTime(shift.start_time);
                            const sfEnd = formatTime(shift.end_time);

                            // Shift must be within the availability block
                            return avStart <= sfStart && avEnd >= sfEnd;
                        }) : [];

                        // Unique available users
                        const uniqueAvailableIds = new Set(availableUsers.map(u => u.user_id));

                        return {
                            ...shift,
                            assigned_count: assignedCount,
                            available_count: uniqueAvailableIds.size
                        };
                    });
                    setShifts(enhancedShifts)
                } else {
                    setShifts([])
                }
            }
        }

        setLoading(false)
    }, [workspaceId, roleId, navigate, weekStartDate, weekEndDate])

    const handleCopyLastWeek = async () => {
        if (!activeRole || !workspaceId) return;
        setIsActioning(true);

        try {
            const lastWeekConfig = getWeekDates(weekOffset - 1);
            const lastWeekStart = lastWeekConfig.days[0].fullDate;
            const lastWeekEnd = lastWeekConfig.days[6].fullDate;

            const { data: lastWeekShifts, error: fetchError } = await supabase
                .from('shifts')
                .select('*')
                .eq('role_id', activeRole.id)
                .gte('date', lastWeekStart)
                .lte('date', lastWeekEnd);

            if (fetchError) throw fetchError;

            if (!lastWeekShifts || lastWeekShifts.length === 0) {
                alert("No shifts found in the previous week to copy.");
                setIsActioning(false);
                return;
            }

            const newShiftsToInsert = lastWeekShifts.map(oldShift => {
                const oldDateObj = new Date(`${oldShift.date}T00:00:00`);
                const dayOfWeek = oldDateObj.getDay();

                const newDateStr = weekDays.find(d => {
                    const temp = new Date(`${d.fullDate}T00:00:00`);
                    return temp.getDay() === dayOfWeek;
                })?.fullDate;

                const adjustTime = (dtStr, oldDate, newDate) => {
                    if (!dtStr) return null;
                    const d = new Date(dtStr);
                    const baseOld = new Date(`${oldDate}T00:00:00`);
                    const baseNew = new Date(`${newDate}T00:00:00`);

                    const diffTime = Math.round((d.getTime() - baseOld.getTime()) / (1000 * 60 * 60 * 24)); // Days diff
                    // Even simpler: just replace hours and mins onto the target date + offset
                    const targetDate = new Date(baseNew);
                    targetDate.setDate(targetDate.getDate() + (diffTime >= 0 ? diffTime : 0));

                    return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), d.getHours(), d.getMinutes(), 0).toISOString();
                };

                return {
                    name: oldShift.name,
                    title: oldShift.title || oldShift.name,
                    role_id: activeRole.id,
                    workspace_id: workspaceId,
                    group_id: crypto.randomUUID(),
                    date: newDateStr,
                    start_time: adjustTime(oldShift.start_time, oldShift.date, newDateStr),
                    end_time: adjustTime(oldShift.end_time, oldShift.date, newDateStr),
                    required_staff: oldShift.required_staff || 3
                };
            }).filter(s => s.date);

            if (newShiftsToInsert.length > 0) {
                const { data: insertedData, error: insertError } = await supabase
                    .from('shifts')
                    .insert(newShiftsToInsert)
                    .select();

                if (insertError) {
                    console.error("Supabase insertError:", insertError);
                    throw insertError;
                }

                if (insertedData) {
                    setUndoStack(prev => [...prev, { type: 'COPY', data: insertedData.map(s => s.id) }]);
                }
                alert(`Successfully copied ${newShiftsToInsert.length} shifts to the current week!`);
                fetchData();
            } else {
                alert("No valid shifts to copy after date mapping.");
            }
        } catch (error) {
            console.error("Error copying last week:", error);
            alert(`Failed to copy last week's shifts: ${error.message || 'Unknown error. Check console.'}`);
        }

        setIsActioning(false);
    };


    // ─────────────────────────────────────────────
    // AUTO-SCHEDULE ALGORITHM
    // ─────────────────────────────────────────────
    const handleAutoSchedule = async () => {
        if (!activeRole || !workspaceId) return;
        if (!window.confirm('Run Auto-Schedule? This will assign available employees to open shifts, preserving any manually assigned staff.')) return;

        setIsActioning(true);
        try {
            // ── 1. Fetch role settings (min/max hours) ──
            const { data: roleData } = await supabase
                .from('roles')
                .select('min_hours_per_week, max_hours_per_week')
                .eq('id', activeRole.id)
                .single();

            const minHours = roleData?.min_hours_per_week || 0;
            const maxHours = roleData?.max_hours_per_week || 40;

            // ── 2. Fetch week's shifts ──
            const { data: weekShifts } = await supabase
                .from('shifts')
                .select('*')
                .eq('role_id', activeRole.id)
                .gte('date', weekStartDate)
                .lte('date', weekEndDate);

            if (!weekShifts || weekShifts.length === 0) {
                alert('No shifts found for this week. Please create shifts first.');
                setIsActioning(false);
                return;
            }

            const shiftIds = weekShifts.map(s => s.id);

            // ── 3. Fetch existing assignments ──
            const { data: existingAssignments } = await supabase
                .from('shift_assignments')
                .select('*')
                .in('shift_id', shiftIds);

            // Manual overrides are kept as-is (priority 1)
            const manualAssignments = existingAssignments?.filter(a => a.is_manual_override) || [];
            // Track which (shift_id, user_id) are already assigned
            const alreadyAssigned = new Set(
                (existingAssignments || []).map(a => `${a.shift_id}::${a.user_id}`)
            );

            // ── 4. Fetch approved employees for this role ──
            const { data: userRolesData } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role_id', activeRole.id)
                .eq('status', 'approved')
                .eq('is_manager', false);

            const employeeIds = (userRolesData || []).map(u => u.user_id);
            if (employeeIds.length === 0) {
                alert('No approved employees found for this role.');
                setIsActioning(false);
                return;
            }

            // ── 5. Fetch availabilities for the week ──
            const { data: availabilities } = await supabase
                .from('availabilities')
                .select('*')
                .eq('role_id', activeRole.id)
                .gte('date', weekStartDate)
                .lte('date', weekEndDate)
                .in('user_id', employeeIds);

            // ── 6. Build helper maps ──
            // shiftInfo: shift_id → {start, end, date, requiredStaff, duration}
            const parseShiftTime = (t) => {
                if (!t) return 0;
                if (t.includes('T')) {
                    const d = new Date(t);
                    return d.getHours() * 60 + d.getMinutes();
                }
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };
            const shiftInfo = {};
            weekShifts.forEach(s => {
                const startMins = parseShiftTime(s.start_time);
                let endMins = parseShiftTime(s.end_time);
                let durationMins = endMins - startMins;
                if (durationMins <= 0) durationMins += 24 * 60; // overnight
                shiftInfo[s.id] = {
                    ...s,
                    startMins,
                    endMins: startMins + durationMins,
                    durationHrs: durationMins / 60,
                    requiredStaff: s.required_staff || 1
                };
            });

            // availableForShift: shift_id → Set of user_ids who are available
            const availableForShift = {};
            weekShifts.forEach(s => { availableForShift[s.id] = new Set(); });

            (availabilities || []).forEach(av => {
                const avStart = parseShiftTime(av.start_time);
                let avEnd = parseShiftTime(av.end_time);
                if (avEnd <= avStart) avEnd += 24 * 60;

                weekShifts.forEach(s => {
                    if (s.date !== av.date) return;
                    const si = shiftInfo[s.id];
                    // Employee is available if their window covers MOST of the shift (>= 50%)
                    const overlapStart = Math.max(avStart, si.startMins);
                    const overlapEnd = Math.min(avEnd, si.endMins);
                    if (overlapEnd > overlapStart) {
                        const overlapFraction = (overlapEnd - overlapStart) / (si.endMins - si.startMins);
                        if (overlapFraction >= 0.5) {
                            availableForShift[s.id].add(av.user_id);
                        }
                    }
                });
            });

            // employeeTotalHrs: user_id → total hours assigned this week
            const employeeTotalHrs = {};
            employeeIds.forEach(uid => { employeeTotalHrs[uid] = 0; });
            // Count hours from manual overrides
            manualAssignments.forEach(a => {
                const si = shiftInfo[a.shift_id];
                if (si && employeeTotalHrs[a.user_id] !== undefined) {
                    employeeTotalHrs[a.user_id] = (employeeTotalHrs[a.user_id] || 0) + si.durationHrs;
                }
            });

            // employeeAssignedShifts: user_id → [{startMins, endMins}] for conflict checking
            const employeeAssignedShifts = {};
            employeeIds.forEach(uid => { employeeAssignedShifts[uid] = []; });
            manualAssignments.forEach(a => {
                const si = shiftInfo[a.shift_id];
                if (si && employeeAssignedShifts[a.user_id]) {
                    employeeAssignedShifts[a.user_id].push({ date: si.date, startMins: si.startMins, endMins: si.endMins });
                }
            });

            // employeeAvailCount: user_id → number of shifts they are available for
            const employeeAvailCount = {};
            employeeIds.forEach(uid => {
                let count = 0;
                weekShifts.forEach(s => { if (availableForShift[s.id].has(uid)) count++; });
                employeeAvailCount[uid] = count;
            });

            // ── 7. Sort shifts: hardest (fewest available staff) first ──
            const sortedShifts = [...weekShifts].sort((a, b) => {
                const aAvail = availableForShift[a.id].size;
                const bAvail = availableForShift[b.id].size;
                return aAvail - bAvail;
            });

            // ── 8. Allocate employees to shifts ──
            const newAssignments = [];

            const canAssign = (userId, shiftId) => {
                const si = shiftInfo[shiftId];
                if (!si) return false;
                // Check max hours
                if ((employeeTotalHrs[userId] || 0) + si.durationHrs > maxHours) return false;
                // Check time conflicts (same date only)
                const existing = employeeAssignedShifts[userId] || [];
                for (const ex of existing) {
                    if (ex.date !== si.date) continue;
                    if (si.startMins < ex.endMins && si.endMins > ex.startMins) return false; // overlap
                }
                return true;
            };

            const doAssign = (userId, shiftId) => {
                const si = shiftInfo[shiftId];
                alreadyAssigned.add(`${shiftId}::${userId}`);
                employeeTotalHrs[userId] = (employeeTotalHrs[userId] || 0) + si.durationHrs;
                if (!employeeAssignedShifts[userId]) employeeAssignedShifts[userId] = [];
                employeeAssignedShifts[userId].push({ date: si.date, startMins: si.startMins, endMins: si.endMins });
                newAssignments.push({ shift_id: shiftId, user_id: userId, status: 'ASSIGNED', is_manual_override: false });
            };

            // Count already assigned spots per shift
            const assignedCount = {};
            weekShifts.forEach(s => { assignedCount[s.id] = 0; });
            (existingAssignments || []).forEach(a => {
                if (assignedCount[a.shift_id] !== undefined) assignedCount[a.shift_id]++;
            });

            // ── 8a. PRE-CLEANUP: Remove excess non-manual assignments ──
            const excessToRemove = [];
            for (const shift of weekShifts) {
                const si = shiftInfo[shift.id];
                const currentCount = assignedCount[shift.id];
                if (currentCount > si.requiredStaff) {
                    // Find non-manual assignments for this shift and trim the excess
                    const nonManualForShift = (existingAssignments || [])
                        .filter(a => a.shift_id === shift.id && !a.is_manual_override);
                    const excessCount = currentCount - si.requiredStaff;
                    // Remove the last N non-manual assignments (LIFO)
                    const toRemove = nonManualForShift.slice(-excessCount);
                    toRemove.forEach(a => {
                        excessToRemove.push(a.id);
                        assignedCount[shift.id]--;
                        alreadyAssigned.delete(`${shift.id}::${a.user_id}`);
                        // Also reduce the employee's hours
                        if (employeeTotalHrs[a.user_id] !== undefined) {
                            employeeTotalHrs[a.user_id] -= si.durationHrs;
                        }
                    });
                }
            }
            if (excessToRemove.length > 0) {
                await supabase.from('shift_assignments').delete().in('id', excessToRemove);
            }

            for (const shift of sortedShifts) {
                const si = shiftInfo[shift.id];
                const spotsNeeded = si.requiredStaff - assignedCount[shift.id];
                if (spotsNeeded <= 0) continue;

                // Get available employees for this shift, not already assigned
                const candidates = [...availableForShift[shift.id]]
                    .filter(uid => !alreadyAssigned.has(`${shift.id}::${uid}`))
                    .filter(uid => canAssign(uid, shift.id));

                // Sort candidates by priority:
                // a) Below min hours first (priority 2/3)
                // b) Within that, fewest available shifts (most constrained first)
                candidates.sort((a, b) => {
                    const aBelowMin = (employeeTotalHrs[a] || 0) < minHours ? 0 : 1;
                    const bBelowMin = (employeeTotalHrs[b] || 0) < minHours ? 0 : 1;
                    if (aBelowMin !== bBelowMin) return aBelowMin - bBelowMin;
                    // Fewer available slots = higher priority
                    return (employeeAvailCount[a] || 0) - (employeeAvailCount[b] || 0);
                });

                let filled = 0;
                for (const uid of candidates) {
                    if (filled >= spotsNeeded) break;
                    doAssign(uid, shift.id);
                    assignedCount[shift.id]++;
                    filled++;
                }
            }

            // ── 9. Insert new assignments ──
            if (newAssignments.length > 0) {
                const { error: insertErr } = await supabase
                    .from('shift_assignments')
                    .insert(newAssignments);

                if (insertErr) throw insertErr;
            }

            alert(`Auto-Schedule complete! Assigned ${newAssignments.length} new shift slot(s).`);
            fetchData();

        } catch (err) {
            console.error('Auto-schedule error:', err);
            alert(`Auto-schedule failed: ${err.message}`);
        }
        setIsActioning(false);
    };

    const handleClearThisWeek = async () => {
        if (!activeRole || !workspaceId) return;
        if (!window.confirm("Are you sure you want to clear all shifts for this week? This can be undone immediately via the Undo button.")) return;

        setIsActioning(true);
        try {
            const { data: shiftsToDelete, error: fetchErr } = await supabase
                .from('shifts')
                .select('*')
                .eq('role_id', activeRole.id)
                .gte('date', weekStartDate)
                .lte('date', weekEndDate);

            if (fetchErr) throw fetchErr;
            if (!shiftsToDelete || shiftsToDelete.length === 0) {
                alert("No shifts to clear.");
                setIsActioning(false);
                return;
            }

            const idsToDelete = shiftsToDelete.map(s => s.id);
            const { error: delErr } = await supabase
                .from('shifts')
                .delete()
                .in('id', idsToDelete);

            if (delErr) throw delErr;

            setUndoStack(prev => [...prev, { type: 'CLEAR', data: shiftsToDelete }]);
            fetchData();
        } catch (error) {
            console.error("Error clearing shifts:", error);
            alert("Failed to clear shifts.");
        }
        setIsActioning(false);
    };

    const handleClearAssignments = async () => {
        if (!activeRole || !workspaceId) return;
        if (!window.confirm("Are you sure you want to remove all assigned staff from this week's shifts? The shifts will remain.")) return;

        setIsActioning(true);
        try {
            const { data: weekShifts, error: fetchErr } = await supabase
                .from('shifts')
                .select('id')
                .eq('role_id', activeRole.id)
                .gte('date', weekStartDate)
                .lte('date', weekEndDate);

            if (fetchErr) throw fetchErr;
            if (!weekShifts || weekShifts.length === 0) {
                alert('No shifts found for this week.');
                setIsActioning(false);
                return;
            }

            const shiftIds = weekShifts.map(s => s.id);
            const { error: delErr } = await supabase
                .from('shift_assignments')
                .delete()
                .in('shift_id', shiftIds);

            if (delErr) throw delErr;

            alert('All staff assignments cleared for this week.');
            fetchData();
        } catch (error) {
            console.error('Error clearing assignments:', error);
            alert('Failed to clear assignments.');
        }
        setIsActioning(false);
    };

    const handleUndo = async () => {
        if (undoStack.length === 0) return;
        setIsActioning(true);

        const lastAction = undoStack[undoStack.length - 1];

        try {
            if (lastAction.type === 'CLEAR') {
                const shiftsToRestore = lastAction.data.map(({ id, ...rest }) => rest);
                const { error } = await supabase.from('shifts').insert(shiftsToRestore);
                if (error) throw error;
            } else if (lastAction.type === 'COPY') {
                const idsToDelete = lastAction.data;
                const { error } = await supabase.from('shifts').delete().in('id', idsToDelete);
                if (error) throw error;
            } else if (lastAction.type === 'EDIT') {
                // Upsert to forcefully overwrite the modified rows with their previous, cached states.
                const { error } = await supabase.from('shifts').upsert(lastAction.data);
                if (error) throw error;
            }

            setUndoStack(prev => prev.slice(0, -1));
            fetchData();
        } catch (error) {
            console.error("Undo Error:", error);
            alert("Failed to undo last action.");
        }
        setIsActioning(false);
    };

    useEffect(() => {
        fetchData()

        // Listen for custom refresh events from notification actions (same-client changes)
        const handleRefresh = () => fetchData();
        window.addEventListener('shiftmate:refresh', handleRefresh);

        // Setup realtime subscription for shifts, assignments, roles and availabilities
        let channelShifts, channelAssign, channelRoles, channelAvail;
        if (roleId) {
            channelShifts = supabase.channel(`shifts_${roleId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `role_id=eq.${roleId}` }, fetchData).subscribe()
            channelAssign = supabase.channel('assignments_db_changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments' }, fetchData).subscribe()
            channelRoles = supabase.channel(`roles_${roleId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `role_id=eq.${roleId}` }, fetchData).subscribe()
            channelAvail = supabase.channel(`availabilities_${roleId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'availabilities', filter: `role_id=eq.${roleId}` }, fetchData).subscribe()
        }

        return () => {
            window.removeEventListener('shiftmate:refresh', handleRefresh);
            if (channelShifts) supabase.removeChannel(channelShifts)
            if (channelAssign) supabase.removeChannel(channelAssign)
            if (channelRoles) supabase.removeChannel(channelRoles)
            if (channelAvail) supabase.removeChannel(channelAvail)
        }
    }, [roleId, fetchData])

    const handleOpenStaffModal = (shiftData) => {
        setActiveShiftData(shiftData)
        setIsStaffModalOpen(true)
    }

    const handleOpenAssignedStaffModal = (shiftData) => {
        setActiveShiftData(shiftData)
        setIsAssignedStaffModalOpen(true)
    }

    const handleOpenEditModal = (shiftData) => {
        setActiveShiftData(shiftData)
        setIsEditModalOpen(true)
    }

    const handleOpenDeleteModal = (shiftData) => {
        setActiveShiftData(shiftData)
        setIsDeleteModalOpen(true)
    }

    if (loading) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
            </div>
        )
    }

    return (
        <div style={{
            '--color-primary': '#99ffda',
            '--color-primary-hover': '#7fecc9',
            '--color-background-light': '#f8fcfa',
            '--color-background-dark': '#0f231c',
            '--color-surface-light': '#ffffff',
            '--color-surface-dark': '#162e25',
            '--color-text-primary-light': '#0c1d17',
            '--color-text-primary-dark': '#e0f2eb',
            '--color-text-secondary-light': '#45a17f',
            '--color-text-secondary-dark': '#6dbca0',
            '--color-danger': '#ff6b6b',
            '--color-danger-bg': '#fff0f0',
            '--color-mint-green': '#98FFD9',
            '--color-dark-navy': '#0A2620',
            '--color-shift-green-bg': '#E6FBF2',
            '--color-shift-green-text': '#046C4E',
            '--color-nav-inactive': '#047857',
        }} className="bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark font-display antialiased overflow-hidden h-screen flex flex-col relative w-full">
            <ManagerHeader />

            <main className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden relative">
                <div className="flex-shrink-0 px-6 py-6 md:px-10 lg:px-40 border-b border-primary/10 bg-background-light/50 dark:bg-background-dark/50 backdrop-blur-sm z-10 w-full flex justify-center">
                    <div className="flex flex-wrap items-center justify-between gap-4 w-full max-w-[1200px]">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">Shift Schedule</h2>
                            <div className="flex items-center gap-3 text-text-secondary-light dark:text-text-secondary-dark font-semibold">
                                <button
                                    onClick={() => setWeekOffset(prev => prev - 1)}
                                    className="hover:bg-primary/20 p-1.5 rounded-full cursor-pointer transition-all active:scale-95 group"
                                >
                                    <span className="material-symbols-outlined text-[20px] group-hover:text-primary transition-colors">chevron_left</span>
                                </button>
                                <span className="text-sm uppercase tracking-[0.1em]">{currentWeekLabel}</span>
                                <button
                                    onClick={() => setWeekOffset(prev => prev + 1)}
                                    className="hover:bg-primary/20 p-1.5 rounded-full cursor-pointer transition-all active:scale-95 group"
                                >
                                    <span className="material-symbols-outlined text-[20px] group-hover:text-primary transition-colors">chevron_right</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-2xl border border-gray-200 dark:border-white/10 shadow-inner">
                                <button
                                    onClick={() => setViewMode('availability')}
                                    className={`px-4 py-2 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer ${viewMode === 'availability'
                                        ? 'bg-white shadow-md text-black font-black dark:bg-primary dark:text-black'
                                        : 'bg-transparent text-text-secondary-light font-bold hover:text-text-primary-light dark:text-white/40 dark:hover:text-white'
                                        }`}
                                >
                                    Availability
                                </button>
                                <button
                                    onClick={() => setViewMode('assignment')}
                                    className={`px-4 py-2 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer ${viewMode === 'assignment'
                                        ? 'bg-white shadow-md text-black font-black dark:bg-primary dark:text-black'
                                        : 'bg-transparent text-text-secondary-light font-bold hover:text-text-primary-light dark:text-white/40 dark:hover:text-white'
                                        }`}
                                >
                                    Assignment
                                </button>
                            </div>
                            <button
                                onClick={handleAutoSchedule}
                                disabled={isActioning || !activeRole}
                                className={`flex items-center justify-center rounded-2xl h-11 px-6 transition-all transform active:scale-95 text-xs uppercase tracking-[0.1em] font-black ${isActioning || !activeRole ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-primary/10 border border-primary/30 hover:bg-primary/30 text-text-primary-light dark:text-white shadow-lg shadow-primary/5'}`}
                            >
                                <span className="material-symbols-outlined mr-2 text-[20px]">magic_button</span>
                                {isActioning ? 'Running...' : 'Auto-Schedule'}
                            </button>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                disabled={!activeRole}
                                className={`flex items-center justify-center rounded-2xl h-11 px-6 shadow-xl transition-all transform active:scale-95 ${!activeRole ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-tr from-primary to-[#7fecc9] hover:brightness-110 shadow-primary/20 cursor-pointer'} text-text-primary-light text-xs uppercase tracking-[0.1em] font-black`}
                            >
                                <span className="material-symbols-outlined mr-2 text-[22px]">add_circle</span>
                                Create Shift
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-background-light dark:bg-background-dark w-full">
                    <div className="w-full flex justify-center px-6 py-8 md:px-10 lg:px-40 pb-20">
                        <div className="w-full max-w-[1200px] flex flex-col gap-6">
                            {viewMode === 'availability' ? (
                                <ManagerAvailabilityGrid
                                    shifts={shifts}
                                    activeRole={activeRole}
                                    weekDays={weekDays}
                                    onOpenStaffModal={handleOpenStaffModal}
                                    onOpenEditModal={handleOpenEditModal}
                                    onOpenDeleteModal={handleOpenDeleteModal}
                                />
                            ) : (
                                <ManagerAssignmentGrid
                                    shifts={shifts}
                                    activeRole={activeRole}
                                    weekDays={weekDays}
                                    onOpenAssignedStaffModal={handleOpenAssignedStaffModal}
                                    onOpenEditModal={handleOpenEditModal}
                                    onOpenDeleteModal={handleOpenDeleteModal}
                                />
                            )}

                            <div className="flex flex-wrap gap-4 items-center justify-start mt-6 pt-6 border-t border-primary/5">
                                <button
                                    onClick={handleCopyLastWeek}
                                    disabled={isActioning || !activeRole}
                                    className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/20 transition-all active:scale-95 text-text-primary-light dark:text-white font-black text-xs uppercase tracking-widest disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
                                    Copy Last Week
                                </button>
                                <button
                                    onClick={viewMode === 'assignment' ? handleClearAssignments : handleClearThisWeek}
                                    disabled={isActioning || !activeRole}
                                    className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-danger/20 bg-danger/5 hover:bg-danger/20 transition-all active:scale-95 text-danger font-black text-xs uppercase tracking-widest disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {viewMode === 'assignment' ? 'person_remove' : 'delete'}
                                    </span>
                                    {viewMode === 'assignment' ? 'Clear Assignments' : 'Clear All'}
                                </button>
                                {undoStack.length > 0 && (
                                    <button
                                        onClick={handleUndo}
                                        disabled={isActioning}
                                        className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all active:scale-95 text-text-primary-light dark:text-white font-black text-xs uppercase tracking-widest disabled:opacity-50 sm:ml-4 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">undo</span>
                                        Undo
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <AvailableStaffModal
                isOpen={isStaffModalOpen}
                shiftData={activeShiftData}
                onClose={() => { setIsStaffModalOpen(false); setActiveShiftData(null); }}
            />
            <AssignedStaffModal
                isOpen={isAssignedStaffModalOpen}
                shiftData={activeShiftData}
                onClose={() => { setIsAssignedStaffModalOpen(false); setActiveShiftData(null); }}
            />
            <EditShiftModal
                isOpen={isEditModalOpen}
                shiftData={activeShiftData}
                onSuccess={fetchData}
                onUndoableAction={(action) => setUndoStack(prev => [...prev, action])}
                onClose={() => { setIsEditModalOpen(false); setActiveShiftData(null); }}
            />
            <DeleteShiftModal
                isOpen={isDeleteModalOpen}
                shiftData={activeShiftData}
                onSuccess={fetchData}
                onUndoableAction={(action) => setUndoStack(prev => [...prev, action])}
                onClose={() => { setIsDeleteModalOpen(false); setActiveShiftData(null); }}
            />
            <CreateShiftModal
                isOpen={isCreateModalOpen}
                roleId={activeRole?.id}
                workspaceId={workspaceId}
                weekDays={weekDays}
                onSuccess={fetchData}
                onUndoableAction={(action) => setUndoStack(prev => [...prev, action])}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    )
}
