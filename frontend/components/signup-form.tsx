"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { type AuthRequest, authService } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { GoogleSignInButton } from "@/components/google-signin-button";

export function SignupForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();
    const { refreshUser } = useAuth();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(event.currentTarget);
        const fullName = formData.get("name") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const confirmPassword = formData.get("confirmPassword") as string;

        try {
            const authRequest: AuthRequest = {
                operation: "signup",
                email,
                password,
                confirmPassword,
                fullName,
            };

            const result = await authService.authenticate(authRequest);

            if (result.success && result.user) {
                toast.success("Account created successfully!");

                // Refresh user data in context
                await refreshUser();

                // Redirect to dashboard/market
                router.push("/dashboard/market");
            } else {
                toast.error(result.error || "Signup failed");
            }
        } catch (error) {
            console.error("Signup error:", error);
            toast.error("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    Create your account
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <Field>
                    <FieldLabel htmlFor="name">Full Name</FieldLabel>
                    <Input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        aria-describedby="name-description"
                        className="w-full"
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
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
                        autoComplete="new-password"
                        required
                        minLength={6}
                        aria-describedby="password-description"
                        className="w-full"
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={6}
                        aria-describedby="confirm-password-description"
                        className="w-full"
                    />
                </Field>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating account...
                        </div>
                    ) : (
                        "Create Account"
                    )}
                </Button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                            Or continue with
                        </span>
                    </div>
                </div>

                <GoogleSignInButton mode="signup" disabled={isSubmitting} />
            </form>

            <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Already have an account?{" "}
                    <a
                        href="/login"
                        className="font-medium text-primary hover:text-primary/80"
                    >
                        Sign in
                    </a>
                </p>
            </div>
        </div>
    );
}
