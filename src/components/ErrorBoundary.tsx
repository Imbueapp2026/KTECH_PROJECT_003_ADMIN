"use client";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[var(--color-primary)] p-4">
          <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] p-6 shadow-[var(--shadow-modal)]">
            <h1 className="text-xl font-semibold text-[var(--color-error)] mb-2">Something went wrong</h1>
            <p className="text-sm text-[var(--color-ink-soft)] mb-4">
              An unexpected error occurred. Please refresh the page or try again later.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="text-xs text-[var(--color-tertiary)] cursor-pointer hover:text-[var(--color-ink)]">
                  Error details
                </summary>
                <pre className="mt-2 text-xs text-[var(--color-tertiary)] bg-[var(--color-surface-sunken)] p-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full h-10 px-4 bg-[var(--color-quaternary)] text-[var(--color-primary)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity focus-ring"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
