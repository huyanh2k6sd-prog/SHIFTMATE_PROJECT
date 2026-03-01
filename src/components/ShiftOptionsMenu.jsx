import React, { useEffect, useRef } from 'react'

export function ShiftOptionsMenu({ onEdit, onAvailableStaff, onAssignedStaff, onDelete, onClose, mode = 'availability' }) {
    const menuRef = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    return (
        <div
            ref={menuRef}
            className="absolute left-full top-0 ml-2 w-48 bg-surface-light dark:bg-surface-dark rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-white/10 z-[100] overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200"
        >
            <div className="py-1">
                {mode === 'assignment' ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); if (onAssignedStaff) onAssignedStaff(); onClose(); }}
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3"
                    >
                        <span className="material-symbols-outlined text-[20px] text-text-secondary-light">group</span>
                        Assigned Staff
                    </button>
                ) : (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); onClose(); }}
                            className="w-full text-left px-4 py-3 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3"
                        >
                            <span className="material-symbols-outlined text-[20px] text-text-secondary-light">edit</span>
                            Edit Shift
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-white/5 mx-3"></div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onAvailableStaff(); onClose(); }}
                            className="w-full text-left px-4 py-3 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3"
                        >
                            <span className="material-symbols-outlined text-[20px] text-text-secondary-light">group</span>
                            Available Staff
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-white/5 mx-3"></div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
                            className="w-full text-left px-4 py-3 text-sm font-semibold text-danger hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-3"
                        >
                            <span className="material-symbols-outlined text-[20px] text-danger">delete</span>
                            Delete Shift
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
