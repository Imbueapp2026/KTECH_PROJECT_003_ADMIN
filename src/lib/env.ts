/**
 * Environment variable validation
 * Validates all required environment variables on startup
 */

interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseAdminProjectId: string;
  firebaseAdminClientEmail: string;
  firebaseAdminPrivateKey: string;
  storageUrl?: string;
}

let cachedConfig: EnvConfig | null = null;

export function validateEnv(): EnvConfig {
  if (cachedConfig) return cachedConfig;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const firebaseAdminProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const firebaseAdminClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const firebaseAdminPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const storageUrl = process.env.NEXT_PUBLIC_STORAGE_URL;

  const errors: string[] = [];

  // Supabase validation
  if (!supabaseUrl) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
  } else if (!supabaseUrl.startsWith('https://')) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must start with https://');
  }

  if (!supabaseAnonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required');
  }

  if (!supabaseServiceKey) {
    errors.push('SUPABASE_SECRET_KEY is required');
  }

  // Firebase validation
  if (!firebaseApiKey) {
    errors.push('NEXT_PUBLIC_FIREBASE_API_KEY is required');
  }

  if (!firebaseAuthDomain) {
    errors.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is required');
  }

  if (!firebaseProjectId) {
    errors.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID is required');
  }

  if (!firebaseAdminProjectId) {
    errors.push('FIREBASE_ADMIN_PROJECT_ID is required');
  }

  if (!firebaseAdminClientEmail) {
    errors.push('FIREBASE_ADMIN_CLIENT_EMAIL is required');
  } else if (!firebaseAdminClientEmail.includes('@')) {
    errors.push('FIREBASE_ADMIN_CLIENT_EMAIL must be a valid email');
  }

  if (!firebaseAdminPrivateKey) {
    errors.push('FIREBASE_ADMIN_PRIVATE_KEY is required');
  } else if (!firebaseAdminPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    errors.push('FIREBASE_ADMIN_PRIVATE_KEY must be a valid private key');
  }

  if (errors.length > 0) {
    console.error('[Env] Validation errors:', errors);
    throw new Error(
      `Environment variable validation failed:\n${errors.map(e => `- ${e}`).join('\n')}\n\n` +
      'Please check your .env.local file. See DOCS/ENVIRONMENT_VARIABLES.md for guidance.'
    );
  }

  cachedConfig = {
    supabaseUrl: supabaseUrl!,
    supabaseAnonKey: supabaseAnonKey!,
    supabaseServiceKey: supabaseServiceKey!,
    firebaseApiKey: firebaseApiKey!,
    firebaseAuthDomain: firebaseAuthDomain!,
    firebaseProjectId: firebaseProjectId!,
    firebaseAdminProjectId: firebaseAdminProjectId!,
    firebaseAdminClientEmail: firebaseAdminClientEmail!,
    firebaseAdminPrivateKey: firebaseAdminPrivateKey!,
    storageUrl: storageUrl || `${supabaseUrl}/storage/v1/object/public`,
  };

  return cachedConfig;
}

export function getEnv(): EnvConfig {
  if (!cachedConfig) {
    return validateEnv();
  }
  return cachedConfig;
}
