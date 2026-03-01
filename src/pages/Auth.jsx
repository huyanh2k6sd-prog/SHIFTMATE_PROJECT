import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function Auth() {
    const location = useLocation()
    const [isSignUp, setIsSignUp] = useState(location.state?.mode === 'signup')
    const [isForgotPassword, setIsForgotPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [dob, setDob] = useState('')
    const [phone, setPhone] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [fieldErrors, setFieldErrors] = useState({})
    const [error, setError] = useState(null)
    const [successMessage, setSuccessMessage] = useState(null)
    const [rememberMe, setRememberMe] = useState(false)
    const [forgotEmail, setForgotEmail] = useState('')
    const navigate = useNavigate()

    // Sync with navigation state
    useEffect(() => {
        if (location.state?.mode) {
            setIsSignUp(location.state.mode === 'signup')
        }
    }, [location.state])

    // Load saved username if Remember Me was used
    useEffect(() => {
        const savedUsername = localStorage.getItem('shiftmate_remember_user')
        if (savedUsername) {
            setUsername(savedUsername)
            setRememberMe(true)
        }
    }, [])

    const handleBlur = (field) => {
        const newErrors = { ...fieldErrors }

        switch (field) {
            case 'username':
                if (!username.trim()) {
                    newErrors.username = "Username is required"
                } else if (username.length <= 5) {
                    newErrors.username = "Username must be more than 5 characters"
                } else {
                    delete newErrors.username
                }
                break;
            case 'email':
                if (isSignUp) {
                    if (!email.trim()) {
                        newErrors.email = "Email is required"
                    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        newErrors.email = "Please enter a valid email address"
                    } else {
                        delete newErrors.email
                    }
                }
                break;
            case 'password':
                if (!password) {
                    newErrors.password = "Password is required"
                } else if (password.length < 6) {
                    newErrors.password = "Password must be at least 6 characters"
                } else {
                    delete newErrors.password
                    if (isSignUp && confirmPassword) {
                        if (password !== confirmPassword) {
                            newErrors.confirmPassword = "Passwords do not match"
                        } else {
                            delete newErrors.confirmPassword
                        }
                    }
                }
                break;
            case 'fullName':
                if (isSignUp) {
                    if (!fullName.trim()) {
                        newErrors.fullName = "Full name is required"
                    } else {
                        delete newErrors.fullName
                    }
                }
                break;
            case 'dob':
                if (isSignUp) {
                    if (!dob) {
                        newErrors.dob = "Date of birth is required"
                    } else {
                        delete newErrors.dob
                    }
                }
                break;
            case 'phone':
                if (isSignUp) {
                    if (!phone.trim()) {
                        newErrors.phone = "Phone number is required"
                    } else {
                        const phoneDigits = phone.replace(/\D/g, '')
                        if (phoneDigits.length !== 10 || !phoneDigits.startsWith('0')) {
                            newErrors.phone = "Phone number must be 10 digits and start with 0 (e.g. 0912345678)"
                        } else {
                            delete newErrors.phone
                        }
                    }
                }
                break;
            case 'confirmPassword':
                if (isSignUp) {
                    if (!confirmPassword) {
                        newErrors.confirmPassword = "Please confirm your password"
                    } else if (password !== confirmPassword) {
                        newErrors.confirmPassword = "Passwords do not match"
                    } else {
                        delete newErrors.confirmPassword
                    }
                }
                break;
        }

        setFieldErrors(newErrors)
    }

    const validateForm = () => {
        const newErrors = {}
        let isValid = true

        // Username validation
        if (!username.trim()) {
            newErrors.username = "Username is required"
            isValid = false
        } else if (username.length <= 5) {
            newErrors.username = "Username must be more than 5 characters"
            isValid = false
        }

        // Password validation
        if (!password) {
            newErrors.password = "Password is required"
            isValid = false
        } else if (password.length < 6) {
            newErrors.password = "Password must be at least 6 characters"
            isValid = false
        }

        if (isSignUp) {
            // Full name validation
            if (!fullName.trim()) {
                newErrors.fullName = "Full name is required"
                isValid = false
            }

            // Email validation
            if (!email.trim()) {
                newErrors.email = "Email is required"
                isValid = false
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                newErrors.email = "Please enter a valid email address"
                isValid = false
            }

            // DOB validation
            if (!dob) {
                newErrors.dob = "Date of birth is required"
                isValid = false
            }

            // Phone validation
            if (!phone.trim()) {
                newErrors.phone = "Phone number is required"
                isValid = false
            } else {
                const phoneDigits = phone.replace(/\D/g, '')
                if (phoneDigits.length !== 10 || !phoneDigits.startsWith('0')) {
                    newErrors.phone = "Phone number must be 10 digits and start with 0"
                    isValid = false
                }
            }

            // Confirm password validation
            if (!confirmPassword) {
                newErrors.confirmPassword = "Please confirm your password"
                isValid = false
            } else if (password !== confirmPassword) {
                newErrors.confirmPassword = "Passwords do not match"
                isValid = false
            }
        }

        setFieldErrors(newErrors)
        return isValid
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        if (validateForm()) {
            if (isSignUp) {
                setLoading(true)

                // Check if username is unique
                const { data: existingUser } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('username', username.trim().toLowerCase())
                    .maybeSingle()

                if (existingUser) {
                    setLoading(false)
                    setFieldErrors(prev => ({ ...prev, username: 'Username is already taken' }))
                    return
                }

                // Prevent automatic redirect during sign-up
                sessionStorage.setItem('shiftmate_signing_up', 'true')

                const { data, error: signUpError } = await supabase.auth.signUp({
                    email: email.trim().toLowerCase(),
                    password: password,
                    options: {
                        data: {
                            full_name: fullName.trim(),
                            username: username.trim().toLowerCase(),
                            dob: dob,
                            phone: phone.replace(/\D/g, '')
                        }
                    }
                })

                if (signUpError) {
                    setLoading(false)
                    if (signUpError.message.includes('already registered')) {
                        setError('This email is already registered. Please use another email or sign in.')
                    } else {
                        setError(signUpError.message)
                    }
                    return
                }

                // Update the profile with username and phone
                if (data?.user) {
                    await supabase.from('profiles').upsert({
                        id: data.user.id,
                        full_name: fullName.trim(),
                        username: username.trim().toLowerCase(),
                        phone_number: phone.replace(/\D/g, '')
                    })
                }

                // Sign out so user stays on auth page (Supabase auto-logs in when email confirm is off)
                await supabase.auth.signOut()

                setLoading(false)
                // Reset fields and switch to Sign In
                setPassword('')
                setConfirmPassword('')
                setFullName('')
                setDob('')
                setPhone('')
                setEmail('')
                setSuccessMessage('Account created successfully! Please sign in.')
                setIsSignUp(false)

                // Clear the signing up flag so normal auth logic resumes
                sessionStorage.removeItem('shiftmate_signing_up')

            } else {
                setLoading(true)

                let loginEmail = ''

                // Check if input looks like an email
                if (username.includes('@')) {
                    loginEmail = username.trim().toLowerCase()
                } else {
                    // Look up the real email from the username using our DB function
                    const { data: emailData, error: lookupError } = await supabase
                        .rpc('get_email_by_username', { p_username: username.trim().toLowerCase() })

                    if (lookupError || !emailData) {
                        setLoading(false)
                        setError('Incorrect username or password.')
                        return
                    }
                    loginEmail = emailData
                }

                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: loginEmail,
                    password: password
                })
                setLoading(false)

                if (signInError) {
                    setError('Incorrect username or password.')
                } else {
                    // Handle Remember Me: session persistence
                    if (rememberMe) {
                        localStorage.setItem('shiftmate_remember_user', username.trim().toLowerCase())
                        localStorage.setItem('shiftmate_session_persist', 'true')
                    } else {
                        localStorage.removeItem('shiftmate_remember_user')
                        localStorage.removeItem('shiftmate_session_persist')
                    }
                    // Always mark the current tab as active (survives refresh, clears on browser close)
                    sessionStorage.setItem('shiftmate_session_active', 'true')
                    navigate('/workspace')
                }
            }
        }
    }

    const handleForgotPassword = async (e) => {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        if (!forgotEmail.trim()) {
            setError('Please enter your email address.')
            return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
            setError('Please enter a valid email address.')
            return
        }

        setLoading(true)
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
            redirectTo: `${window.location.origin}/reset-password`
        })
        setLoading(false)

        if (resetError) {
            setError(resetError.message)
        } else {
            setSuccessMessage('Password reset link has been sent to your email. Please check your inbox.')
        }
    }

    // Forgot Password View
    if (isForgotPassword) {
        return (
            <div style={{
                '--color-primary': '#99ffda',
                '--color-background-light': '#f5f8f7',
                '--color-background-dark': '#0f231c',
                '--color-brand-navy': '#0A2620',
            }} className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display relative z-0">
                <header className="fixed top-0 left-0 right-0 h-16 w-full bg-white dark:bg-slate-900 flex items-center justify-between px-6 z-50 border-b border-slate-100 dark:border-slate-800 shadow-sm">
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
                            <button
                                onClick={() => { setIsForgotPassword(false); setError(null); setSuccessMessage(null); setForgotEmail('') }}
                                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors mb-6"
                            >
                                <span className="material-symbols-outlined text-lg">arrow_back</span>
                                Back to Sign In
                            </button>

                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl text-teal-700">lock_reset</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Forgot Password?</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                    Enter your email address and we'll send you a link to reset your password.
                                </p>
                            </div>

                            {successMessage && (
                                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3">
                                    <span className="material-symbols-outlined text-emerald-500 shrink-0">check_circle</span>
                                    <p className="text-sm text-emerald-600 dark:text-emerald-400">{successMessage}</p>
                                </div>
                            )}

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                                    <span className="material-symbols-outlined text-red-500 shrink-0">error</span>
                                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                </div>
                            )}

                            <form className="space-y-5" onSubmit={handleForgotPassword}>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="forgot-email">Email Address</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">mail</span>
                                        <input
                                            className="w-full pl-12 pr-4 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none"
                                            id="forgot-email"
                                            name="forgot-email"
                                            placeholder="you@example.com"
                                            type="email"
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        className="w-full py-4 bg-primary hover:bg-[color:var(--color-primary-hover,7fecc7)] text-brand-navy font-bold rounded-lg shadow-sm shadow-primary/20 transition-all transform active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                                        type="submit"
                                        disabled={loading}
                                    >
                                        {loading && <span className="material-symbols-outlined animate-spin">progress_activity</span>}
                                        Send Reset Link
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>

                <footer className="w-full py-8 px-6 text-center text-slate-400 text-xs z-10">
                    © 2026 ShiftMate Systems. All rights reserved.
                </footer>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-slate-900 min-h-screen flex flex-col font-display relative z-0">

            <header className="fixed top-0 left-0 right-0 h-16 w-full bg-white dark:bg-slate-900 flex items-center justify-between px-6 z-50 border-b border-slate-100 dark:border-slate-800 shadow-sm">
                <div
                    onClick={() => navigate('/workspace')}
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">ShiftMate</span>
                </div>
                <div className="hidden md:flex items-center gap-6">
                    <a className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" href="#">Help Center</a>
                    <a className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" href="#">Contact Support</a>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center px-4 pb-12 pt-28 z-10">
                <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 auth-card rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                    <div className="flex border-b border-slate-100 dark:border-slate-800">
                        <button
                            onClick={() => {
                                setIsSignUp(true)
                                setFieldErrors({})
                                setError(null)
                                setSuccessMessage(null)
                            }}
                            className={`flex-1 py-5 text-sm font-bold border-b-2 transition-colors ${isSignUp ? 'border-primary text-slate-900 dark:text-slate-100' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            Sign Up
                        </button>
                        <button
                            onClick={() => {
                                setIsSignUp(false)
                                setFieldErrors({})
                                setError(null)
                            }}
                            className={`flex-1 py-5 text-sm font-bold border-b-2 transition-colors ${!isSignUp ? 'border-primary text-slate-900 dark:text-slate-100' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            Sign In
                        </button>
                    </div>

                    <div className="p-8 md:p-10">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {isSignUp ? "Create your account" : "Welcome Back"}
                            </h2>
                        </div>

                        {successMessage && (
                            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3">
                                <span className="material-symbols-outlined text-emerald-500 shrink-0">check_circle</span>
                                <p className="text-sm text-emerald-600 dark:text-emerald-400">{successMessage}</p>
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                                <span className="material-symbols-outlined text-red-500 shrink-0">error</span>
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            {isSignUp && (
                                <>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="full-name">Full Name</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">person</span>
                                            <input className="w-full pl-12 pr-4 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none" id="full-name" name="full-name" placeholder="Chef Ramsay" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} onBlur={() => handleBlur('fullName')} />
                                        </div>
                                        {fieldErrors.fullName && <p className="text-red-500 text-xs mt-1">{fieldErrors.fullName}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="email">Email</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">mail</span>
                                            <input className="w-full pl-12 pr-4 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none" id="email" name="email" placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => handleBlur('email')} />
                                        </div>
                                        {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="dob">Date of Birth</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">calendar_month</span>
                                                <input className="w-full pl-12 pr-4 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none" id="dob" name="dob" placeholder="MM/DD/YYYY" type="date" value={dob} onChange={(e) => setDob(e.target.value)} onBlur={() => handleBlur('dob')} />
                                            </div>
                                            {fieldErrors.dob && <p className="text-red-500 text-xs mt-1">{fieldErrors.dob}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="phone">Phone Number</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">call</span>
                                                <input className="w-full pl-12 pr-4 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none" id="phone" name="phone" placeholder="0912 345 678" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => handleBlur('phone')} />
                                            </div>
                                            {fieldErrors.phone && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="username">{isSignUp ? 'Username' : 'Username or Email'}</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">person</span>
                                    <input
                                        className="w-full pl-12 pr-4 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none"
                                        id="username"
                                        name="username"
                                        placeholder={isSignUp ? 'cheframsay' : 'username or email'}
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                                        onBlur={() => handleBlur('username')}
                                    />
                                </div>
                                {fieldErrors.username && <p className="text-red-500 text-xs mt-1">{fieldErrors.username}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="password">Password</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">lock</span>
                                    <input
                                        className="w-full pl-12 pr-12 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none"
                                        id="password"
                                        name="password"
                                        placeholder="••••••••"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onBlur={() => handleBlur('password')}
                                    />
                                    <button
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        <span className="material-symbols-outlined text-xl">
                                            {showPassword ? "visibility" : "visibility_off"}
                                        </span>
                                    </button>
                                </div>
                                {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}

                                {!isSignUp && (
                                    <div className="flex items-center justify-between pt-1">
                                        <div className="flex items-center">
                                            <input className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800 cursor-pointer" id="remember-me" name="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                                            <label className="ml-2 block text-sm text-slate-600 dark:text-slate-400 font-medium cursor-pointer" htmlFor="remember-me">
                                                Remember me
                                            </label>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setIsForgotPassword(true); setError(null); setSuccessMessage(null) }}
                                            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isSignUp && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="confirm-password">Confirm Password</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">lock_reset</span>
                                        <input
                                            className="w-full pl-12 pr-12 py-3 bg-background-light dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all outline-none"
                                            id="confirm-password"
                                            name="confirm-password"
                                            placeholder="••••••••"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            onBlur={() => handleBlur('confirmPassword')}
                                        />
                                        <button
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            <span className="material-symbols-outlined text-xl">
                                                {showConfirmPassword ? "visibility" : "visibility_off"}
                                            </span>
                                        </button>
                                    </div>
                                    {fieldErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
                                </div>
                            )}

                            <div className="pt-4 space-y-3">
                                <button
                                    className="w-full py-4 bg-primary hover:bg-[color:var(--color-primary-hover,7fecc7)] text-brand-navy font-bold rounded-lg shadow-sm shadow-primary/20 transition-all transform active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading && <span className="material-symbols-outlined animate-spin">progress_activity</span>}
                                    {isSignUp ? "Create Account" : "Sign In"}
                                </button>
                            </div>

                            {isSignUp && (
                                <div className="text-center pt-2">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">Already have an account?</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSignUp(false)
                                            setFieldErrors({})
                                        }}
                                        className="ml-2 text-sm font-bold text-teal-700 dark:text-[#7fecc7] hover:text-teal-900 dark:hover:text-white transition-colors"
                                    >
                                        Sign in
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </main>

            <footer className="w-full py-8 px-6 text-center text-slate-400 text-xs z-10">
                © 2026 ShiftMate. All rights reserved.
            </footer>
        </div>
    )
}
