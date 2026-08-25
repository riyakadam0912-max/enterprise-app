import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import ReactQueryProvider from "@/components/providers/ReactQueryProvider";
import BackendHealthProvider from "@/components/providers/BackendHealthProvider";
import { DesignSystemProvider } from "@/providers/design-system-provider";
import { AuthProvider } from '@/providers/AuthProvider';
import GlobalErrorListener from '@/providers/global-error-listener';
const montserrat = Montserrat({
  variable: "--font-montserrat",
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
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${montserrat.variable} antialiased bg-background text-foreground`}
      >
        <ReactQueryProvider>
          <BackendHealthProvider>
            <DesignSystemProvider>
              <GlobalErrorListener><AuthProvider>{children}</AuthProvider></GlobalErrorListener>
            </DesignSystemProvider>
          </BackendHealthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
