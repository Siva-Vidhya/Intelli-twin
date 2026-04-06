import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import ErrorBoundary from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'IntelliTwin – Personal Digital Twin',
  description: 'AI-powered study plans, tracking and analytics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${outfit.variable} font-sans min-h-screen bg-black text-white selection:bg-primary/30`}>
        <ErrorBoundary>
          <Navbar />
          <main className="pt-20">
            {children}
          </main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
