import type { Metadata } from "next";
import { Martian_Mono } from "next/font/google";
import { AuthBridge } from "@/lib/auth/index";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const martianMono = Martian_Mono({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Avirat Admin",
  description: "Admin console for the Avirat Jewelers catalog.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${martianMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--color-surface-muted)] text-[var(--color-ink)] font-[family-name:var(--font-body)]">
        <AuthBridge>
          <ToastProvider>{children}</ToastProvider>
        </AuthBridge>
      </body>
    </html>
  );
}