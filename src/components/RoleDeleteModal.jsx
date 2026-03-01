import React from 'react'

export function RoleDeleteModal({ isOpen, onClose, role, onDelete }) {
    if (!isOpen || !role) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-danger-bg dark:bg-red-900/30 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-danger text-2xl">delete</span>
                    </div>
                    <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">Delete Role?</h3>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-8 max-w-[280px]">
                        Are you sure you want to delete the <span className="font-bold text-text-primary-light dark:text-text-primary-dark">{role.name}</span> role? This action cannot be undone.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold text-text-primary-light dark:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onDelete(role);
                                onClose();
                            }}
                            className="flex-1 py-2.5 px-4 bg-danger hover:bg-red-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
