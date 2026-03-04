"use client";

import { useAuth } from "@/contexts/auth-context";
import { DashboardNavbar } from "@/components/dashboard-navbar";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, error } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const isWatchlist = pathname === "/dashboard/watchlist";

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            router.push("/login?message=Please log in to access the dashboard");
        }
    }, [user, loading, router]);

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="text-red-500 mb-4">
                        <svg
                            className="w-12 h-12 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Authentication Error
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={() => router.push("/login")}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    // Don't render if no user (will redirect)
    if (!user) {
        return null;
    }

    // Transform user profile to match navbar expectations
    const navbarUser = {
        name: user.fullName || user.displayName || "User",
        email: user.email,
        avatar: user.photoURL || undefined,
    };

    return (
        <div
            className={
                isWatchlist
                    ? "h-screen overflow-hidden bg-gray-50 dark:bg-gray-900"
                    : "min-h-screen bg-gray-50 dark:bg-gray-900"
            }
        >
            <DashboardNavbar user={navbarUser} />
            <main
                className={
                    isWatchlist ? "flex-1 h-[calc(100vh-4rem)] overflow-hidden" : "flex-1"
                }
            >
                {children}
            </main>
        </div>
    );
}
