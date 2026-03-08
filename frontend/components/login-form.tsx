"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { GoogleSignInButton } from "@/components/google-signin-button";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { type AuthRequest, authService } from "@/lib/firebase";

export function LoginForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { refreshUser } = useAuth();

    const toastShownRef = useRef(false);

    useEffect(() => {
        const message = searchParams.get("message");
        if (message && !toastShownRef.current) {
            toastShownRef.current = true;
            toast.info(message);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("message");
            window.history.replaceState({}, "", newUrl.toString());
        }
    }, [searchParams]);

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(event.currentTarget ?? undefined);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        try {
            const authRequest: AuthRequest = {
                operation: "login",
                email,
                password,
            };

            const result = await authService.authenticate(authRequest);

            if (result.success && result.user) {
                toast.success("Successfully logged in!");

                // Refresh user data in context
                await refreshUser();

                // Redirect to dashboard/market
                router.push("/dashboard/market");
            } else {
                toast.error(result.error || "Login failed");
            }
        } catch (error) {
            console.error("Login error:", error);
            toast.error("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    Welcome back
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Sign in to your account to continue
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="email">Email</FieldLabel>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            aria-label="Email"
                            aria-describedby="email-description"
                            className="w-full"
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            aria-label="Password"
                            aria-describedby="password-description"
                            className="w-full"
                        />
                    </Field>
                </FieldGroup>

                <div className="flex items-center justify-between">
                    <div className="text-sm">
                        <a
                            href="/forgot-password"
                            className="font-medium text-primary hover:text-primary/80"
                        >
                            Forgot your password?
                        </a>
                    </div>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Signing in...
                        </div>
                    ) : (
                        "Sign in"
                    )}
                </Button>

                <FieldSeparator className="mb-2">Or continue with</FieldSeparator>

                <GoogleSignInButton mode="signin" disabled={isSubmitting} />
            </form>

            <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Don&apos;t have an account?{" "}
                    <a
                        href="/signup"
                        className="font-medium text-primary hover:text-primary/80"
                    >
                        Sign up
                    </a>
                </p>
            </div>
        </div>
    );
}
