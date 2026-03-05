import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { UserProfileSection } from './UserProfileSection'
import { supabase } from '../lib/supabase'

export function ManagerHeader() {
    const location = useLocation()
    const navigate = useNavigate()
    const { workspaceId, roleId } = useParams()
    const currentPath = location.pathname

    const isActive = (path) => currentPath.startsWith(path)

    const [roleName, setRoleName] = useState('')

    useEffect(() => {
        if (!roleId) {
            setRoleName('')
            return
        }

        const fetchRoleName = async () => {
            const { data } = await supabase
                .from('roles')
                .select('name')
                .eq('id', roleId)
                .single()

            if (data) {
                setRoleName(data.name)
            }
        }

        fetchRoleName()
    }, [roleId])

    return (
        <header className="flex-shrink-0 h-16 bg-[#ffffff] dark:bg-[#162e25] border-b border-[#99ffda]/20 flex items-center justify-between px-6 z-20 w-full relative">
            <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => navigate(`/manager/roles/${workspaceId}`)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-600 dark:text-slate-300" aria-label="Go back">
                    <span className="material-symbols-outlined text-[18px]">arrow_back_ios_new</span>
                </button>
                <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <div
                    onClick={() => navigate(`/manager/roles/${workspaceId}`)}
                    className="flex items-baseline whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">ShiftMate</span>
                </div>
            </div>

            <nav className="hidden md:flex items-center gap-12 h-full justify-center flex-1">
                <Link className={`relative h-full flex items-center justify-center text-sm px-2 flex-col transition-colors ${isActive('/manager/dashboard') ? 'text-[#0c1d17] dark:text-white font-bold' : 'text-[#065f46] hover:text-[#0c1d17] dark:text-[#98FFD9] dark:hover:text-white font-normal'}`} to={`/manager/dashboard/${workspaceId}${roleId ? `/${roleId}` : ''}`}>
                    Schedule
                    {isActive('/manager/dashboard') && <span className="absolute bottom-0 h-[3px] bg-[#0c1d17] w-full dark:bg-white"></span>}
                </Link>
                <Link className={`relative h-full flex items-center justify-center text-sm px-2 flex-col transition-colors ${isActive('/manager/payroll') ? 'text-[#0c1d17] dark:text-white font-bold' : 'text-[#065f46] hover:text-[#0c1d17] dark:text-[#98FFD9] dark:hover:text-white font-normal'}`} to={`/manager/payroll/${workspaceId}${roleId ? `/${roleId}` : ''}`}>
                    Payroll
                    {isActive('/manager/payroll') && <span className="absolute bottom-0 h-[3px] bg-[#0c1d17] w-full dark:bg-white"></span>}
                </Link>
                <Link className={`relative h-full flex items-center justify-center text-sm px-2 flex-col transition-colors ${isActive('/manager/settings') ? 'text-[#0c1d17] dark:text-white font-bold' : 'text-[#065f46] hover:text-[#0c1d17] dark:text-[#98FFD9] dark:hover:text-white font-normal'}`} to={`/manager/settings/${workspaceId}${roleId ? `/${roleId}` : ''}`}>
                    Settings
                    {isActive('/manager/settings') && <span className="absolute bottom-0 h-[3px] bg-[#0c1d17] w-full dark:bg-white"></span>}
                </Link>
            </nav>

            <div className="flex items-center gap-4 flex-shrink-0 justify-end">
                <UserProfileSection role="Manager" workspaceRoleName={roleName} />
            </div>
        </header>
    )
}
