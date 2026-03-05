"use client";

import { User } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";

import { authService, UserProfile } from "@/lib/firebase";

interface AuthContextType {
    user: UserProfile | null;
    firebaseUser: User | null;
    loading: boolean;
    error: string | null;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    sessionTimeout: number | null;
    lastActivity: Date | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

interface AuthProviderProps {
    children: React.ReactNode;
}

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every minute

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sessionTimeout, setSessionTimeout] = useState<number | null>(null);
    const [lastActivity, setLastActivity] = useState<Date | null>(null);

    // Update last activity on user interactions
    const updateActivity = () => {
        setLastActivity(new Date());
        localStorage.setItem("lastActivity", new Date().toISOString());
    };

    // Check for session timeout
    const checkSessionTimeout = () => {
        const lastActivityStr = localStorage.getItem("lastActivity");
        if (!lastActivityStr || !firebaseUser) return;

        const lastActivityTime = new Date(lastActivityStr);
        const now = new Date();
        const timeDiff = now.getTime() - lastActivityTime.getTime();

        if (timeDiff > SESSION_TIMEOUT) {
            handleSignOut();
            setError("Session expired due to inactivity. Please log in again.");
        } else {
            setSessionTimeout(SESSION_TIMEOUT - timeDiff);
        }
    };

    // Refresh user profile data
    const refreshUser = async () => {
        if (!firebaseUser) return;

        try {
            setError(null);
            const userProfile = await authService.getUserProfile(firebaseUser.uid);
            setUser(userProfile);
        } catch (error) {
            console.error("Failed to refresh user profile:", error);
            setError("Failed to load user profile");
        }
    };

    // Handle sign out
    const handleSignOut = async () => {
        try {
            setLoading(true);
            setError(null);

            // Clear local storage
            localStorage.removeItem("lastActivity");
            localStorage.removeItem("authToken");
            localStorage.removeItem("userProfile");

            // Sign out from Firebase
            await authService.signOut();

            // Clear state
            setUser(null);
            setFirebaseUser(null);
            setSessionTimeout(null);
            setLastActivity(null);

            // Redirect to login
            window.location.href = "/login?message=Successfully logged out";
        } catch (error) {
            console.error("Sign out error:", error);
            setError("Failed to sign out");
        } finally {
            setLoading(false);
        }
    };

    // Set up Firebase auth state listener
    useEffect(() => {
        const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
            try {
                setLoading(true);
                setError(null);

                if (firebaseUser) {
                    setFirebaseUser(firebaseUser);

                    // Retry up to 3 times — custom token needs a moment to be exchangeable
                    let userProfile = null;
                    for (let i = 0; i < 3; i++) {
                        userProfile = await authService.getUserProfile(firebaseUser.uid);
                        if (userProfile) break;
                        await new Promise(res => setTimeout(res, 1000)); // wait 1s between retries
                    }

                    setUser(userProfile);
                    updateActivity();
                } else {
                    setFirebaseUser(null);
                    setUser(null);
                    setSessionTimeout(null);
                    setLastActivity(null);
                }
            } catch (error) {
                console.error("Auth state change error:", error);
                setError("Authentication error occurred");
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Set up activity listeners
    useEffect(() => {
        if (!firebaseUser) return;

        const events = [
            "mousedown",
            "mousemove",
            "keypress",
            "scroll",
            "touchstart",
            "click",
        ];

        const activityHandler = () => updateActivity();

        events.forEach((event) => {
            document.addEventListener(event, activityHandler, true);
        });

        return () => {
            events.forEach((event) => {
                document.removeEventListener(event, activityHandler, true);
            });
        };
    }, [firebaseUser]);

    // Set up session timeout checker
    useEffect(() => {
        if (!firebaseUser) return;

        const interval = setInterval(checkSessionTimeout, ACTIVITY_CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [firebaseUser]);

    // Initialize last activity from localStorage
    useEffect(() => {
        const lastActivityStr = localStorage.getItem("lastActivity");
        if (lastActivityStr) {
            setLastActivity(new Date(lastActivityStr));
        }
    }, []);

    const value: AuthContextType = {
        user,
        firebaseUser,
        loading,
        error,
        signOut: handleSignOut,
        refreshUser,
        sessionTimeout,
        lastActivity,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
