"use client";

import { useState } from "react";
import { AuthGate } from "@/components/shell/AuthGate";
import { MobileTopbar } from "@/components/shell/MobileTopbar";
import { Sidebar } from "@/components/shell/Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DatabaseKeepAlive } from "@/components/DatabaseKeepAlive";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <ErrorBoundary>
      <AuthGate>
        <div className="flex flex-col md:flex-row min-h-screen">
          <Sidebar
            collapsed={sidebarCollapsed}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
            onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <MobileTopbar onMenu={() => setMobileSidebarOpen((open) => !open)} />
            {children}
          </div>
        </div>
        <DatabaseKeepAlive />
      </AuthGate>
    </ErrorBoundary>
  );
}