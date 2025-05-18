import "@/styles/globals.css";
import React from "react";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import ErrorHandler from "@/components/ErrorHandler";
import { ToastProvider } from "@/components/ui/ToastContainer";

import { DevtoolsProvider } from 'creatr-devtools'
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "ZeroHack",
    template: "%s | ZeroHack",
  },
  description: "Production-grade autonomous threat detection and response system with real-time AI analysis",
  applicationName: "ZeroHack: TrustSec",
  keywords: ["security", "endpoint protection", "AI", "blockchain", "cybersecurity", "autonomous response", "threat detection"],
  authors: [{ name: "ZeroHack Team" }],
  creator: "ZeroHack Team",
  publisher: "ZeroHack Team",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZeroHack",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      
  <body>
        {/* Toast provider for notifications */}
        <ToastProvider>
          {/* Global error handler component that sets up listeners */}
          <ErrorHandler />
          
          {/* Root error boundary to catch all rendering errors */}
          <ErrorBoundary>
            <DevtoolsProvider>{children}</DevtoolsProvider>
          </ErrorBoundary>
        </ToastProvider>
      </body>

    </html>
  );
}
