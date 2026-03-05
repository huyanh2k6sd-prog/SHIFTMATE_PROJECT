import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { UserProfileSection } from './UserProfileSection'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export function EmployeeHeader() {
    const location = useLocation()
    const navigate = useNavigate()
    const { workspaceId } = useParams()
    const currentPath = location.pathname
    const { user } = useAuth()

    const isActive = (path) => currentPath.startsWith(path)

    const [roleName, setRoleName] = useState('')

    useEffect(() => {
        if (!workspaceId || !user) return;

        const fetchUserRole = async () => {
            // First, get all roles in this workspace
            const { data: workspaceRoles } = await supabase
                .from('roles')
                .select('id, name')
                .eq('workspace_id', workspaceId);

            if (!workspaceRoles || workspaceRoles.length === 0) return;
            const roleIds = workspaceRoles.map(r => r.id);

            // Fetch the user's approved roles for this workspace
            const { data: userRoles } = await supabase
                .from('user_roles')
                .select('role_id')
                .eq('user_id', user.id)
                .eq('status', 'approved')
                .in('role_id', roleIds);

            if (userRoles && userRoles.length > 0) {
                // Determine the role name (show first one, append + if multiple)
                const match = workspaceRoles.find(r => r.id === userRoles[0].role_id);
                if (match) {
                    setRoleName(userRoles.length > 1 ? `${match.name} +` : match.name);
                }
            }
        }

        fetchUserRole()
    }, [workspaceId, user])

    return (
        <header className="flex-shrink-0 h-16 bg-[#ffffff] dark:bg-[#162e25] border-b border-[#e6f4ef] dark:border-[#2a4e43] flex items-center justify-between px-6 z-20 w-full relative">
            <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => navigate('/workspace')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-600 dark:text-slate-300" aria-label="Go back">
                    <span className="material-symbols-outlined text-[18px]">arrow_back_ios_new</span>
                </button>
                <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <div
                    onClick={() => navigate('/workspace')}
                    className="flex items-baseline whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">ShiftMate</span>
                </div>
            </div>

            <nav className="hidden md:flex items-center gap-12 h-full justify-center flex-1">
                <Link className={`relative h-full flex items-center justify-center text-sm px-2 flex-col transition-colors ${isActive('/employee/dashboard') ? 'text-[#0c1d17] dark:text-white font-bold' : 'text-[#065f46] hover:text-[#0c1d17] dark:text-[#98FFD9] dark:hover:text-white font-normal'}`} to={`/employee/dashboard/${workspaceId}`}>
                    Schedule
                    {isActive('/employee/dashboard') && <span className="absolute bottom-0 h-[3px] bg-[#0c1d17] w-full dark:bg-white"></span>}
                </Link>
                <Link className={`relative h-full flex items-center justify-center text-sm px-2 flex-col transition-colors ${isActive('/employee/availability') ? 'text-[#0c1d17] dark:text-white font-bold' : 'text-[#065f46] hover:text-[#0c1d17] dark:text-[#98FFD9] dark:hover:text-white font-normal'}`} to={`/employee/availability/${workspaceId}`}>
                    Availability
                    {isActive('/employee/availability') && <span className="absolute bottom-0 h-[3px] bg-[#0c1d17] w-full dark:bg-white"></span>}
                </Link>
                <Link className={`relative h-full flex items-center justify-center text-sm px-2 flex-col transition-colors ${isActive('/employee/earnings') ? 'text-[#0c1d17] dark:text-white font-bold' : 'text-[#065f46] hover:text-[#0c1d17] dark:text-[#98FFD9] dark:hover:text-white font-normal'}`} to={`/employee/earnings/${workspaceId}`}>
                    Earnings
                    {isActive('/employee/earnings') && <span className="absolute bottom-0 h-[3px] bg-[#0c1d17] w-full dark:bg-white"></span>}
                </Link>
            </nav>

            <div className="flex items-center gap-4 justify-end flex-shrink-0">
                <UserProfileSection role="Employee" workspaceRoleName={roleName} />
            </div>
        </header>
    )
}
