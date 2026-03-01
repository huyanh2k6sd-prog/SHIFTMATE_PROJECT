import React, { useState, useEffect } from 'react'
import { UserProfileSection } from '../components/UserProfileSection'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export function EmployeeRoleSelection() {
    const navigate = useNavigate()
    const { workspaceId } = useParams()
    const { user } = useAuth()
    const [copiedWorkspaceId, setCopiedWorkspaceId] = useState(false)
    const [requestedRoles, setRequestedRoles] = useState(new Set())

    // Data State
    const [workspace, setWorkspace] = useState(null)
    const [roles, setRoles] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchData = React.useCallback(async () => {
        setLoading(true);

        // 1. Fetch Workspace Details
        const { data: wsData } = await supabase
            .from('workspaces')
            .select('*')
            .eq('id', workspaceId)
            .single()

        if (wsData) setWorkspace(wsData)

        // 2. Fetch Roles
        const { data: rolesData } = await supabase
            .from('roles')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: true })

        if (rolesData) {
            const roleIds = rolesData.map(r => r.id);

            // Fetch Managers from workspace_members to exclude them
            const { data: managersData } = await supabase
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', workspaceId)
                .eq('role', 'MANAGER');
            const managerIds = new Set(managersData?.map(m => m.user_id) || []);

            // Fetch User Roles for counts
            // Also fetch is_manager flag to exclude manager role entries
            let employeeCounts = {};
            if (roleIds.length > 0) {
                const { data: urData } = await supabase
                    .from('user_roles')
                    .select('role_id, status, user_id, is_manager')
                    .in('role_id', roleIds)
                    .eq('status', 'approved');

                if (urData) {
                    urData.forEach(ur => {
                        if (!employeeCounts[ur.role_id]) employeeCounts[ur.role_id] = 0;
                        // Exclude: managers (via workspace_members), manager role assignments (is_manager flag), and the current user themselves
                        const isManager = managerIds.has(ur.user_id) || ur.is_manager === true;
                        const isSelf = ur.user_id === user.id;
                        if (!isManager && !isSelf) {
                            employeeCounts[ur.role_id]++;
                        }
                    });
                }
            }

            const formattedRoles = rolesData.map(r => ({
                id: r.id,
                name: r.name,
                icon: r.icon || 'work',
                color: r.color_theme || 'blue',
                employees: employeeCounts[r.id] || 0
            }))
            setRoles(formattedRoles)
        }

        // 3. Fetch User's Pending/Approved Requests for this workspace's roles
        const { data: userRolesData } = await supabase
            .from('user_roles')
            .select(`
                role_id,
                status
            `)
            .eq('user_id', user.id)

        if (userRolesData) {
            const requestedIds = new Set(userRolesData.map(ur => ur.role_id))
            setRequestedRoles(requestedIds)
        }

        setLoading(false)
    }, [workspaceId, user]);

    useEffect(() => {
        if (!workspaceId || !user) return;
        fetchData();

        // Listen for changes specifically on this user's user_roles rows
        const channel = supabase.channel(`role_approval_${user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'user_roles',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                // If this user's request got approved, auto-redirect to employee dashboard
                if (payload.new && payload.new.status === 'approved') {
                    navigate(`/employee/dashboard/${workspaceId}`);
                } else {
                    fetchData();
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'user_roles'
            }, () => {
                // Refresh counts when anyone gets inserted (new members)
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [workspaceId, user, fetchData, navigate]);

    const handleCopyWorkspaceId = () => {
        if (!workspace?.join_code) return;
        navigator.clipboard.writeText(workspace.join_code)
        setCopiedWorkspaceId(true)
        setTimeout(() => setCopiedWorkspaceId(false), 2000)
    }

    const handleRequestAccess = async (roleId) => {
        // Optimistic UI Update
        setRequestedRoles(prev => {
            const next = new Set(prev)
            next.add(roleId)
            return next
        })

        const roleName = roles.find(r => r.id === roleId)?.name || 'Unknown Role';
        const employeeName = user.user_metadata?.full_name || 'A user';

        // 1. Purge any old requests/memberships for this exact role for this user
        // (This relies on the new RLS policy allowing users to delete their own user_roles)
        await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', user.id)
            .eq('role_id', roleId);

        // 2. Insert into database
        const { data: insertedRole, error } = await supabase
            .from('user_roles')
            .insert({
                user_id: user.id,
                role_id: roleId,
                status: 'pending'
            })
            .select('id')
            .single()

        if (!error && insertedRole) {
            // Send notification to the workspace manager
            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: workspace?.manager_id,
                type: 'role_request',
                title: 'New Role Request',
                message: `${employeeName} (ID: ${user.id.substring(0, 8)}...) requested access to "${roleName}" in ${workspace?.name || 'your workspace'}.`,
                reference_id: insertedRole.id
            })
            if (notifError) {
                console.error('Notification insert error:', notifError);
            }
        } else if (error) {
            console.error("Error requesting role access:", error)
            // Revert state if error
            setRequestedRoles(prev => {
                const next = new Set(prev)
                next.delete(roleId)
                return next
            })
        }
    }

    if (loading) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
            </div>
        )
    }

    return (
        <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col transition-colors duration-200">
            <header className="flex-shrink-0 h-16 bg-[#ffffff] dark:bg-[#162e25] border-b border-[#e6f4ef] dark:border-slate-800 flex items-center justify-between px-6 z-20 w-full relative">
                <div className="flex items-center gap-2 w-48">
                    <button onClick={() => navigate('/workspace')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-600 dark:text-slate-300" aria-label="Go back">
                        <span className="material-symbols-outlined text-[18px]">arrow_back_ios_new</span>
                    </button>
                    <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <div
                        onClick={() => navigate('/workspace')}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                        <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">ShiftMate</span>
                    </div>
                </div>

                <div className="hidden md:flex flex-1"></div>

                <div className="flex items-center gap-4 w-48 justify-end">
                    <UserProfileSection role="Employee" />
                </div>
            </header>
            <main className="flex-1 flex justify-center w-full px-4 py-8 lg:px-8">
                <div className="w-full max-w-[1280px] flex flex-col gap-8">
                    <div className="flex flex-col items-center justify-center gap-2 mb-4 text-center">
                        <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">Select Your Role</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-base font-medium">Choose a role to request access and view available shifts for your schedule.</p>
                        {workspace && (
                            <p className="text-primary-dark dark:text-primary font-bold">{workspace.name}</p>
                        )}
                    </div>
                    {roles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                            <span className="material-symbols-outlined text-5xl mb-4 text-slate-300 dark:text-slate-600">work_off</span>
                            <p className="text-lg">No roles have been created for this workspace yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                            {roles.map(role => (
                                <div key={role.id} className="bg-white dark:bg-[#1a2e26] rounded-2xl p-8 hover:shadow-lg transition-all duration-300 border border-[#e6f4ef] dark:border-slate-800 flex flex-col items-center group text-center relative shadow-[0_4px_20px_-2px_rgba(153,255,218,0.15)]">

                                    <div className={`w-16 h-16 rounded-full bg-${role.color}-50 dark:bg-${role.color}-900/30 flex items-center justify-center text-${role.color}-600 dark:text-${role.color}-400 mb-4`}>
                                        <span className="material-symbols-outlined text-3xl">{role.icon}</span>
                                    </div>
                                    <h3 className="text-slate-900 dark:text-white text-2xl font-bold mb-6">{role.name}</h3>
                                    <div className="flex items-center justify-center gap-2 mb-8 text-slate-500 dark:text-slate-400 font-bold text-lg">
                                        <span className="material-symbols-outlined text-xl">group</span>
                                        <span>{role.employees} Employees</span>
                                    </div>
                                    <div className="w-full pt-4 border-t border-[#e6f4ef] dark:border-slate-800/50 mt-auto">
                                        {requestedRoles.has(role.id) ? (
                                            <button
                                                disabled
                                                className="w-full h-11 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-not-allowed"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">pending</span>
                                                <span>Pending Approval</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleRequestAccess(role.id)}
                                                className="w-full h-11 bg-primary hover:bg-[#80e5c3] text-slate-900 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <span>Request Access</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
