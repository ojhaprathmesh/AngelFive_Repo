type NodeEnv = "development" | "production" | "test";

interface Env {
    PORT: number;
    NODE_ENV: NodeEnv;

    // Deployment URLs
    FRONTEND_URL: string;
    ML_SERVICE_URL: string;

    // Firebase Config
    FIREBASE_API_KEY: string;
    FIREBASE_AUTH_DOMAIN: string;
    FIREBASE_PROJECT_ID: string;
    FIREBASE_STORAGE_BUCKET: string;
    FIREBASE_MESSAGING_SENDER_ID: string;
    FIREBASE_APP_ID: string;

    // Firebase Admin Config
    FIREBASE_PRIVATE_KEY: string;
    FIREBASE_CLIENT_EMAIL: string;

    // SmartAPI Config
    SMARTAPI_CLIENT_CODE: string;
    SMARTAPI_PASSWORD: string;
    SMARTAPI_TOTP_SECRET: string;
    SMARTAPI_API_KEY: string;
    SMARTAPI_LOCAL_IP: string;
    SMARTAPI_PUBLIC_IP: string;
    SMARTAPI_MAC_ADDRESS: string;
}

const requiredEnv = (key: keyof NodeJS.ProcessEnv): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`❌ Missing environment variable: ${key}`);
    }
    return value;
};

const requiredNumber = (key: keyof NodeJS.ProcessEnv): number => {
    const value = requiredEnv(key);
    const num = Number(value);
    if (Number.isNaN(num)) {
        throw new Error(`❌ Environment variable ${key} must be a number`);
    }
    return num;
};

const rawNodeEnv = process.env.NODE_ENV ?? "development";

if (!["development", "production", "test"].includes(rawNodeEnv)) {
    throw new Error("❌ Invalid NODE_ENV value");
}

const NODE_ENV = rawNodeEnv as NodeEnv;
const isDev = NODE_ENV === "development";
export const ENV: Env = {
    PORT: process.env.PORT ? requiredNumber("PORT") : 5000,
    NODE_ENV,

    // Firebase Config
    FIREBASE_API_KEY: requiredEnv("FIREBASE_API_KEY"),
    FIREBASE_AUTH_DOMAIN: requiredEnv("FIREBASE_AUTH_DOMAIN"),
    FIREBASE_PROJECT_ID: requiredEnv("FIREBASE_PROJECT_ID"),
    FIREBASE_STORAGE_BUCKET: requiredEnv("FIREBASE_STORAGE_BUCKET"),
    FIREBASE_MESSAGING_SENDER_ID: requiredEnv("FIREBASE_MESSAGING_SENDER_ID"),
    FIREBASE_APP_ID: requiredEnv("FIREBASE_APP_ID"),

    // Firebase Admin Config
    FIREBASE_PRIVATE_KEY: requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    FIREBASE_CLIENT_EMAIL: requiredEnv("FIREBASE_CLIENT_EMAIL"),

    // SmartAPI Config
    SMARTAPI_CLIENT_CODE: requiredEnv("SMARTAPI_CLIENT_CODE"),
    SMARTAPI_PASSWORD: requiredEnv("SMARTAPI_PASSWORD"),
    SMARTAPI_TOTP_SECRET: requiredEnv("SMARTAPI_TOTP_SECRET"),
    SMARTAPI_API_KEY: requiredEnv("SMARTAPI_API_KEY"),
    SMARTAPI_LOCAL_IP: requiredEnv("SMARTAPI_LOCAL_IP"),
    SMARTAPI_PUBLIC_IP: requiredEnv("SMARTAPI_PUBLIC_IP"),
    SMARTAPI_MAC_ADDRESS: requiredEnv("SMARTAPI_MAC_ADDRESS"),

    // Deployment URLs
    FRONTEND_URL: isDev
        ? "http://localhost:3000"
        : requiredEnv("FRONTEND_URL"),

    ML_SERVICE_URL: isDev
        ? "http://localhost:8000"
        : requiredEnv("ML_SERVICE_URL"),
};
