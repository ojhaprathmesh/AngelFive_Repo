import { toast } from "sonner";
import { redirect } from "next/navigation";
import { FirebaseClientAuth, AuthResult } from "./firebase";
import { capitalize } from "./utils";

// Type definitions
export type SubmissionType = "LOGIN" | "SIGNUP";

export interface FormData {
  submissionType: SubmissionType;
  email: string;
  password: string;
  fullName?: string;
  confirmPassword?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface SubmissionPayload {
  submissionType: SubmissionType;
  email: string;
  password: string;
  fullName: string | null;
  confirmPassword: string | null;
  timestamp: string;
}

export interface ServerResponse {
  status: "success" | "error";
  message: string;
  data?: unknown;
  timestamp: string;
}

/**
 * Validates email format using a comprehensive regex pattern
 */
const validateEmail = (email: string): boolean => {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
};

/**
 * Validates password complexity requirements
 */
const validatePassword = (
  password: string
): { isValid: boolean; message?: string } => {
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return {
      isValid: false,
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    };
  }

  return { isValid: true };
};

/**
 * Sanitizes input by trimming whitespace and removing potentially harmful characters
 */
const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, "");
};

/**
 * Comprehensive validation logic for form data
 */
export const validateFormData = (data: FormData): ValidationResult => {
  const errors: Record<string, string> = {};

  // Email validation
  if (!data.email || !data.email.trim()) {
    errors.email = "Email address is required";
  } else if (!validateEmail(data.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  // Password validation
  if (!data.password || !data.password.trim()) {
    errors.password = "Password is required";
  } else {
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.message!;
    }
  }

  // SIGNUP-specific validations
  if (data.submissionType === "SIGNUP") {
    // Full name validation
    if (!data.fullName || !data.fullName.trim()) {
      errors.fullName = "Full name is required for signup";
    } else if (data.fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters long";
    }

    // Confirm password validation
    if (!data.confirmPassword || !data.confirmPassword.trim()) {
      errors.confirmPassword = "Password confirmation is required";
    } else if (data.password !== data.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Creates a structured submission payload
 */
const createSubmissionPayload = (data: FormData): SubmissionPayload => {
  return {
    submissionType: data.submissionType,
    email: sanitizeInput(data.email),
    password: data.password, // Don't sanitize password as it might contain special chars
    fullName:
      data.submissionType === "SIGNUP" && data.fullName
        ? sanitizeInput(data.fullName)
        : null,
    confirmPassword:
      data.submissionType === "SIGNUP" && data.confirmPassword
        ? data.confirmPassword
        : null,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Sends the validated payload to Firebase Authentication
 */
const authenticateWithFirebase = async (
  payload: SubmissionPayload
): Promise<AuthResult> => {
  const firebaseAuth = FirebaseClientAuth.getInstance();

  try {
    if (payload.submissionType === "LOGIN") {
      return await firebaseAuth.signIn(payload.email, payload.password);
    } else {
      // For signup, we need the full name
      if (!payload.fullName) {
        throw new Error("Full name is required for signup");
      }
      return await firebaseAuth.signUp(
        payload.email,
        payload.password,
        payload.fullName
      );
    }
  } catch (error) {
    console.error("Firebase authentication error:", error);
    throw error;
  }
};

/**
 * Main form submission handler function
 */
export const handleFormSubmission = async (
  data: FormData
): Promise<boolean> => {
  // Show loading toast
  const loadingToastId = toast.loading(
    `Processing ${data.submissionType.toLowerCase()}...`,
    {
      position: "bottom-right",
    }
  );

  try {
    // Validate form data
    const validation = validateFormData(data);

    if (!validation.isValid) {
      // Dismiss loading toast
      toast.dismiss(loadingToastId);

      // Show validation errors
      const errorMessages = Object.values(validation.errors);
      toast.error(`Validation failed: ${errorMessages.join(", ")}`, {
        position: "bottom-right",
        duration: 5000,
      });
      return false;
    }

    // Create submission payload
    const payload = createSubmissionPayload(data);

    // Authenticate with Firebase
    const authResult = await authenticateWithFirebase(payload);

    // Dismiss loading toast
    toast.dismiss(loadingToastId);

    if (authResult.success) {
      // Show success notification
      toast.success(
        `${capitalize(data.submissionType)} successful! Welcome${
          authResult.user?.fullName ? `, ${authResult.user.fullName}` : ""
        }!`,
        {
          position: "bottom-right",
          duration: 3000,
        }
      );

      // Redirect to dashboard/market
      setTimeout(() => {
        redirect("/dashboard/market");
      }, 1500); // Small delay to show the success toast

      return true;
    } else {
      // Show error notification
      toast.error(
        authResult.error || "An error occurred during authentication",
        {
          position: "bottom-right",
          duration: 5000,
        }
      );
      return false;
    }
  } catch (error) {
    // Dismiss the specific loading toast
    toast.dismiss(loadingToastId);

    // Handle different types of errors
    let errorMessage = "An unexpected error occurred during authentication";

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Show error notification
    toast.error(errorMessage, {
      position: "bottom-right",
      duration: 5000,
    });

    // Log error for debugging (in development)
    if (process.env.NODE_ENV === "development") {
      console.error("Form submission error:", error);
    }

    return false;
  }
};

/**
 * Utility function to extract form data from HTML form elements
 */
export const extractFormData = (
  formElement: HTMLFormElement,
  submissionType: SubmissionType
): FormData => {
  const formData = new FormData(formElement);

  return {
    submissionType,
    email: (formData.get("email") as string) || "",
    password: (formData.get("password") as string) || "",
    fullName:
      submissionType === "SIGNUP"
        ? (formData.get("name") as string) || ""
        : undefined,
    confirmPassword:
      submissionType === "SIGNUP"
        ? (formData.get("confirm-password") as string) || ""
        : undefined,
  };
};
