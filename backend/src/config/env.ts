const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Missing environment variable: ${key}`);
  }
  return value;
};

const NODE_ENV = process.env.NODE_ENV ?? "dev";
const isDev = NODE_ENV === "dev";

export const ENV = {
  NODE_ENV,

  // Firebase Config
  FIREBASE_API_KEY: requiredEnv("FIREBASE_API_KEY"),
  FIREBASE_AUTH_DOMAIN: requiredEnv("FIREBASE_AUTH_DOMAIN"),
  FIREBASE_PROJECT_ID: requiredEnv("FIREBASE_PROJECT_ID"),
  FIREBASE_STORAGE_BUCKET: requiredEnv("FIREBASE_STORAGE_BUCKET"),
  FIREBASE_MESSAGING_SENDER_ID: requiredEnv("FIREBASE_MESSAGING_SENDER_ID"),
  FIREBASE_APP_ID: requiredEnv("FIREBASE_APP_ID"),

  // Firebase Admin Config
  FIREBASE_PRIVATE_KEY: requiredEnv("FIREBASE_PRIVATE_KEY"),
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
} as const;