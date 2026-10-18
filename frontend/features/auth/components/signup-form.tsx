"use client";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { GoogleSignInButton } from "@/features/auth/components/google-signin-button";
import { useAuth } from "@/features/auth/context/auth-context";
import { type AuthRequest, authService } from "@/lib/firebase";

export function SignupForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const { refreshUser } = useAuth();

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget ?? undefined);
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
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Create your account
        </h1>
      </div>

      <form onSubmit={handleSubmit} method="POST" className="space-y-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Full Name</FieldLabel>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              aria-label="Full name"
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
              autoComplete="new-password"
              required
              minLength={8}
              aria-label="Password"
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
              minLength={8}
              aria-label="Confirm password"
              aria-describedby="confirm-password-description"
              className="w-full"
            />
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          disabled={isSubmitting || isGoogleLoading}
          className="w-full"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
              Creating account...
            </div>
          ) : (
            "Create Account"
          )}
        </Button>

        <FieldSeparator className="mb-2">Or continue with</FieldSeparator>

        <GoogleSignInButton
          mode="signup"
          disabled={isSubmitting}
          onLoadingChange={setIsGoogleLoading}
        />
      </form>

      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-primary hover:text-primary/80 font-medium"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
