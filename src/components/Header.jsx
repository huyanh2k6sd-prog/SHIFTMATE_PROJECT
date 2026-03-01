import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from './AuthContext'

export function Header() {
    const navigate = useNavigate()
    const { user, profile } = useAuth()
    const displayName = profile?.full_name || user?.user_metadata?.full_name || 'User'
    return (
        <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-neutral-100 dark:border-neutral-800/50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm px-6 lg:px-10 py-4">
            <div
                className="flex items-center gap-4 text-neutral-800 dark:text-white cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/workspace')}
            >
                <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">ShiftMate</h2>
            </div>
            <div className="flex items-center gap-6">
                <div className="relative">
                    <button className="flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white transition-colors">
                        <Bell size={24} />
                    </button>
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-background-light dark:ring-background-dark transform translate-x-1/4 -translate-y-1/4"></span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="hidden sm:block text-neutral-900 dark:text-white font-bold text-sm">{displayName}</span>
                    <div
                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-primary/30"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAFl-iFjSZWcZ_4zSLVJySaN7cES5hB6R7xu0WCb9bX89SVXw3X74OLQJQ-Diz5OJgSoeLWXkcY3SNoZfLIOinII4soW0Qj8sngXFu-yXQjM-N8L2pNxmjli6pI0G3ZEKPpS7wDXvtxTLrduw5CkMKa21Ke-9ByqdAA2R2Dg9KnF2-rbxJ6Wd_lxGXHMQmSjcHtf-QbPo9s1tXinrZhd-SqpztmoeBFFiJuUL6rkUhJMFDOF40GnAySQEJmIVwc4WkIER_7xzXkTHg")' }}
                    />
                </div>
            </div>
        </header>
    )
}
