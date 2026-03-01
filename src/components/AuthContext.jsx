import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    // Fetch user profile from the profiles table
    const fetchProfile = async (userId) => {
        if (!userId) {
            setProfile(null)
            return
        }
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
        setProfile(data)
    }

    useEffect(() => {
        let mounted = true;

        const initializeSession = async () => {
            const isPersisted = localStorage.getItem('shiftmate_session_persist');
            const isActiveTab = sessionStorage.getItem('shiftmate_session_active');

            // --- FAST PATH EXIT ---
            if (!isPersisted && !isActiveTab) {
                if (mounted) {
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                }
                supabase.auth.signOut().catch(() => { });
                return;
            }

            // Set a fallback timeout to clear loading state if Supabase hangs indefinitely
            const safetyTimeout = setTimeout(() => {
                if (mounted && loading) {
                    console.warn("Auth initialization safety timeout reached");
                    setLoading(false);
                }
            }, 8000);

            try {
                const { data: { session } } = await Promise.race([
                    supabase.auth.getSession(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase getSession timeout")), 5000))
                ]);

                const currentUser = session?.user ?? null;

                if (currentUser) {
                    sessionStorage.setItem('shiftmate_session_active', 'true');
                }

                if (mounted) {
                    setUser(currentUser);
                    if (currentUser) {
                        fetchProfile(currentUser.id).catch(console.error);
                    } else {
                        setProfile(null);
                    }
                }
            } catch (error) {
                console.error("Auth initialization failed:", error);
                if (mounted) {
                    setUser(null);
                    setProfile(null);
                }
            } finally {
                clearTimeout(safetyTimeout);
                if (mounted) setLoading(false);
            }
        };

        initializeSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            if (event === 'INITIAL_SESSION') return;

            try {
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    fetchProfile(currentUser.id).catch(console.error);
                } else {
                    setProfile(null);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [])

    const value = {
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut: () => {
            localStorage.removeItem('shiftmate_session_persist')
            sessionStorage.removeItem('shiftmate_session_active')
            return supabase.auth.signOut()
        },
        user,
        profile,
        loading,
        refreshProfile: () => user && fetchProfile(user.id)
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
