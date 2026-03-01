import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreateWorkspaceModal } from '../components/CreateWorkspaceModal'
import { CreateWorkspaceSuccessModal } from '../components/CreateWorkspaceSuccessModal'
import { DeleteWorkspaceModal } from '../components/DeleteWorkspaceModal'
import { UserProfileSection } from '../components/UserProfileSection'
import { useAuth } from '../components/AuthContext'
import { supabase } from '../lib/supabase'

export function WorkspaceSelection() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
    const [createdWorkspace, setCreatedWorkspace] = useState({ name: '', id: '', workspaceId: '' })
    const [workspaces, setWorkspaces] = useState([])
    const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)
    const [joinCode, setJoinCode] = useState('')
    const [joinError, setJoinError] = useState(null)
    const [joinLoading, setJoinLoading] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [deleteModalWorkspace, setDeleteModalWorkspace] = useState(null)

    // Fetch workspaces the user is a member of
    const fetchWorkspaces = useCallback(async () => {
        if (!user) return
        setLoadingWorkspaces(true)

        const { data, error } = await supabase.rpc('get_my_workspaces')

        if (!error && data) {
            const ws = data.map(m => ({
                id: m.workspace_id,
                name: m.workspace_name,
                joinCode: m.join_code,
                role: m.member_role,
                isManager: m.is_manager
            }))
            setWorkspaces(ws)
        }
        setLoadingWorkspaces(false)
    }, [user])

    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    const handleCreateWorkspace = (name, joinCode, workspaceId) => {
        setIsCreateModalOpen(false)
        setCreatedWorkspace({ name, id: joinCode, workspaceId })
        setIsSuccessModalOpen(true)
        fetchWorkspaces()
    }

    const handleSuccessClose = () => {
        setIsSuccessModalOpen(false)
    }

    const handleJoinWorkspace = async () => {
        if (!joinCode.trim()) {
            setJoinError('Please enter a Room ID.')
            return
        }
        setJoinError(null)
        setJoinLoading(true)

        // Look up workspace by join_code via RPC (bypasses RLS since user isn't a member yet)
        const { data: wsData, error: lookupError } = await supabase
            .rpc('lookup_workspace_by_code', { p_join_code: joinCode.trim().toUpperCase() })

        const workspace = wsData?.[0]

        if (lookupError || !workspace) {
            setJoinError('Invalid Room ID. Please check and try again.')
            setJoinLoading(false)
            return
        }

        // Check if already a member
        const { data: existing } = await supabase
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', workspace.id)
            .eq('user_id', user.id)
            .maybeSingle()

        if (existing) {
            setJoinError('You are already a member of this workspace.')
            setJoinLoading(false)
            return
        }

        // Add as employee member
        const { error: joinErr } = await supabase
            .from('workspace_members')
            .insert({
                workspace_id: workspace.id,
                user_id: user.id,
                role: 'EMPLOYEE'
            })

        setJoinLoading(false)

        if (joinErr) {
            setJoinError(joinErr.message)
            return
        }

        setJoinCode('')
        // Navigate to role selection for this workspace
        navigate(`/employee/roles/${workspace.id}`)
    }

    const handleDeleteWorkspace = (ws) => {
        // Open password confirmation modal for delete
        setDeleteModalWorkspace(ws)
    }

    const handleLeaveWorkspace = async (ws) => {
        // Call the secure RPC to completely wipe all this user's data 
        // (availabilities, shifts, requests, roles) from this specific workspace.
        const { error } = await supabase.rpc('leave_workspace_completely', {
            p_workspace_id: ws.id
        });

        if (!error) {
            setDeleteConfirm(null)
            fetchWorkspaces()
        } else {
            console.error("Failed to leave workspace cleanly", error);
        }
    }

    const handleWorkspaceClick = async (ws) => {
        if (ws.isManager) {
            navigate(`/manager/roles/${ws.id}`)
        } else {
            // Check if employee has any approved role in this workspace
            const { data: approvedRoles } = await supabase
                .from('user_roles')
                .select('id, roles!inner(workspace_id)')
                .eq('user_id', user.id)
                .eq('status', 'approved')
                .eq('roles.workspace_id', ws.id)
                .limit(1)

            if (approvedRoles && approvedRoles.length > 0) {
                // Has approved role → go directly to Employee Dashboard
                navigate(`/employee/dashboard/${ws.id}`)
            } else {
                // No approved role → go to Select Your Role
                navigate(`/employee/roles/${ws.id}`)
            }
        }
    }

    return (
        <div style={{
            '--color-primary': '#99ffda',
            '--color-primary-dark': '#34d399',
            '--color-background-light': '#f5f8f7',
            '--color-background-dark': '#0f231c',
            '--color-neutral-100': '#e6f4ef',
            '--color-neutral-200': '#cdeadf',
            '--color-neutral-800': '#0c1d17',
            '--color-neutral-600': '#45a17f',
            '--color-brand-navy': '#0A3F2F',
            '--color-surface-light': '#ffffff',
            '--color-surface-dark': '#162e25',
            '--color-text-main': '#0c1d17',
            '--color-text-secondary': '#45a17f',
            '--color-border-color': '#e6f4ef',
        }} className="bg-background-light dark:bg-background-dark font-display text-neutral-800 dark:text-neutral-100 min-h-screen flex flex-col relative w-full">
            <header className="flex-shrink-0 h-16 bg-[#ffffff] dark:bg-[#162e25] border-b border-[#e6f4ef] dark:border-neutral-800/50 flex items-center justify-between px-6 z-20 w-full relative">
                <div
                    className="flex items-center gap-2 w-48 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/workspace')}
                >
                    <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">ShiftMate</span>
                </div>

                <div className="hidden md:flex flex-1"></div>

                <div className="flex items-center gap-4 w-48 justify-end">
                    <UserProfileSection role="" />
                </div>
            </header>
            <main className="flex-1 flex justify-center w-full px-4 sm:px-6 py-8 lg:py-12">
                <div className="flex flex-col w-full max-w-[960px] gap-10">
                    <div className="flex flex-col gap-4 text-center sm:text-left">
                        <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">
                            Get Started
                        </h1>
                        <p className="text-neutral-600 dark:text-neutral-400 text-lg font-medium leading-normal max-w-[600px]">
                            Choose your role to continue. Managers create spaces, while employees join existing ones.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Create a Room */}
                        <div className="group relative flex flex-col gap-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-6 sm:p-8 hover:shadow-lg hover:border-primary/50 transition-all duration-300">
                            <div className="flex items-center justify-between">
                                <div className="size-14 rounded-full bg-primary/20 flex items-center justify-center text-primary-dark dark:text-primary group-hover:scale-110 transition-transform duration-300">
                                    <span className="material-symbols-outlined text-3xl">add_circle</span>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider">Manager</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <h2 className="text-neutral-800 dark:text-white text-2xl font-bold leading-tight">Create a Room</h2>
                                <p className="text-neutral-600 dark:text-neutral-400 text-base">Create a space for your restaurant and invite your team.</p>
                            </div>
                            <div className="mt-auto pt-4">
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark hover:text-white text-neutral-900 font-bold text-base transition-colors flex items-center justify-center gap-2"
                                >
                                    Create Workspace
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </button>
                            </div>
                        </div>

                        {/* Join a Room */}
                        <div className="group relative flex flex-col gap-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-6 sm:p-8 hover:shadow-lg hover:border-primary/50 transition-all duration-300">
                            <div className="flex items-center justify-between">
                                <div className="size-14 rounded-full bg-primary/20 flex items-center justify-center text-primary-dark dark:text-primary group-hover:scale-110 transition-transform duration-300">
                                    <span className="material-symbols-outlined text-3xl">meeting_room</span>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider">Employee</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <h2 className="text-neutral-800 dark:text-white text-2xl font-bold leading-tight">Join a Room</h2>
                                <p className="text-neutral-600 dark:text-neutral-400 text-base">Enter the unique Room ID provided by your manager.</p>
                            </div>
                            <div className="mt-auto pt-4 flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <input
                                        className="flex-1 h-12 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 px-4 text-base focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all dark:text-white uppercase tracking-widest font-mono font-bold text-center"
                                        placeholder="ROOM ID"
                                        type="text"
                                        value={joinCode}
                                        onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null) }}
                                        maxLength={5}
                                    />
                                    <button
                                        onClick={handleJoinWorkspace}
                                        disabled={joinLoading}
                                        className="h-12 px-6 rounded-xl bg-neutral-800 dark:bg-white text-white dark:text-neutral-900 font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        {joinLoading ? '...' : 'Join'}
                                    </button>
                                </div>
                                {joinError && (
                                    <p className="text-sm text-red-500 dark:text-red-400">{joinError}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Workspaces List */}
                    <div className="flex flex-col gap-5 pt-4">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-neutral-800 dark:text-white text-xl font-bold tracking-tight">Workspaces</h2>
                            {workspaces.length > 0 && (
                                <span className="text-neutral-500 dark:text-neutral-400 text-sm">{workspaces.length} workspace{workspaces.length > 1 ? 's' : ''}</span>
                            )}
                        </div>
                        <div className="flex flex-col gap-3">
                            {loadingWorkspaces ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
                                </div>
                            ) : workspaces.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="size-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-3xl text-neutral-400">folder_open</span>
                                    </div>
                                    <h3 className="text-neutral-600 dark:text-neutral-400 font-semibold text-lg mb-1">No workspaces yet</h3>
                                    <p className="text-neutral-500 dark:text-neutral-500 text-sm max-w-sm">Create a new workspace to get started as a manager, or join an existing one with a Room ID.</p>
                                </div>
                            ) : (
                                workspaces.map(ws => (
                                    <div key={ws.id} className="group flex items-center justify-between w-full p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700/50 shadow-sm hover:shadow-md hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-200">
                                        <button onClick={() => handleWorkspaceClick(ws)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
                                            <div className={`rounded-lg size-12 shrink-0 flex items-center justify-center text-white font-bold text-lg ${ws.isManager ? 'bg-gradient-to-br from-teal-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                                                {ws.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <h3 className="text-neutral-900 dark:text-white font-bold text-base truncate group-hover:text-primary-dark dark:group-hover:text-primary transition-colors">{ws.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-neutral-500 dark:text-neutral-400 text-sm">Role: {ws.isManager ? 'Manager' : 'Employee'}</p>
                                                    <span className="text-xs font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded">{ws.joinCode}</span>
                                                </div>
                                            </div>
                                        </button>
                                        <div className="flex items-center gap-2 pl-4 shrink-0 relative z-10">
                                            {!ws.isManager && deleteConfirm === ws.id ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Sure?</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleLeaveWorkspace(ws) }}
                                                        className="h-8 px-3 rounded bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
                                                    >
                                                        Yes
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null) }}
                                                        className="h-8 px-3 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-bold transition-colors"
                                                    >
                                                        No
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); ws.isManager ? handleDeleteWorkspace(ws) : setDeleteConfirm(ws.id) }}
                                                        className="h-8 px-3 rounded bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold transition-colors border border-red-100 dark:border-red-900/50 mr-2"
                                                    >
                                                        {ws.isManager ? 'Delete Workspace' : 'Leave Workspace'}
                                                    </button>
                                                    <span className="material-symbols-outlined text-neutral-400 pointer-events-none group-hover:text-primary-dark dark:group-hover:text-primary transition-colors">chevron_right</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <CreateWorkspaceModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={handleCreateWorkspace}
            />

            <CreateWorkspaceSuccessModal
                isOpen={isSuccessModalOpen}
                onClose={handleSuccessClose}
                roomId={createdWorkspace.id}
                workspaceName={createdWorkspace.name}
                workspaceId={createdWorkspace.workspaceId}
            />

            <DeleteWorkspaceModal
                isOpen={!!deleteModalWorkspace}
                onClose={() => setDeleteModalWorkspace(null)}
                workspace={deleteModalWorkspace}
                onDeleted={fetchWorkspaces}
            />
        </div>
    )
}
