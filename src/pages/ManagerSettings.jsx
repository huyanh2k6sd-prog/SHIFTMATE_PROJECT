import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ManagerHeader } from '../components/ManagerHeader'
import { RoleRequestsModal } from '../components/RoleRequestsModal'

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
    return { icon: 'badge', color: 'emerald' }
}

export function ManagerSettings() {
    const { workspaceId } = useParams()
    const [roles, setRoles] = useState([])
    const [pendingCounts, setPendingCounts] = useState({})
    const [loading, setLoading] = useState(true)
    const [selectedRoleForRequests, setSelectedRoleForRequests] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')

    const fetchRolesAndCounts = async () => {
        if (!workspaceId) return;
        setLoading(true);

        const { data: rolesData, error: rolesError } = await supabase
            .from('roles')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('name');

        if (rolesError) {
            console.error("Error fetching roles:", rolesError);
            setLoading(false);
            return;
        }

        const roleIds = rolesData.map(r => r.id);

        let counts = {};
        if (roleIds.length > 0) {
            const { data: pendingData, error: pendingError } = await supabase
                .from('user_roles')
                .select('role_id')
                .in('role_id', roleIds)
                .eq('status', 'pending');

            if (!pendingError && pendingData) {
                pendingData.forEach(p => {
                    counts[p.role_id] = (counts[p.role_id] || 0) + 1;
                });
            } else if (pendingError) {
                console.error("Error fetching pending requests:", pendingError);
            }
        }

        setRoles(rolesData);
        setPendingCounts(counts);
        setLoading(false);
    };

    useEffect(() => {
        fetchRolesAndCounts();

        if (!workspaceId) return;
        // Subscribe to user_roles to auto-update pending counts
        const channel = supabase.channel('settings_user_roles')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
                fetchRolesAndCounts();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [workspaceId]);

    const handleRoleUpdateLocal = (roleId, field, value) => {
        setRoles(prev => prev.map(r => r.id === roleId ? { ...r, [field]: value } : r));
    }

    const handleRoleUpdateDB = async (roleId, field, value) => {
        let dbValue = value;
        if (field === 'hourly_wage') {
            dbValue = String(value).replace(/,/g, '');
            if (isNaN(dbValue) || dbValue === '') dbValue = 0;
            else dbValue = Number(dbValue);
        } else if (field === 'min_hours_per_week' || field === 'max_hours_per_week') {
            dbValue = parseInt(value, 10);
            if (isNaN(dbValue)) dbValue = 0;

            // Validate min < max
            const currentRole = roles.find(r => r.id === roleId);
            if (currentRole) {
                const minVal = field === 'min_hours_per_week' ? dbValue : (parseInt(currentRole.min_hours_per_week, 10) || 0);
                const maxVal = field === 'max_hours_per_week' ? dbValue : (parseInt(currentRole.max_hours_per_week, 10) || 0);
                if (maxVal > 0 && minVal >= maxVal) {
                    alert('Min hours must be less than max hours.');
                    fetchRolesAndCounts(); // revert
                    return;
                }
            }
        } else if (field === 'name') {
            const details = getRoleDetails(value);
            const { error: nameErr } = await supabase
                .from('roles')
                .update({
                    name: value,
                    icon: details.icon,
                    color_theme: details.color === 'primary' ? 'emerald' : details.color
                })
                .eq('id', roleId);

            if (nameErr) {
                console.error("Error updating role name:", nameErr);
                alert("Failed to update role name.");
                fetchRolesAndCounts();
            }
            return;
        }

        const { error } = await supabase
            .from('roles')
            .update({ [field]: dbValue })
            .eq('id', roleId);

        if (error) {
            console.error(`Error updating ${field} for role ${roleId}:`, error);
            alert("Failed to save changes.");
            fetchRolesAndCounts(); // revert
        }
    };

    // Formatting helper
    const formatWage = (wage) => {
        if (wage === null || wage === undefined) return '';
        return Number(wage).toLocaleString('vi-VN');
    }

    const filteredRoles = roles.filter(role => role.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div style={{
            '--color-primary': '#13ec9c',
            '--color-primary-content': '#0d1b16',
            '--color-primary-light': '#e7f3ef',
            '--color-primary-dark': '#0c3b2e',
            '--color-secondary': '#4c9a7d',
            '--color-background-light': '#f8fcfa',
            '--color-background-dark': '#10221b',
            '--color-surface-light': '#ffffff',
            '--color-surface-dark': '#1a382e',
            '--color-mint-green': '#98FFD9',
            '--color-dark-mint': '#059669',
            '--color-saturated-mint': '#047857',
        }} className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-200 min-h-screen flex flex-col overflow-x-hidden">
            <div className="layout-container flex h-full grow flex-col">
                <ManagerHeader />
                <main className="flex-1 px-6 py-8 md:px-10 lg:px-40 w-full mb-8">
                    <div className="mx-auto max-w-[1200px]">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">Role Settings</h1>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">Configure roles, wage limits, and scheduling constraints.</p>
                            </div>
                        </div>
                        <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 mb-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
                            <div className="relative flex-1 min-w-[200px] max-w-md">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                                <input
                                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-primary text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400"
                                    placeholder="Search roles..."
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sort by:</span>
                                <select className="bg-transparent border-none text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer hover:text-primary">
                                    <option>Name (A-Z)</option>
                                    <option>Highest Wage</option>
                                    <option>Lowest Wage</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/4">Role Name</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/4">Hourly Wage (VND)</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/6">Min Hours/Week</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/6">Max Hours/Week</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right w-1/6">Role Requests</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                                        Loading roles...
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredRoles.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-medium">
                                                    No roles found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRoles.map(role => (
                                                <tr key={role.id} onClick={() => window.location.href = `/manager/dashboard/${workspaceId}/${role.id}`} className="group hover:bg-primary-light/30 dark:hover:bg-primary-dark/20 transition-colors cursor-pointer">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`shrink-0 w-8 h-8 rounded-full bg-${(role.color_theme || 'blue').replace('bg-', '')}-50 dark:bg-${(role.color_theme || 'blue').replace('bg-', '')}-900/30 flex items-center justify-center text-${(role.color_theme || 'blue').replace('bg-', '')}-600 dark:text-${(role.color_theme || 'blue').replace('bg-', '')}-400`}>
                                                                <span className="material-symbols-outlined text-[18px]">{role.icon || 'work'}</span>
                                                            </div>
                                                            <div className="relative flex-1">
                                                                <input
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="w-full bg-transparent border-none rounded focus:ring-2 focus:ring-primary/20 px-1 py-0.5 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors focus:bg-white dark:focus:bg-slate-800"
                                                                    type="text"
                                                                    value={role.name}
                                                                    onChange={(e) => handleRoleUpdateLocal(role.id, 'name', e.target.value)}
                                                                    onBlur={(e) => handleRoleUpdateDB(role.id, 'name', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="relative max-w-[140px]">
                                                            <input
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                                                type="text"
                                                                value={role.hourly_wage === undefined ? '' : String(role.hourly_wage).replace(/,/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                                                onChange={(e) => handleRoleUpdateLocal(role.id, 'hourly_wage', e.target.value)}
                                                                onBlur={(e) => handleRoleUpdateDB(role.id, 'hourly_wage', e.target.value)}
                                                            />
                                                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">edit</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="relative max-w-[100px]">
                                                            <input
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                                                type="number"
                                                                value={role.min_hours_per_week || ''}
                                                                onChange={(e) => handleRoleUpdateLocal(role.id, 'min_hours_per_week', e.target.value)}
                                                                onBlur={(e) => handleRoleUpdateDB(role.id, 'min_hours_per_week', e.target.value)}
                                                            />
                                                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">edit</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="relative max-w-[100px]">
                                                            <input
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                                                type="number"
                                                                value={role.max_hours_per_week || ''}
                                                                onChange={(e) => handleRoleUpdateLocal(role.id, 'max_hours_per_week', e.target.value)}
                                                                onBlur={(e) => handleRoleUpdateDB(role.id, 'max_hours_per_week', e.target.value)}
                                                            />
                                                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">edit</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {pendingCounts[role.id] > 0 ? (
                                                                <span className="inline-flex items-center justify-center size-6 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold">
                                                                    {pendingCounts[role.id]}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center justify-center size-6 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 text-xs font-bold">
                                                                    0
                                                                </span>
                                                            )}
                                                            <button onClick={(e) => { e.stopPropagation(); setSelectedRoleForRequests(role) }} className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-light/50 dark:hover:bg-primary-dark/50 transition-colors" title="View Requests">
                                                                <span className="material-symbols-outlined text-[20px]">arrow_forward_ios</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Showing {filteredRoles.length} of {roles.length} roles</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <RoleRequestsModal
                isOpen={selectedRoleForRequests !== null}
                role={selectedRoleForRequests}
                onClose={() => setSelectedRoleForRequests(null)}
            />
        </div>
    )
}
