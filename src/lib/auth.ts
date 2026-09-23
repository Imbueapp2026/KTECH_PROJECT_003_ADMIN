/**
 * Role-based access control helpers
 */
import { headers } from "next/headers";

export type UserRole = "admin" | "editor" | "viewer";

export interface UserSession {
  uid: string;
  email: string;
  role: UserRole;
}

/**
 * Check if the current session has the required role
 */
export async function hasRole(requiredRole: UserRole): Promise<boolean> {
  const headersList = await headers();
  const userRole = headersList.get("x-user-role") as UserRole | null;
  
  if (!userRole) return false;
  
  const roleHierarchy: Record<UserRole, number> = {
    admin: 3,
    editor: 2,
    viewer: 1,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Require a minimum role for a route handler
 * Returns 403 if the user doesn't have the required role
 */
export async function requireRole(requiredRole: UserRole): Promise<Response | null> {
  const hasRequiredRole = await hasRole(requiredRole);
  
  if (!hasRequiredRole) {
    return new Response(
      JSON.stringify({ error: "Insufficient permissions" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
  
  return null;
}

/**
 * Check if user can perform a specific action based on their role
 */
export function canPerformAction(role: UserRole, action: "read" | "write" | "delete"): boolean {
  const permissions: Record<UserRole, Record<string, boolean>> = {
    admin: { read: true, write: true, delete: true },
    editor: { read: true, write: true, delete: false },
    viewer: { read: true, write: false, delete: false },
  };
  
  return permissions[role]?.[action] ?? false;
}
