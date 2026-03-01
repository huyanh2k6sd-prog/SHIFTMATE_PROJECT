import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export function DeleteWorkspaceModal({ isOpen, onClose, workspace, onDeleted }) {
    const { user } = useAuth()
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    if (!isOpen || !workspace) return null

    const handleDelete = async (e) => {
        e.preventDefault()
        if (!password.trim()) {
            setError('Please enter your password.')
            return
        }
        setError(null)
        setLoading(true)

        // Re-authenticate by signing in with current email and entered password
        const { error: authError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: password
        })

        if (authError) {
            setError('Incorrect password. Please try again.')
            setLoading(false)
            return
        }

        // Password verified — proceed with delete
        const { error: deleteError } = await supabase
            .from('workspaces')
            .delete()
            .eq('id', workspace.id)

        setLoading(false)

        if (deleteError) {
            setError(deleteError.message)
            return
        }

        setPassword('')
        onDeleted()
        onClose()
    }

    const handleClose = () => {
        setPassword('')
        setError(null)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-[16px] shadow-lg flex flex-col overflow-hidden">
                <div className="px-6 py-5 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <span className="material-symbols-outlined text-red-600 dark:text-red-400">warning</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Delete Workspace</h3>
                            <p className="text-sm text-red-600 dark:text-red-400">This action cannot be undone</p>
                        </div>
                    </div>
                </div>
                <form onSubmit={handleDelete} className="p-6 flex flex-col gap-5">
                    <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            You are about to permanently delete <strong className="text-neutral-900 dark:text-white">{workspace.name}</strong>.
                            All roles, shifts, and member data will be lost.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300" htmlFor="delete-password">
                            Enter your password to confirm
                        </label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-xl pointer-events-none">lock</span>
                            <input
                                className="w-full pl-12 pr-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm"
                                id="delete-password"
                                placeholder="Your password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                </form>
                <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700">
                    <button
                        className="px-4 py-2.5 rounded-lg text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        type="button"
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        {loading && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
                        {loading ? 'Verifying...' : 'Delete Permanently'}
                    </button>
                </div>
            </div>
        </div>
    )
}
