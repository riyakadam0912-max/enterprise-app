import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ReactQueryProvider from "@/components/providers/ReactQueryProvider";
import BackendHealthProvider from "@/components/providers/BackendHealthProvider";
import { DesignSystemProvider } from "@/providers/design-system-provider";
import { AuthProvider } from '@/providers/AuthProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'Enterprise ERP',
    template: '%s | Enterprise ERP',
  },
  description: 'Unified enterprise resource planning platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ReactQueryProvider>
          <BackendHealthProvider>
            <DesignSystemProvider>
              <AuthProvider>{children}</AuthProvider>
            </DesignSystemProvider>
          </BackendHealthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
