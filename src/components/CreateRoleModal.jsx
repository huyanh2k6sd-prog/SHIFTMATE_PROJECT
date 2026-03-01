import React, { useState } from 'react'

export function CreateRoleModal({ isOpen, onClose, onCreate }) {
    const [roleName, setRoleName] = useState('')
    const [hourlyRate, setHourlyRate] = useState('')
    const [minHours, setMinHours] = useState('')
    const [maxHours, setMaxHours] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    if (!isOpen) return null

    const getRoleDetails = (name) => {
        const lowerName = name.toLowerCase()
        if (lowerName.includes('cashier') || lowerName.includes('register') || lowerName.includes('sales')) {
            return { icon: 'point_of_sale', color: 'blue' }
        }
        if (lowerName.includes('server') || lowerName.includes('waiter') || lowerName.includes('waitress')) {
            return { icon: 'restaurant_menu', color: 'orange' }
        }
        if (lowerName.includes('barista') || lowerName.includes('coffee') || lowerName.includes('drink')) {
            return { icon: 'coffee', color: 'amber' }
        }
        if (lowerName.includes('kitchen') || lowerName.includes('cook') || lowerName.includes('chef')) {
            return { icon: 'skillet', color: 'red' }
        }
        if (lowerName.includes('inventory') || lowerName.includes('stock') || lowerName.includes('manager')) {
            return { icon: 'inventory_2', color: 'teal' }
        }
        if (lowerName.includes('clean') || lowerName.includes('janitor') || lowerName.includes('wash')) {
            return { icon: 'cleaning_services', color: 'purple' }
        }
        if (lowerName.includes('guard') || lowerName.includes('security')) {
            return { icon: 'security', color: 'slate' }
        }
        // Default
        return { icon: 'badge', color: 'primary' }
    }

    const { icon, color } = getRoleDetails(roleName)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const minVal = parseInt(minHours, 10);
        const maxVal = parseInt(maxHours, 10);
        if (minVal >= maxVal) {
            setError('Min hours must be less than max hours.');
            setLoading(false);
            return;
        }

        if (onCreate) {
            const err = await onCreate({
                name: roleName,
                hourly_wage: parseFloat(hourlyRate),
                min_hours_per_week: parseInt(minHours, 10),
                max_hours_per_week: parseInt(maxHours, 10),
                icon: icon,
                color_theme: color === 'primary' ? 'emerald' : color
            })

            if (err) {
                if (err.code === '23505') {
                    setError("This role name already exists in this workspace.")
                } else {
                    setError(err.message || "Failed to create role. Please try again.")
                }
                setLoading(false)
                return
            }
        }

        setLoading(false)
        // Reset form
        setRoleName('')
        setHourlyRate('')
        setMinHours('')
        setMaxHours('')
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        {roleName.trim() === '' ? (
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary-dark">
                                <span className="material-symbols-outlined">add_circle</span>
                            </div>
                        ) : (
                            <div className={`w-10 h-10 rounded-full bg-${color === 'primary' ? 'emerald' : color}-50 flex items-center justify-center text-${color === 'primary' ? 'emerald' : color}-600`}>
                                <span className="material-symbols-outlined">{icon}</span>
                            </div>
                        )}
                        <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Create New Role</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-text-secondary-light transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider mb-2">Role Name</label>
                        <input
                            type="text"
                            required
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                            placeholder="e.g., Senior Barista"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider mb-2">Hourly Rate (VND)</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="1000"
                            value={hourlyRate}
                            onChange={(e) => setHourlyRate(e.target.value)}
                            className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                            placeholder="50000"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider mb-2">Min Hours/Week</label>
                            <input
                                type="number"
                                required
                                min="0"
                                value={minHours}
                                onChange={(e) => setMinHours(e.target.value)}
                                className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                                placeholder="10"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider mb-2">Max Hours/Week</label>
                            <input
                                type="number"
                                required
                                min="0"
                                value={maxHours}
                                onChange={(e) => setMaxHours(e.target.value)}
                                className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                                placeholder="40"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">error</span>
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
                        </div>
                    )}

                    <div className="pt-4 flex gap-3 w-full">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-text-primary-light dark:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border border-gray-200 dark:border-white/10 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !roleName || !hourlyRate || !minHours || !maxHours}
                            className="flex-1 py-2.5 px-4 bg-primary hover:bg-[#80e5c3] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-slate-900 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                                    Creating...
                                </>
                            ) : (
                                'Create Role'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
