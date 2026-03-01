import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function CreateWorkspaceSuccessModal({ isOpen, onClose, roomId, workspaceName, workspaceId }) {
    const [copied, setCopied] = useState(false)
    const navigate = useNavigate()

    if (!isOpen) return null

    const handleCopy = () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleCreateRoleRoom = () => {
        onClose()
        if (workspaceId) {
            navigate(`/manager/roles/${workspaceId}`)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 flex flex-col gap-6 relative animate-in fade-in zoom-in duration-300 border border-neutral-100 dark:border-neutral-700">
                <div className="mx-auto flex items-center justify-center size-16 rounded-full bg-primary/20 text-primary-dark dark:text-primary mb-2">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Workspace Created!</h2>
                    <p className="text-neutral-600 dark:text-neutral-400">Your restaurant space is ready. Share this Room ID with your employees to let them join.</p>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl border-2 border-dashed border-primary/50 p-6 flex flex-col items-center gap-3">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Room ID</span>
                    <div className="flex items-center gap-3">
                        <span className="text-4xl font-black text-[#0A3F2F] dark:text-white tracking-widest font-mono">{roomId || '-----'}</span>
                        <button onClick={handleCopy} className={`${copied ? 'text-primary' : 'text-neutral-400 hover:text-primary-dark'} transition-colors`} title="Copy to clipboard">
                            <span className="material-symbols-outlined text-xl">{copied ? 'check' : 'content_copy'}</span>
                        </button>
                    </div>
                    <p className="text-xs text-neutral-400 text-center mt-1">Share this code with employees for "{workspaceName || 'Workspace'}"</p>
                </div>
                <div className="flex flex-col gap-3 mt-2">
                    <button onClick={handleCreateRoleRoom} className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark hover:text-white text-neutral-900 font-bold text-base transition-colors flex items-center justify-center gap-2 shadow-sm">
                        Create Role Room
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </button>
                    <button onClick={onClose} className="w-full text-center text-sm font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-white transition-colors py-2">
                        I'll do this later
                    </button>
                </div>
            </div>
        </div>
    )
}
