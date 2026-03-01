import React, { useState, useEffect } from 'react'
import { UserProfileSection } from '../components/UserProfileSection'
import { useNavigate, useParams } from 'react-router-dom'
import { RoleOptionsMenu } from '../components/RoleOptionsMenu'
import { RoleRenameModal } from '../components/RoleRenameModal'
import { RoleStaffListModal } from '../components/RoleStaffListModal'
import { RoleDeleteModal } from '../components/RoleDeleteModal'
import { RoleRequestsModal } from '../components/RoleRequestsModal'
import { CreateRoleModal } from '../components/CreateRoleModal'
import { supabase } from '../lib/supabase'
import { formatLocalDate } from '../utils/timeFormat'

export function ManagerRoleManagement() {
    const navigate = useNavigate()
    const { workspaceId } = useParams()

    // UI State
    const [activeMenuRole, setActiveMenuRole] = useState(null)
    const [renameModalRole, setRenameModalRole] = useState(null)
    const [staffListModalRole, setStaffListModalRole] = useState(null)
    const [deleteModalRole, setDeleteModalRole] = useState(null)
    const [requestsModalRole, setRequestsModalRole] = useState(null)
    const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false)
    const [copiedWorkspaceId, setCopiedWorkspaceId] = useState(false)

    // Data State
    const [workspace, setWorkspace] = useState(null)
    const [roles, setRoles] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!workspaceId) return;

        const fetchData = async () => {
            setLoading(true);

            // 1. Fetch Workspace Details
            const { data: wsData, error: wsError } = await supabase
                .from('workspaces')
                .select('*')
                .eq('id', workspaceId)
                .single()

            if (wsError) {
                console.error("Error fetching workspace:", wsError)
            } else {
                setWorkspace(wsData)
            }

            // 2. Fetch Roles for this Workspace
            fetchRoles()
        }

        fetchData()

        // 3. Subscribe to Role Changes
        const channel = supabase.channel(`public:roles:workspace_id=eq.${workspaceId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'roles',
                filter: `workspace_id=eq.${workspaceId}`
            }, () => {
                fetchRoles()
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_roles'
            }, () => {
                fetchRoles()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [workspaceId])

    const fetchRoles = async () => {
        const { data: rolesData, error: rolesError } = await supabase
            .from('roles')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: true })

        if (!rolesError && rolesData) {
            const roleIds = rolesData.map(r => r.id);

            // Fetch Managers to exclude them from employee counts
            const { data: managersData } = await supabase
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', workspaceId)
                .eq('role', 'MANAGER');
            const managerIds = new Set(managersData?.map(m => m.user_id) || []);

            // Fetch User Roles to count employees and pending requests
            let userRolesCounts = {};
            if (roleIds.length > 0) {
                const { data: urData } = await supabase
                    .from('user_roles')
                    .select('role_id, status, user_id')
                    .in('role_id', roleIds);

                if (urData) {
                    urData.forEach(ur => {
                        if (!userRolesCounts[ur.role_id]) {
                            userRolesCounts[ur.role_id] = { employees: 0, pending: 0 };
                        }
                        if (ur.status === 'approved' && !managerIds.has(ur.user_id)) {
                            userRolesCounts[ur.role_id].employees++;
                        }
                        if (ur.status === 'pending') {
                            userRolesCounts[ur.role_id].pending++;
                        }
                    });
                }
            }

            // Fetch Shifts for this week to count shiftsPerWeek
            let shiftsCounts = {};
            if (roleIds.length > 0) {
                const d = new Date();
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(d.setDate(diff));
                const nextMonday = new Date(monday);
                nextMonday.setDate(monday.getDate() + 7);

                const wkStartStr = formatLocalDate(monday);
                const wkEndStr = formatLocalDate(nextMonday);

                const { data: shData } = await supabase
                    .from('shifts')
                    .select('role_id')
                    .in('role_id', roleIds)
                    .gte('date', wkStartStr)
                    .lt('date', wkEndStr);

                if (shData) {
                    shData.forEach(sh => {
                        shiftsCounts[sh.role_id] = (shiftsCounts[sh.role_id] || 0) + 1;
                    });
                }
            }

            // Transform data to match UI expectations
            const formattedRoles = rolesData.map(role => {
                const counts = userRolesCounts[role.id] || { employees: 0, pending: 0 };
                const shiftsThisWeek = shiftsCounts[role.id] || 0;

                return {
                    id: role.id,
                    name: role.name,
                    workspace_id: workspaceId,
                    employees: counts.employees,
                    shiftsPerWeek: shiftsThisWeek,
                    pendingRequests: counts.pending,
                    icon: role.icon || 'work',
                    color: role.color_theme || 'blue'
                };
            });
            setRoles(formattedRoles)
        }
        setLoading(false)
    }

    const handleCopyWorkspaceId = () => {
        if (!workspace?.join_code) return;
        navigator.clipboard.writeText(workspace.join_code)
        setCopiedWorkspaceId(true)
        setTimeout(() => setCopiedWorkspaceId(false), 2000)
    }

    const handleCreateRole = async (newRoleData) => {
        const { error } = await supabase
            .from('roles')
            .insert({
                workspace_id: workspaceId,
                name: newRoleData.name,
                icon: newRoleData.icon,
                color_theme: newRoleData.color_theme,
                hourly_wage: newRoleData.hourly_wage,
                min_hours_per_week: newRoleData.min_hours_per_week,
                max_hours_per_week: newRoleData.max_hours_per_week
            })

        if (!error) {
            setIsCreateRoleModalOpen(false)
            fetchRoles()
        } else {
            console.error("Error creating role:", error)
        }
        return error
    }

    const handleRenameRole = (role) => {
        setRenameModalRole(role)
    }

    const handleStaffList = (role) => {
        setStaffListModalRole(role)
    }

    const handleDeleteRole = (role) => {
        setDeleteModalRole(role)
    }

    if (loading) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
            </div>
        )
    }

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-200 min-h-screen flex flex-col relative w-full">
            <header className="flex-shrink-0 h-16 bg-[#ffffff] dark:bg-[#162e25] border-b border-[#99ffda]/20 flex items-center justify-between px-6 z-20 w-full relative">
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

                <div className="hidden md:flex flex-1 items-center justify-center">
                    <button
                        onClick={handleCopyWorkspaceId}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 active:scale-95 transition-all rounded-lg border border-slate-200 dark:border-slate-700/50 group"
                        title="Click to copy Workspace ID"
                    >
                        {copiedWorkspaceId ? (
                            <span className="text-sm font-medium text-primary flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">check</span>
                                Copied!
                            </span>
                        ) : (
                            <span className="text-sm font-medium font-mono text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                {workspace?.join_code || '------'}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-4 w-48 justify-end">
                    <UserProfileSection role="Manager" />
                </div>
            </header>

            <main className="flex-1 px-6 py-8 md:px-10 lg:px-40 w-full mb-8">
                <div className="mx-auto max-w-[1200px] flex flex-col gap-8">
                    <div className="flex flex-col items-center justify-center gap-2 mb-4 text-center">
                        <h1 className="text-3xl md:text-4xl font-black leading-tight tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">Role Management</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-base font-medium">Manage employee roles, permissions, and hiring requests.</p>
                        {workspace && (
                            <p className="text-primary-dark dark:text-primary font-bold">{workspace.name}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                        {roles.map(role => (
                            <div
                                key={role.id}
                                onClick={() => navigate(`/manager/dashboard/${workspaceId}/${role.id}`)}
                                className="bg-white dark:bg-[#1a2e26] rounded-2xl p-8 hover:shadow-lg transition-all duration-300 border border-[#e6f4ef] dark:border-slate-800 flex flex-col items-center group text-center relative shadow-[0_4px_20px_-2px_rgba(153,255,218,0.15)] cursor-pointer"
                            >
                                <div className="absolute top-4 right-4 flex flex-col items-end z-10" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => setActiveMenuRole(activeMenuRole === role.id ? null : role.id)}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                        <span className="material-symbols-outlined">more_horiz</span>
                                    </button>

                                    {activeMenuRole === role.id && (
                                        <RoleOptionsMenu
                                            onRename={() => { setActiveMenuRole(null); handleRenameRole(role); }}
                                            onStaffList={() => { setActiveMenuRole(null); handleStaffList(role); }}
                                            onDelete={() => { setActiveMenuRole(null); handleDeleteRole(role); }}
                                            onClose={() => setActiveMenuRole(null)}
                                        />
                                    )}
                                </div>

                                <div className={`w-16 h-16 rounded-full bg-${role.color}-50 dark:bg-${role.color}-900/30 flex items-center justify-center text-${role.color}-600 dark:text-${role.color}-400 mb-4`}>
                                    <span className="material-symbols-outlined text-3xl">{role.icon}</span>
                                </div>
                                <h3 className="text-slate-900 dark:text-white text-2xl font-bold mb-6 group-hover:text-primary transition-colors">{role.name}</h3>
                                <div className="flex items-center justify-center gap-2 mb-8 text-slate-500 dark:text-slate-400 font-bold text-lg">
                                    <span className="material-symbols-outlined text-xl">group</span>
                                    <span>{role.employees} Employees</span>
                                    <span className="mx-1">•</span>
                                    <span>{role.shiftsPerWeek} Shifts/Week</span>
                                </div>
                                <div className="w-full pt-4 border-t border-[#e6f4ef] dark:border-slate-800/50 mt-auto">
                                    {role.pendingRequests > 0 ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setRequestsModalRole(role); }}
                                            className="w-full h-11 bg-primary hover:bg-[#80e5c3] text-slate-900 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <span>Accept Request</span>
                                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">{role.pendingRequests}</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); navigate(`/manager/dashboard/${workspaceId}/${role.id}`); }}
                                            className="w-full h-11 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 border border-[#e6f4ef] dark:border-none"
                                        >
                                            <span>View Dashboard</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Create New Role */}
                        <button
                            onClick={() => setIsCreateRoleModalOpen(true)}
                            className="h-full min-h-[220px] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-primary/5 hover:border-primary/50 dark:hover:border-primary/50 transition-all duration-300 flex flex-col items-center justify-center gap-4 group cursor-pointer p-6"
                        >
                            <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                                <span className="material-symbols-outlined text-3xl text-primary">add</span>
                            </div>
                            <div className="text-center">
                                <h3 className="text-slate-800 dark:text-slate-200 text-lg font-bold group-hover:text-primary transition-colors">Create New Role</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Define permissions & requirements</p>
                            </div>
                        </button>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <RoleRenameModal
                isOpen={!!renameModalRole}
                role={renameModalRole}
                onClose={() => setRenameModalRole(null)}
                onSave={async (newName) => {
                    const { error } = await supabase
                        .from('roles')
                        .update({ name: newName })
                        .eq('id', renameModalRole.id)
                    if (!error) {
                        setRenameModalRole(null)
                        fetchRoles()
                    }
                }}
            />
            <RoleStaffListModal
                isOpen={!!staffListModalRole}
                role={staffListModalRole}
                onClose={() => setStaffListModalRole(null)}
            />
            <RoleDeleteModal
                isOpen={!!deleteModalRole}
                role={deleteModalRole}
                onClose={() => setDeleteModalRole(null)}
                onDelete={async (role) => {
                    const { error } = await supabase
                        .from('roles')
                        .delete()
                        .eq('id', role.id)
                    if (!error) {
                        setDeleteModalRole(null)
                        fetchRoles()
                    }
                }}
            />
            <RoleRequestsModal
                isOpen={!!requestsModalRole}
                role={requestsModalRole}
                onClose={() => setRequestsModalRole(null)}
            />
            <CreateRoleModal
                isOpen={isCreateRoleModalOpen}
                onClose={() => setIsCreateRoleModalOpen(false)}
                onCreate={handleCreateRole}
            />
        </div>
    )
}
