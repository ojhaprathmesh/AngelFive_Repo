"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFirebaseConnection = exports.firebaseFirestore = exports.firebaseAuth = exports.firebaseApp = void 0;
const tslib_1 = require("tslib");
const app_1 = require("firebase-admin/app");
const fs_1 = tslib_1.__importDefault(require("fs"));
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const resolveFirebaseConfig = () => {
    const envProjectId = process.env.FIREBASE_PROJECT_ID;
    const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (envProjectId && envClientEmail && envPrivateKey) {
        return {
            projectId: envProjectId,
            clientEmail: envClientEmail,
            privateKey: envPrivateKey.replace(/\\n/g, "\n"),
        };
    }
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath && fs_1.default.existsSync(credentialsPath)) {
        const raw = fs_1.default.readFileSync(credentialsPath, "utf8");
        const json = JSON.parse(raw);
        const projectId = json.project_id;
        const clientEmail = json.client_email;
        const privateKey = json.private_key;
        if (!projectId || !clientEmail || !privateKey) {
            throw new Error("Invalid credentials JSON. Missing project_id, client_email or private_key.");
        }
        return { projectId, clientEmail, privateKey };
    }
    throw new Error("Missing Firebase configuration. Provide FIREBASE_* env or a valid GOOGLE_APPLICATION_CREDENTIALS file.");
};
let firebaseApp;
let firebaseAuth;
let firebaseFirestore;
try {
    const config = resolveFirebaseConfig();
    if ((0, app_1.getApps)().length === 0) {
        exports.firebaseApp = firebaseApp = (0, app_1.initializeApp)({
            credential: (0, app_1.cert)({
                projectId: config.projectId,
                clientEmail: config.clientEmail,
                privateKey: config.privateKey,
            }),
            projectId: config.projectId,
        });
        console.log("✅ Firebase Admin SDK initialized successfully");
    }
    else {
        exports.firebaseApp = firebaseApp = (0, app_1.getApps)()[0];
        console.log("✅ Firebase Admin SDK already initialized");
    }
    exports.firebaseAuth = firebaseAuth = (0, auth_1.getAuth)(firebaseApp);
    exports.firebaseFirestore = firebaseFirestore = (0, firestore_1.getFirestore)(firebaseApp);
    firebaseFirestore.settings({
        ignoreUndefinedProperties: true,
    });
}
catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error);
    throw error;
}
const checkFirebaseConnection = async () => {
    try {
        await firebaseFirestore.collection("_health_check").limit(1).get();
        return true;
    }
    catch (error) {
        console.error("Firebase connection check failed:", error);
        return false;
    }
};
exports.checkFirebaseConnection = checkFirebaseConnection;
//# sourceMappingURL=firebase.js.map