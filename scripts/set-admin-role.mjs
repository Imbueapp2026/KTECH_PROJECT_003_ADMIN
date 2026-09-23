#!/usr/bin/env node

/**
 * Set Firebase custom claims for admin roles.
 * Usage: node scripts/set-admin-role.mjs <uid> <role>
 * 
 * Roles:
 *   - staff: Can read and edit, but not delete
 *   - owner: Full CRUD access
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error("Usage: node scripts/set-admin-role.mjs <uid> <role>");
  console.error("Roles: staff, owner");
  process.exit(1);
}

const [uid, role] = args;

if (role !== "staff" && role !== "owner") {
  console.error("Invalid role. Must be 'staff' or 'owner'.");
  process.exit(1);
}

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const keyB64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!projectId || !clientEmail || !keyB64) {
  console.error("Missing Firebase Admin credentials. Check .env file.");
  process.exit(1);
}

const decoded = JSON.parse(Buffer.from(keyB64, "base64").toString("utf8"));

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: decoded.project_id,
      clientEmail: decoded.client_email,
      privateKey: decoded.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

const auth = getAuth();

try {
  await auth.setCustomUserClaims(uid, { role });
  console.log(`✅ Successfully set role '${role}' for user ${uid}`);
  
  // Verify the claim was set
  const user = await auth.getUser(uid);
  console.log(`   Current custom claims:`, user.customClaims);
} catch (error) {
  console.error("❌ Error setting role:", error.message);
  process.exit(1);
}
