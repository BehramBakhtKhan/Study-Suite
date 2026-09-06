import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Study Suite",
  description: "Personalized study and learning workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased font-sans`}
    >
      <body className={`${inter.className} min-h-full flex flex-col bg-slate-950 text-slate-100`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0f172a", // slate-900
              color: "#f8fafc", // slate-50
              border: "1px solid #1e293b", // slate-800
            },
            success: {
              iconTheme: {
                primary: "#6366f1", // indigo-500
                secondary: "#ffffff",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444", // red-500
                secondary: "#ffffff",
              },
            
            },
          }}
        />
      </body>
    </html>
  );
}