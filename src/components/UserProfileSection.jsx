import React, { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { UserProfileModal } from './UserProfileModal'
import { AllNotificationsModal } from './AllNotificationsModal'
import { SwapSelectionModal } from './SwapSelectionModal'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils'
import { formatLocalDate, getDurationHours, formatTime } from '../utils/timeFormat'

function formatTimeAgo(dateString) {
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

function getNotificationIcon(type) {
    switch (type) {
        case 'role_request': return { icon: 'person_add', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' };
        case 'swap_request': return { icon: 'swap_horiz', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' };
        case 'absence_request': return { icon: 'event_busy', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' };
        case 'assignment_alert': return { icon: 'assignment_ind', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' };
        case 'swap_accepted': return { icon: 'check_circle', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' };
        case 'system': return { icon: 'settings', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
        default: return { icon: 'notifications', color: 'bg-primary/20 text-primary-dark dark:text-primary' };
    }
}

export function UserProfileSection({ name, role = "", workspaceRoleName }) {
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const displayName = name || profile?.full_name || user?.user_metadata?.full_name || 'User'
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false)
    const [isAllNotificationsModalOpen, setIsAllNotificationsModalOpen] = useState(false)
    const [swapSelectionNotif, setSwapSelectionNotif] = useState(null)

    const formatRoleName = (roleStr) => {
        if (!roleStr) return null;
        return (
            <span className="text-sm font-bold tracking-tight text-teal-700 dark:text-[#98FFD9]">
                {roleStr}
            </span>
        )
    }

    // Notifications State
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loadingNotifications, setLoadingNotifications] = useState(true)
    const [processingNotifId, setProcessingNotifId] = useState(null)

    useEffect(() => {
        if (!user) return;

        const fetchNotifications = async () => {
            setLoadingNotifications(true);
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (!error && data) {
                // Enrich swap_request notifications with offer count
                const enriched = await Promise.all(data.map(async (notif) => {
                    if (notif.type === 'swap_request' && notif.reference_id && !notif.message?.includes('no longer valid') && !notif.message?.includes('✅') && !notif.message?.includes('❌')) {
                        try {
                            const { data: baseReq } = await supabase.from('shift_requests')
                                .select('shift_id, requester_id')
                                .eq('id', notif.reference_id).single();
                            if (baseReq) {
                                const { data: related } = await supabase.from('shift_requests')
                                    .select('id')
                                    .eq('shift_id', baseReq.shift_id)
                                    .eq('requester_id', baseReq.requester_id)
                                    .eq('type', 'swap')
                                    .neq('status', 'completed');
                                return { ...notif, _swapOfferCount: related?.length || 1 };
                            }
                        } catch (e) { /* ignore */ }
                    }
                    return notif;
                }));
                setNotifications(enriched);
                setUnreadCount(enriched.filter(n => !n.is_read).length);
            }
            setLoadingNotifications(false);
        };

        fetchNotifications();

        // Subscribe to real-time notification changes
        const channel = supabase.channel('user_notifications')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const handleMarkAllRead = async () => {
        if (!user || unreadCount === 0) return;

        // Optimistic update
        setUnreadCount(0);
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
    }

    const handleClearRead = async () => {
        if (!user) return;

        // Optimistic update
        setNotifications(notifications.filter(n => !n.is_read));

        await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.id)
            .eq('is_read', true);
    }

    const handleNotificationClick = async (notif) => {
        // Mark as read if it isn't
        if (!notif.is_read) {
            setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));

            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notif.id);
        }

        // Navigate if there's an action URL
        if (notif.action_url) {
            setIsNotificationsDropdownOpen(false);
            navigate(notif.action_url);
        }
    }

    const handleAcceptRoleRequest = async (notif) => {
        setProcessingNotifId(notif.id);
        try {
            // reference_id is the user_role_id
            const userRoleId = notif.reference_id;

            // Fetch the user_role entry to get requester info
            const { data: userRole, error: fetchError } = await supabase
                .from('user_roles')
                .select('*, roles(name, workspace_id, workspaces:workspace_id(name))')
                .eq('id', userRoleId)
                .single();

            if (fetchError || !userRole) {
                console.error("Could not find user role:", fetchError);
                setProcessingNotifId(null);
                return;
            }

            // Update user_role status to approved
            const { error: updateError } = await supabase
                .from('user_roles')
                .update({ status: 'approved' })
                .eq('id', userRoleId);

            if (updateError) {
                console.error("Error approving role:", updateError);
                setProcessingNotifId(null);
                return;
            }

            // Mark this notification as read and update message
            await supabase
                .from('notifications')
                .update({ is_read: true, message: notif.message + ' ✅ Approved.' })
                .eq('id', notif.id);

            // Send notification to the employee
            const roleName = userRole.roles?.name || 'a role';
            const workspaceName = userRole.roles?.workspaces?.name || 'the workspace';
            const wsId = userRole.roles?.workspace_id;

            await supabase.from('notifications').insert({
                user_id: userRole.user_id,
                type: 'system',
                title: 'Role Request Approved ✅',
                message: `Your request to join "${roleName}" in ${workspaceName} has been approved! You can now view shifts and submit availability.`,
                reference_id: userRoleId
            });

            // Optimistic UI update
            setNotifications(prev => prev.map(n =>
                n.id === notif.id
                    ? { ...n, is_read: true, message: n.message + ' ✅ Approved.', _handled: true }
                    : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Error accepting role request:", err);
        }
        setProcessingNotifId(null);
    }

    const handleRejectRoleRequest = async (notif) => {
        setProcessingNotifId(notif.id);
        try {
            const userRoleId = notif.reference_id;

            // Fetch the user_role entry to get requester info
            const { data: userRole, error: fetchError } = await supabase
                .from('user_roles')
                .select('*, roles(name, workspace_id, workspaces:workspace_id(name))')
                .eq('id', userRoleId)
                .single();

            if (fetchError || !userRole) {
                console.error("Could not find user role:", fetchError);
                setProcessingNotifId(null);
                return;
            }

            // Delete the user_role entry (reject)
            const { error: deleteError } = await supabase
                .from('user_roles')
                .delete()
                .eq('id', userRoleId);

            if (deleteError) {
                console.error("Error rejecting role:", deleteError);
                setProcessingNotifId(null);
                return;
            }

            // Mark this notification as read and update message
            await supabase
                .from('notifications')
                .update({ is_read: true, message: notif.message + ' ❌ Rejected.' })
                .eq('id', notif.id);

            // Send notification to the employee
            const roleName = userRole.roles?.name || 'a role';
            const workspaceName = userRole.roles?.workspaces?.name || 'the workspace';

            await supabase.from('notifications').insert({
                user_id: userRole.user_id,
                type: 'system',
                title: 'Role Request Rejected ❌',
                message: `Your request to join "${roleName}" in ${workspaceName} has been rejected by the manager.`,
                reference_id: userRoleId
            });

            // Optimistic UI update
            setNotifications(prev => prev.map(n =>
                n.id === notif.id
                    ? { ...n, is_read: true, message: n.message + ' ❌ Rejected.', _handled: true }
                    : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Error rejecting role request:", err);
        }
        setProcessingNotifId(null);
    }


    /* ---- ABSENCE REQUEST: Manager Accept ---- */
    const handleAcceptAbsenceRequest = async (notif) => {
        setProcessingNotifId(notif.id);
        try {
            const requestId = notif.reference_id;
            const { data: req } = await supabase
                .from('shift_requests')
                .select('requester_id, shift_id, reason, shifts:shift_id(id, name, date, start_time, end_time, role_id, roles:role_id(workspace_id, min_hours_per_week, max_hours_per_week))')
                .eq('id', requestId).single();

            if (!req) throw new Error('Absence request not found');

            await supabase.from('shift_requests').update({ status: 'pending_staff', approved_by_manager: true }).eq('id', requestId);

            // IMMEDIATELY remove the requester's assignment from the schedule upon manager approval
            await supabase.from('shift_assignments').delete().eq('shift_id', req.shift_id).eq('user_id', req.requester_id);

            // Normalize shift times from ISO timestamps to plain HH:mm for comparison with availabilities
            const ft = formatTime; // alias for brevity
            const shiftStartNorm = ft(req.shifts.start_time);  // e.g. "2026-03-03 12:00:00+00" -> "19:00"
            const shiftEndNorm = ft(req.shifts.end_time);

            // Remove the requester from availabilities for this exact shift slot
            // We must fetch and filter because availabilities TIME format differs from shifts
            const { data: reqAvails } = await supabase.from('availabilities')
                .select('id, start_time, end_time')
                .eq('user_id', req.requester_id)
                .eq('date', req.shifts.date)
                .eq('role_id', req.shifts.role_id);

            const matchingAvailIds = (reqAvails || [])
                .filter(a => ft(a.start_time) === shiftStartNorm && ft(a.end_time) === shiftEndNorm)
                .map(a => a.id);

            if (matchingAvailIds.length > 0) {
                await supabase.from('availabilities').delete().in('id', matchingAvailIds);
            }

            await supabase.from('notifications').update({ is_read: true, message: notif.message + ' ✅ Approved.' }).eq('id', notif.id);
            // Notify requester
            const { data: reqProfile } = await supabase.from('profiles').select('full_name').eq('id', req.requester_id).single();
            const reqName = reqProfile?.full_name || 'You';
            await supabase.from('notifications').insert({
                user_id: req.requester_id,
                type: 'system',
                title: 'Absence Approved ✅',
                message: `Your absence for "${req.shifts?.name}" (${req.shifts?.date}) has been approved by the manager. Looking for coverage.`,
                reference_id: requestId,
            });

            // Find available staff for that shift's date, role, AND TIME
            const shiftRoleId = req.shifts.role_id;
            const shiftDate = req.shifts.date;
            const wsId = req.shifts.roles?.workspace_id;

            // Pre-compute week boundaries ONCE (optimization: was inside filter loop before)
            const _d = new Date(shiftDate + 'T12:00:00');
            const _dow = _d.getDay();
            const _diffMon = _d.getDate() - _dow + (_dow === 0 ? -6 : 1);
            const _monday = new Date(_d); _monday.setDate(_diffMon);
            const weekStartStr = formatLocalDate(_monday);
            const _sunday = new Date(_monday); _sunday.setDate(_monday.getDate() + 6);
            const weekEndStr = formatLocalDate(_sunday);

            console.log('[Absence] Searching for available staff:', { shiftDate, shiftRoleId, wsId, shiftStartNorm, shiftEndNorm });

            // Query all availabilities for this date+role (do NOT filter by time in SQL due to format mismatch)
            const [{ data: allAvails }, { data: wsMembers }, { data: allShifts }] = await Promise.all([
                supabase.from('availabilities')
                    .select('user_id, start_time, end_time')
                    .eq('date', shiftDate)
                    .eq('role_id', shiftRoleId),
                supabase.from('workspace_members').select('user_id').eq('workspace_id', wsId).neq('user_id', req.requester_id),
                supabase.from('shifts').select('id, start_time, end_time, date, role_id')
                    .eq('role_id', shiftRoleId)
                    .gte('date', weekStartStr)
                    .lte('date', weekEndStr)
            ]);

            // Fetch assignments only for this week's shifts (optimization: was unfiltered before)
            const weekShiftIds = (allShifts || []).map(s => s.id);
            const { data: allAssignments } = weekShiftIds.length > 0
                ? await supabase.from('shift_assignments').select('shift_id, user_id').in('shift_id', weekShiftIds)
                : { data: [] };

            console.log('[Absence] Raw avails:', allAvails?.length, 'wsMembers:', wsMembers?.length);

            // Filter availabilities by matching normalized time
            const timeMatchedAvails = (allAvails || []).filter(a => {
                return ft(a.start_time) === shiftStartNorm && ft(a.end_time) === shiftEndNorm;
            });

            console.log('[Absence] Time-matched avails:', timeMatchedAvails.length);

            const wsMemberIds = new Set((wsMembers || []).map(m => m.user_id));
            // Deduplicate and filter: must be workspace member, not the requester
            const seenUserIds = new Set();
            const availableStaffBase = timeMatchedAvails.filter(a => {
                if (!wsMemberIds.has(a.user_id) || a.user_id === req.requester_id) return false;
                if (seenUserIds.has(a.user_id)) return false;
                seenUserIds.add(a.user_id);
                return true;
            });

            console.log('[Absence] Available staff after workspace filter:', availableStaffBase.length);

            // Calculate weekly hours and check for overlaps
            // allShifts is already filtered to this week by the query above
            const weekShifts = allShifts || [];

            const userWeeklyHours = {};
            (allAssignments || []).forEach(a => {
                const shift = weekShifts.find(s => s.id === a.shift_id);
                if (shift) {
                    const dur = getDurationHours(shift.start_time, shift.end_time);
                    userWeeklyHours[a.user_id] = (userWeeklyHours[a.user_id] || 0) + dur;
                }
            });

            const durReq = getDurationHours(req.shifts.start_time, req.shifts.end_time);
            const maxH = req.shifts.roles?.max_hours_per_week || 999;

            const finalStaff = availableStaffBase.filter(a => {
                // EXCLUDE if already assigned to a shift that OVERLAPS with this one on the same day
                const hasOverlap = (allAssignments || []).some(assign => {
                    if (assign.user_id !== a.user_id) return false;
                    const shift = weekShifts.find(s => s.id === assign.shift_id);
                    if (!shift || shift.date !== shiftDate) return false;
                    const assignStart = ft(shift.start_time);
                    const assignEnd = ft(shift.end_time);
                    return (shiftStartNorm < assignEnd && shiftEndNorm > assignStart);
                });
                if (hasOverlap) return false;

                const newHours = (userWeeklyHours[a.user_id] || 0) + durReq;
                if (newHours > maxH) return false;
                return true;
            });

            console.log('[Absence] Final staff after overlap/hours filter:', finalStaff.length);

            const staffNotifs = finalStaff.map(a => ({
                user_id: a.user_id,
                type: 'absence_request',
                title: `Shift Coverage Needed — ${reqName}`,
                message: `${reqName} is absent for shift "${req.shifts?.name}" on ${shiftDate} (${durReq}h). Would you like to cover this shift?`,
                reference_id: requestId,
                is_read: false,
            }));

            console.log('[Absence] Sending notifications to', staffNotifs.length, 'staff');
            if (staffNotifs.length > 0) {
                const { error: insertErr } = await supabase.from('notifications').insert(staffNotifs);
                if (insertErr) console.error("[Absence] Error inserting staff notifications:", insertErr);
                else {
                    console.log("[Absence] Staff notifications successfully inserted!");
                    alert(`Absence approved. Cover request sent to ${staffNotifs.length} available employee(s).`);
                }
            } else {
                console.warn("[Absence] No eligible staff found for coverage.");
                alert('Absence approved, but no eligible employees are available to cover this shift. Please assign manually.');
            }

            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true, _handled: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            window.dispatchEvent(new Event('shiftmate:refresh'));
        } catch (err) { console.error('Error accepting absence:', err); }
        setProcessingNotifId(null);
    };

    /* ---- ABSENCE REQUEST: Manager Reject ---- */
    const handleRejectAbsenceRequest = async (notif) => {
        setProcessingNotifId(notif.id);
        try {
            const requestId = notif.reference_id;
            const { data: req } = await supabase.from('shift_requests').select('requester_id, shifts:shift_id(name)').eq('id', requestId).single();
            await supabase.from('shift_requests').update({ status: 'rejected' }).eq('id', requestId);
            await supabase.from('notifications').update({ is_read: true, message: notif.message + ' ❌ Rejected.' }).eq('id', notif.id);
            if (req) {
                await supabase.from('notifications').insert({
                    user_id: req.requester_id,
                    type: 'system',
                    title: 'Absence Request Rejected ❌',
                    message: `Your absence request for "${req.shifts?.name}" was rejected by the manager. Your shift remains scheduled.`,
                    reference_id: requestId,
                });
            }
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true, _handled: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) { console.error('Error rejecting absence:', err); }
        setProcessingNotifId(null);
    };

    /* ---- STAFF: Accept swap/absence coverage ---- */
    const handleStaffAcceptAction = async (notif) => {
        setProcessingNotifId(notif.id);
        try {
            const requestId = notif.reference_id;
            const { data: req } = await supabase
                .from('shift_requests')
                .select('type, shift_id, requester_id, status, accepted_by_user_id, offered_shift_id')
                .eq('id', requestId).single();

            if (!req || req.status === 'completed') {
                // Already handled
                await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true, _handled: true } : n));
                setProcessingNotifId(null);
                return;
            }

            // Prevent requester from accepting their own swap request
            if (req.type === 'swap' && req.requester_id === user.id) {
                await supabase.from('notifications').update({ is_read: true, message: notif.message + ' (Cannot accept your own request)' }).eq('id', notif.id);
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true, _handled: true } : n));
                setProcessingNotifId(null);
                return;
            }

            // Process the swap or absence securely via RPC (bypassing RLS for other users' notifications)
            const { data: success, error: rpcErr } = await supabase.rpc('process_shift_swap', {
                p_request_id: requestId,
                p_acceptor_id: user.id
            });

            if (rpcErr) {
                console.error("RPC Error processing swap/absence:", rpcErr);
                throw rpcErr;
            }

            if (!success) {
                // The request was already completed, invalid, or it was the user's own request
                await supabase.from('notifications').update({ is_read: true, message: notif.message + ' (This request is no longer valid or cannot be accepted by you)' }).eq('id', notif.id);
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true, _handled: true } : n));
                setProcessingNotifId(null);
                return;
            }

            // Mark current user's notification as handled
            await supabase.from('notifications').update({ is_read: true, message: notif.message + ' ✅ You accepted.' }).eq('id', notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true, _handled: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            // Signal any open dashboard to refresh
            window.dispatchEvent(new Event('shiftmate:refresh'));
        } catch (err) {
            console.error('Error accepting shift action:', err);
        } finally {
            setProcessingNotifId(null);
        }
    };

    /* ---- Dispatcher ---- */
    const handleAccept = async (notif) => {
        if (notif.type === 'role_request') return handleAcceptRoleRequest(notif);

        // Swap requests: check if multiple shifts are offered — if so, open selection popup
        if (notif.type === 'swap_request') {
            try {
                // Find the base request to get shift_id & requester_id
                const { data: baseReq } = await supabase.from('shift_requests')
                    .select('shift_id, requester_id')
                    .eq('id', notif.reference_id).single();

                if (baseReq) {
                    // Count how many related pending swap requests exist
                    const { data: relatedReqs } = await supabase.from('shift_requests')
                        .select('id')
                        .eq('shift_id', baseReq.shift_id)
                        .eq('requester_id', baseReq.requester_id)
                        .eq('type', 'swap')
                        .neq('status', 'completed');

                    if (relatedReqs && relatedReqs.length > 1) {
                        // Multiple shifts offered — open selection popup
                        setSwapSelectionNotif(notif);
                        return;
                    }
                }
            } catch (e) {
                console.error('Error checking swap options:', e);
            }
            // Single shift or error — accept directly
            return handleStaffAcceptAction(notif);
        }

        try {
            const { data: req } = await supabase.from('shift_requests').select('status').eq('id', notif.reference_id).single();

            if (notif.type === 'absence_request') {
                if (req?.status === 'pending_manager') {
                    return handleAcceptAbsenceRequest(notif);
                } else {
                    return handleStaffAcceptAction(notif);
                }
            }
            return handleStaffAcceptAction(notif);
        } catch (e) {
            console.error(e);
        }
    };

    const handleReject = async (notif) => {
        if (notif.type === 'role_request') return handleRejectRoleRequest(notif);
        if (notif.type === 'swap_request') {
            // Staff rejecting a swap opportunity
            await supabase.from('notifications').update({ is_read: true, message: notif.message + ' ❌ Rejected.' }).eq('id', notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true, _handled: true } : n));
            return;
        }

        if (notif.type === 'absence_request') {
            try {
                const requestId = notif.reference_id;
                const { data: req } = await supabase
                    .from('shift_requests')
                    .select('status, requester_id, shift_id, shifts:shift_id(name, date, workspace_id)')
                    .eq('id', requestId)
                    .single();

                if (req?.status === 'pending_manager') {
                    // Manager rejecting the original request
                    return handleRejectAbsenceRequest(notif);
                } else {
                    // Staff rejecting the coverage opportunity
                    await supabase.from('notifications').update({ is_read: true, message: notif.message + ' ❌ Rejected.' }).eq('id', notif.id);

                    // Update local state immediately for better UX
                    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true, _handled: true } : n));
                    setUnreadCount(prev => Math.max(0, prev - 1));

                    // Check if all others also rejected
                    if (req?.status === 'pending_staff') {
                        const { count } = await supabase
                            .from('notifications')
                            .select('*', { count: 'exact', head: true })
                            .eq('reference_id', requestId)
                            .eq('type', 'absence_request')
                            .eq('is_read', false);

                        if (count === 0) {
                            // Notify managers that coverage failed
                            const { data: requesterProfile } = await supabase.from('profiles').select('full_name').eq('id', req.requester_id).single();
                            const requesterName = requesterProfile?.full_name || 'An employee';

                            const { data: managers } = await supabase
                                .from('workspace_members')
                                .select('user_id')
                                .eq('workspace_id', req.shifts?.workspace_id)
                                .in('role', ['manager', 'MANAGER']);

                            if (managers && managers.length > 0) {
                                const managerNotifs = managers.map(m => ({
                                    user_id: m.user_id,
                                    type: 'system',
                                    title: 'Coverage Failed ❌',
                                    message: `No employees are available to cover ${requesterName}'s absence for "${req.shifts?.name}" on ${req.shifts?.date}. Please manually assign or contact staff.`,
                                    reference_id: requestId,
                                }));
                                await supabase.from('notifications').insert(managerNotifs);
                            }
                        }
                    }
                    return;
                }
            } catch (e) { console.error('Error in handleReject absence:', e); }
        }
    };

    return (
        <div className="flex items-center gap-2 sm:gap-4 justify-end">
            <div className="relative">
                <button
                    onClick={() => setIsNotificationsDropdownOpen(!isNotificationsDropdownOpen)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors focus:outline-none ${isNotificationsDropdownOpen ? 'bg-black/5 dark:bg-white/10 text-[#059669] dark:text-[#34d399]' : 'text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#059669] dark:hover:text-[#34d399]'}`}
                >
                    <Bell size={24} />
                </button>
                {/* Red dot to indicate new notifications */}
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#162e25]"></span>
                )}

                {isNotificationsDropdownOpen && (
                    <div className="absolute right-0 top-full mt-4 w-[420px] bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-100 dark:border-neutral-700 z-50 overflow-hidden ring-1 ring-black/5">
                        <div className="p-4 border-b border-neutral-100 dark:border-neutral-700/50 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-800">
                            <h3 className="font-bold text-neutral-900 dark:text-white text-sm">Notifications</h3>
                            <div className="flex gap-3 items-center">
                                {unreadCount > 0 && (
                                    <button onClick={handleMarkAllRead} className="text-xs text-[#059669] dark:text-[#34d399] font-semibold hover:underline">Mark all read</button>
                                )}
                                {notifications.some(n => n.is_read) && (
                                    <button onClick={handleClearRead} className="text-xs text-red-500 dark:text-red-400 font-semibold hover:underline flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                        Clear read
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[500px] overflow-y-auto overflow-x-hidden">
                            {loadingNotifications ? (
                                <div className="p-8 flex justify-center items-center">
                                    <span className="animate-spin material-symbols-outlined text-primary-dark dark:text-primary">progress_activity</span>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 flex flex-col items-center text-center gap-3">
                                    <div className="size-12 rounded-full bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center text-neutral-400">
                                        <span className="material-symbols-outlined text-2xl">notifications_off</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-bold text-neutral-900 dark:text-white">No new notifications</p>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">When you get updates, they'll appear here.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {notifications.map(notif => {
                                        const style = getNotificationIcon(notif.type);
                                        const isRoleRequest = notif.type === 'role_request' && !notif._handled && !notif.message?.includes('✅') && !notif.message?.includes('❌');
                                        const isProcessing = processingNotifId === notif.id;

                                        return (
                                            <div
                                                key={notif.id}
                                                className={`p-4 border-b border-neutral-100 dark:border-neutral-700/50 flex gap-3 transition-colors ${!isRoleRequest && notif.action_url ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/30' : ''} ${!notif.is_read ? 'bg-primary/5 dark:bg-primary/5' : ''}`}
                                                onClick={() => !isRoleRequest && handleNotificationClick(notif)}
                                            >
                                                <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${style.color}`}>
                                                    <span className="material-symbols-outlined text-xl">{style.icon}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <p className={`text-sm ${!notif.is_read ? 'font-bold text-neutral-900 dark:text-white' : 'font-semibold text-neutral-800 dark:text-neutral-200'}`}>
                                                            {notif.title}
                                                        </p>
                                                        <span className="text-xs font-medium text-neutral-400 ml-auto whitespace-nowrap">{formatTimeAgo(notif.created_at)}</span>
                                                    </div>
                                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 break-words whitespace-normal leading-snug">
                                                        {notif.message}
                                                    </p>

                                                    {/* Accept/Reject buttons for actionable requests */}
                                                    {(isRoleRequest || (notif.reference_id && (notif.type === 'swap_request' || notif.type === 'absence_request'))) && (() => {
                                                        const isHandled = notif._handled || notif.message?.includes('✅') || notif.message?.includes('❌') || notif.message?.includes('no longer valid');
                                                        const isDisabled = isProcessing || isHandled;

                                                        return (
                                                            <div className="flex gap-2 mt-3">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleAccept(notif); }}
                                                                    disabled={isDisabled}
                                                                    className={`px-4 py-1.5 ${isDisabled ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500' : (notif.type === 'absence_request' || notif.type === 'swap_request' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-primary hover:bg-primary-hover text-slate-900')} text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm disabled:cursor-not-allowed`}
                                                                >
                                                                    {isProcessing ? (
                                                                        <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                                                    ) : (
                                                                        <span className="material-symbols-outlined text-sm">check</span>
                                                                    )}
                                                                    {notif.type === 'swap_request' ? (notif._swapOfferCount > 1 ? 'Select Swap Shift' : 'Accept') : 'Accept'}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleReject(notif); }}
                                                                    disabled={isDisabled}
                                                                    className={`px-4 py-1.5 ${isDisabled ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 opacity-70' : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300'} text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 disabled:cursor-not-allowed`}
                                                                >
                                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                {!notif.is_read && (
                                                    <div className="w-2 flex justify-center mt-2 shrink-0">
                                                        <div className="size-2 rounded-full bg-primary-dark dark:bg-primary"></div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 border-t border-neutral-100 dark:border-neutral-700/50 text-center">
                            <button
                                onClick={() => {
                                    setIsNotificationsDropdownOpen(false);
                                    setIsAllNotificationsModalOpen(true);
                                }}
                                className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-[#059669] dark:hover:text-[#34d399] transition-colors"
                            >
                                View All Notifications
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {workspaceRoleName && (
                <div className="hidden sm:block ml-2 mr-2">
                    {formatRoleName(workspaceRoleName)}
                </div>
            )}

            <div className="flex items-center gap-3 ml-1 sm:ml-2">
                <div className="hidden sm:flex flex-col items-end justify-center">
                    <span className="text-sm font-bold text-black dark:text-white leading-tight whitespace-nowrap">{displayName}</span>
                    {role && (
                        <span className="text-xs font-normal text-[#059669] dark:text-[#34d399] capitalize whitespace-nowrap">{role}</span>
                    )}
                </div>
                <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="rounded-full w-10 h-10 ring-2 ring-[#059669]/20 hover:ring-[#059669]/60 transition-all cursor-pointer focus:outline-none overflow-hidden flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: getAvatarColor(displayName) }}
                >
                    {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-white font-bold text-sm tracking-wider">
                            {getAvatarInitials(displayName)}
                        </span>
                    )}
                </button>
            </div>
            <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
            <AllNotificationsModal
                isOpen={isAllNotificationsModalOpen}
                onClose={() => setIsAllNotificationsModalOpen(false)}
                unreadCount={unreadCount}
                onMarkAllRead={handleMarkAllRead}
                onClearRead={handleClearRead}
                notifications={notifications}
                onAccept={handleAccept}
                onReject={handleReject}
                processingNotifId={processingNotifId}
                onNotificationClick={handleNotificationClick}
            />
            <SwapSelectionModal
                isOpen={!!swapSelectionNotif}
                onClose={() => setSwapSelectionNotif(null)}
                notification={swapSelectionNotif}
                onAcceptShift={handleStaffAcceptAction}
            />
        </div >
    )
}
