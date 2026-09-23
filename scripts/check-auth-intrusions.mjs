#!/usr/bin/env node

/**
 * Intrusion detection script for auth failures.
 * 
 * This script analyzes auth failure logs to detect suspicious patterns:
 * - 10 failed attempts from one IP in 5 minutes
 * - 3 failed attempts for one email in 5 minutes
 * 
 * Usage: node scripts/check-auth-intrusions.mjs
 * 
 * Note: This is a v1 implementation that only flags suspicious activity.
 * It does not automatically block users.
 * 
 * For production, integrate with your log aggregation system (e.g., CloudWatch, Datadog, Loki)
 * or store auth failures in a database table for querying.
 */

// Example auth failure log structure (from AUTH-02):
// console.warn("[auth] 401 — missing token", { route, ip, ts })
// console.warn("[auth] 401 — token verification failed", { route, reason, ip, ts })

// In production, this would come from your log aggregation system or database
// For this example, we'll use an in-memory array of recent failures
const recentFailures = [];

/**
 * Add an auth failure to the tracking system
 * Call this from your auth failure logging (firebase-admin.ts)
 */
export function trackAuthFailure(failure) {
  recentFailures.push(failure);
  
  // Clean up failures older than 1 hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const cutoffIndex = recentFailures.findIndex(f => new Date(f.ts).getTime() < oneHourAgo);
  if (cutoffIndex !== -1) {
    recentFailures.splice(0, cutoffIndex);
  }
}

/**
 * Check for suspicious patterns in auth failures
 */
function checkIntrusions() {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  
  const recentFailures5min = recentFailures.filter(
    f => new Date(f.ts).getTime() >= fiveMinutesAgo
  );
  
  const alerts = [];
  
  // Check for 10+ failed attempts from one IP in 5 minutes
  const ipCounts = new Map();
  for (const failure of recentFailures5min) {
    ipCounts.set(failure.ip, (ipCounts.get(failure.ip) || 0) + 1);
  }
  
  for (const [ip, count] of ipCounts.entries()) {
    if (count >= 10) {
      alerts.push({
        type: "ip_flood",
        severity: "high",
        ip,
        count,
        window: "5 minutes",
        message: `${count} failed auth attempts from IP ${ip} in 5 minutes`,
      });
    }
  }
  
  // Check for 3+ failed attempts for one route/email pattern in 5 minutes
  // Note: Since we don't log email in the current implementation (security measure),
  // we check for repeated failures on the same route from the same IP
  const routeIpCounts = new Map();
  for (const failure of recentFailures5min) {
    const key = `${failure.ip}:${failure.route}`;
    routeIpCounts.set(key, (routeIpCounts.get(key) || 0) + 1);
  }
  
  for (const [key, count] of routeIpCounts.entries()) {
    if (count >= 3) {
      const [ip, route] = key.split(":");
      alerts.push({
        type: "targeted_attack",
        severity: "medium",
        ip,
        route,
        count,
        window: "5 minutes",
        message: `${count} failed auth attempts from IP ${ip} targeting route ${route} in 5 minutes`,
      });
    }
  }
  
  return alerts;
}

/**
 * Main function to run intrusion detection
 */
function main() {
  console.log("🔍 Running auth intrusion detection...");
  
  const alerts = checkIntrusions();
  
  if (alerts.length === 0) {
    console.log("✅ No suspicious activity detected.");
  } else {
    console.log(`⚠️  Found ${alerts.length} suspicious pattern(s):`);
    for (const alert of alerts) {
      console.log(`\n[${alert.severity.toUpperCase()}] ${alert.type}`);
      console.log(`  ${alert.message}`);
      console.log(`  IP: ${alert.ip}`);
      if (alert.route) console.log(`  Route: ${alert.route}`);
    }
    console.log("\n⚠️  Review these alerts and consider manual investigation or blocking.");
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { checkIntrusions };
