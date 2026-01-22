'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { LogOut, User, Loader2, Building2, AlertCircle } from 'lucide-react';
import { getRoleLabel, getRoleColor } from '@/lib/permissions-client';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const hasOrganization = !!session?.user?.organizationId;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            {/* 組織情報 */}
            <div className="flex items-center text-sm gap-2">
              {hasOrganization ? (
                <>
                  <div className="flex items-center text-gray-600">
                    <Building2 className="h-4 w-4 mr-1" />
                    <span>{session?.user?.organizationName || '組織'}</span>
                  </div>
                  {session?.user?.role && (
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleColor(session.user.role).bg} ${getRoleColor(session.user.role).text}`}
                    >
                      {getRoleLabel(session.user.role)}
                    </span>
                  )}
                </>
              ) : (
                <Link
                  href="/zoom/onboarding"
                  className="flex items-center text-amber-600 hover:text-amber-700"
                >
                  <Building2 className="h-4 w-4 mr-1" />
                  <span>組織未所属</span>
                </Link>
              )}
            </div>
            {/* ユーザー情報 */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-1" />
                <span>{session?.user?.email}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/zoom/login' })}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                ログアウト
              </button>
            </div>
          </div>
        </header>

        {/* 組織未所属の場合の案内バナー */}
        {!hasOrganization && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-amber-800">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>
                  組織に参加すると、チームメンバーと録画一覧を共有できます。
                </span>
              </div>
              <Link
                href="/zoom/onboarding"
                className="px-4 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                組織を作成・参加
              </Link>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
