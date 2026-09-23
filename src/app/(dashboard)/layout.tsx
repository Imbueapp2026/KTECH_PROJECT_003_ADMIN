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
  return (
    <ErrorBoundary>
      <AuthGate>
        <div className="flex flex-col md:flex-row min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <MobileTopbar />
            {children}
          </div>
        </div>
        <DatabaseKeepAlive />
      </AuthGate>
    </ErrorBoundary>
  );
}