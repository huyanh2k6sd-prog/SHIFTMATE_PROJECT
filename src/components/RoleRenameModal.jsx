import React, { useState, useEffect } from 'react'

export function RoleRenameModal({ isOpen, onClose, role, onSave }) {
    const [name, setName] = useState('')

    useEffect(() => {
        if (role) {
            setName(role.name)
        }
    }, [role])

    if (!isOpen || !role) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center mb-4 border border-gray-100 dark:border-white/10">
                        <span className="material-symbols-outlined text-text-primary-light dark:text-text-primary-dark">edit</span>
                    </div>
                    <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-1">Rename Role</h3>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-6">Enter a new name for the {role.name} role.</p>

                    <div className="mb-8">
                        <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider mb-2">Role Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                            placeholder="e.g., Head Cashier"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-text-primary-light dark:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border border-gray-200 dark:border-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onSave(name);
                                onClose();
                            }}
                            disabled={!name.trim() || name === role.name}
                            className="flex-1 py-2.5 px-4 bg-primary hover:bg-[#80e5c3] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-slate-900 transition-colors shadow-sm"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
