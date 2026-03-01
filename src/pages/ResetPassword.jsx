import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ResetPassword() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)
    const navigate = useNavigate()

    // Listen for the PASSWORD_RECOVERY event from Supabase
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                // User arrived via the reset link - they're now authenticated
            }
        })
        return () => subscription.unsubscribe()
    }, [])

    const handleReset = async (e) => {
        e.preventDefault()
        setError(null)

        if (!password) {
            setError('Please enter a new password.')
            return
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.')
            return
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setLoading(true)
        const { error: updateError } = await supabase.auth.updateUser({ password })
        setLoading(false)

        if (updateError) {
            setError(updateError.message)
        } else {
            setSuccess(true)
            setTimeout(() => {
                navigate('/auth')
            }, 3000)
        }
    }

    return (
        <div style={{
            '--color-primary': '#99ffda',
            '--color-background-light': '#f5f8f7',
            '--color-background-dark': '#0f231c',
            '--color-brand-navy': '#0A2620',
        }} className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display relative z-0">
            <div className="fixed top-0 right-0 -z-10 w-1/3 h-1/2 bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="fixed bottom-0 left-0 -z-10 w-1/4 h-1/3 bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>

            <header className="fixed top-0 left-0 right-0 h-16 w-full bg-[#ffffff] dark:bg-[#162e25] flex items-center justify-between px-6 z-50 border-b border-[#0A2620]/10 dark:border-white/5 shadow-sm">
                <div
                    onClick={() => navigate('/workspace')}
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">ShiftMate</span>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center px-4 pb-12 pt-28 z-10">
                <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 auth-card rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                    <div className="p-8 md:p-10">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-3xl text-teal-700">
                                    {success ? 'check_circle' : 'lock_reset'}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {success ? 'Password Updated!' : 'Reset Your Password'}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                {success
                                    ? 'Your password has been successfully reset. Redirecting to sign in...'
                                    : 'Enter your new password below.'
                                }
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                                <span className="material-symbols-outlined text-red-500 shrink-0">error</span>
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        {!success && (
                            <form className="space-y-5" onSubmit={handleReset}>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="new-password">New Password</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">lock</span>
                                        <input
                                            className="w-full pl-12 pr-12 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none"
                                            id="new-password"
                                            placeholder="••••••••"
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none" type="button" onClick={() => setShowPassword(!showPassword)}>
                                            <span className="material-symbols-outlined text-xl">{showPassword ? "visibility" : "visibility_off"}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="confirm-new-password">Confirm New Password</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">lock_reset</span>
                                        <input
                                            className="w-full pl-12 pr-12 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none"
                                            id="confirm-new-password"
                                            placeholder="••••••••"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none" type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                            <span className="material-symbols-outlined text-xl">{showConfirmPassword ? "visibility" : "visibility_off"}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        className="w-full py-4 bg-primary hover:bg-[color:var(--color-primary-hover,7fecc7)] text-brand-navy font-bold rounded-lg shadow-sm shadow-primary/20 transition-all transform active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                                        type="submit"
                                        disabled={loading}
                                    >
                                        {loading && <span className="material-symbols-outlined animate-spin">progress_activity</span>}
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        )}

                        {success && (
                            <div className="flex justify-center">
                                <span className="material-symbols-outlined animate-spin text-primary text-2xl">progress_activity</span>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="w-full py-8 px-6 text-center text-slate-400 text-xs z-10">
                © 2026 ShiftMate Systems. All rights reserved.
            </footer>
        </div>
    )
}
