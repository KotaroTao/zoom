import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Zoom Recording Dashboard',
  description: 'Zoom録画の管理・確認ダッシュボード',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="font-sans">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-gray-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
