import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "AngelFive - Smart Financial Data Management",
  description: "Advanced financial data management platform with real-time market insights powered by SmartAPI",
};

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <head>
      {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
            data-enabled="true"
          />
        )}
      </head>
      <body className="font-mono antialiased">
        <AuthProvider>
          {children}
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                fontSize: '14px',
                fontWeight: '500',
              },
            }}
            expand={true}
            richColors={true}
            closeButton={false}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
