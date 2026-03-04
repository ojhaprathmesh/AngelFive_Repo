"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

declare global {
    interface Window {
        google: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential: string }) => void;
                        auto_select?: boolean;
                        cancel_on_tap_outside?: boolean;
                    }) => void;
                    prompt: () => void;
                };
            };
        };
    }
}

interface GoogleSignInButtonProps {
    mode?: "signin" | "signup";
    disabled?: boolean;
}

export function GoogleSignInButton({
    mode = "signin",
    disabled = false,
}: GoogleSignInButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { refreshUser } = useAuth();

    const handleCredentialResponse = async (response: { credential: string }) => {
        setIsLoading(true);
        try {
            const apiUrl =
                process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
            const res = await fetch(`${apiUrl}/api/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: response.credential }),
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.message || "Google sign-in failed");
                return;
            }

            if (data.data?.token) {
                await signInWithCustomToken(auth, data.data.token);
            }

            await refreshUser();
            toast.success(
                mode === "signup"
                    ? "Account created successfully!"
                    : "Successfully signed in!",
            );
            router.push("/dashboard/market");
        } catch (err) {
            console.error("Google sign-in error:", err);
            toast.error("An unexpected error occurred during Google sign-in");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) return;

        const init = () => {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: handleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: true,
            });
        };

        if (window.google?.accounts?.id) {
            init();
            return;
        }

        const scriptId = "google-gis-script";
        if (!document.getElementById(scriptId)) {
            const script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = init;
            document.head.appendChild(script);
        } else {
            const poll = setInterval(() => {
                if (window.google?.accounts?.id) {
                    clearInterval(poll);
                    init();
                }
            }, 100);
            return () => clearInterval(poll);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleClick = () => {
        if (!window.google?.accounts?.id) {
            toast.error("Google Sign-In is not ready yet. Please try again.");
            return;
        }
        window.google.accounts.id.prompt();
    };

    return (
        <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled || isLoading}
            onClick={handleClick}
        >
            {isLoading ? (
                <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    Signing in...
                </>
            ) : (
                <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    {mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
                </>
            )}
        </Button>
    );
}
