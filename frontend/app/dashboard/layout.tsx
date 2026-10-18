"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";

import { DashboardNavbar } from "@/components/dashboard-navbar";
import { useAuth } from "@/features/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isWatchlist = pathname === "/dashboard/watchlist";

  // Redirect to login page if not authenticated
  useEffect(() => {
    if (!loading && !user && process.env.NEXT_PUBLIC_E2E_TEST !== "true") {
      router.push("/login?message=Please log in to access the dashboard");
    }
  }, [user, loading, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-md p-6 text-center">
          <div className="mb-4 text-red-500">
            <svg
              className="mx-auto h-12 w-12"
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
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            Authentication Error
          </h2>
          <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Don't render if no user (will redirect) unless in E2E test mode
  if (!user && process.env.NEXT_PUBLIC_E2E_TEST !== "true") {
    return null;
  }

  // Transform user profile to match navbar expectations
  const navbarUser = user
    ? {
        name: user.fullName || user.displayName || "User",
        email: user.email,
        avatar: user.photoURL || undefined,
      }
    : {
        name: "Test User",
        email: "test@example.com",
        avatar: undefined,
      };

  return (
    <div
      className={
        isWatchlist
          ? "h-screen overflow-hidden bg-gray-50 dark:bg-gray-900"
          : "min-h-screen bg-gray-50 dark:bg-gray-900"
      }
    >
      <h1 className="sr-only">AngelFive Dashboard</h1>
      <DashboardNavbar user={navbarUser} />
      <main
        className={
          isWatchlist ? "h-[calc(100vh-4rem)] flex-1 overflow-hidden" : "flex-1"
        }
      >
        {children}
      </main>
    </div>
  );
}
