import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

function generateJoinCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

export function CreateWorkspaceModal({ isOpen, onClose, onCreate }) {
    const { user } = useAuth()
    const [roomName, setRoomName] = useState('')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    if (!isOpen) return null;

    const handleCreate = async () => {
        if (!roomName.trim()) {
            setError('Please enter a room name.')
            return
        }
        setError(null)
        setLoading(true)

        const joinCode = generateJoinCode()

        // 1. Create workspace
        const { data: workspace, error: wsError } = await supabase
            .from('workspaces')
            .insert({
                name: roomName.trim(),
                join_code: joinCode,
                manager_id: user.id
            })
            .select()
            .single()

        if (wsError) {
            // If join_code collision, retry with a new code
            if (wsError.message.includes('unique') || wsError.message.includes('duplicate')) {
                const retryCode = generateJoinCode()
                const { data: retryWs, error: retryErr } = await supabase
                    .from('workspaces')
                    .insert({
                        name: roomName.trim(),
                        join_code: retryCode,
                        manager_id: user.id
                    })
                    .select()
                    .single()

                if (retryErr) {
                    setError(retryErr.message)
                    setLoading(false)
                    return
                }
                // Continue with retry result
                await createMemberAndRoles(retryWs, retryCode)
                return
            }
            setError(wsError.message)
            setLoading(false)
            return
        }

        await createMemberAndRoles(workspace, joinCode)
    }

    const createMemberAndRoles = async (workspace, joinCode) => {
        // 2. Add creator as manager member
        await supabase.from('workspace_members').insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: 'MANAGER'
        })

        setLoading(false)
        setRoomName('')
        setDescription('')
        onCreate(workspace.name, joinCode, workspace.id)
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-[16px] shadow-lg flex flex-col overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-700">
                    <h3 className="text-lg font-bold text-neutral-800 dark:text-white">Create New Workspace</h3>
                </div>
                <div className="p-6 flex flex-col gap-5">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300" htmlFor="room-name">
                            Room Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full rounded-lg border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white px-3 py-2.5 focus:border-primary focus:ring-primary shadow-sm text-sm"
                            id="room-name"
                            placeholder="e.g. Downtown Bistro"
                            required
                            type="text"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300" htmlFor="room-desc">
                            Description <span className="text-neutral-400 font-normal">(Optional)</span>
                        </label>
                        <textarea
                            className="w-full rounded-lg border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white px-3 py-2.5 focus:border-primary focus:ring-primary shadow-sm text-sm resize-none"
                            id="room-desc"
                            placeholder="Briefly describe this workspace..."
                            rows="3"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
                <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700">
                    <button
                        className="px-4 py-2 rounded-lg text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 rounded-lg text-sm font-bold text-neutral-900 bg-[#98FFD9] hover:brightness-95 transition-all shadow-sm disabled:opacity-50"
                        type="button"
                        onClick={handleCreate}
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    )
}
