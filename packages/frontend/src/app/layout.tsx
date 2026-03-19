import type { Metadata } from 'next';
import './globals.css';
import NavBar from '../components/nav-bar';

export const metadata: Metadata = {
  title: 'Skillr - AI Agent Skill Registry',
  description: 'AI Agent 时代的 DockerHub + NPM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        <NavBar />
        <main className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
