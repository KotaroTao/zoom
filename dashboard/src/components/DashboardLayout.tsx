'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { LogOut, User, Loader2, Building2, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { getRoleLabel, getRoleColor } from '@/lib/permissions-client';
import { api, Organization } from '@/lib/api';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status, update } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // 所属組織一覧を取得
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const data = await api.getOrganizations();
        setOrganizations(data.organizations);
      } catch (err) {
        console.error('Failed to fetch organizations:', err);
      }
    };

    if (session?.user?.id) {
      fetchOrganizations();
    }
  }, [session?.user?.id]);

  // 組織切り替え
  const handleSwitchOrganization = async (orgId: string) => {
    if (switching || orgId === session?.user?.organizationId) {
      setOrgMenuOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const result = await api.switchOrganization(orgId);
      // セッションを更新
      await update(result.sessionUpdate);
      // ページをリロードして新しい組織のデータを取得
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch organization:', err);
      alert('組織の切り替えに失敗しました');
    } finally {
      setSwitching(false);
      setOrgMenuOpen(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const hasOrganization = !!session?.user?.organizationId;
  const hasMultipleOrganizations = organizations.length > 1;

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
                  {/* 複数組織の場合はドロップダウン */}
                  {hasMultipleOrganizations ? (
                    <div className="relative">
                      <button
                        onClick={() => setOrgMenuOpen(!orgMenuOpen)}
                        className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
                        disabled={switching}
                      >
                        <Building2 className="h-4 w-4" />
                        <span>{session?.user?.organizationName || '組織'}</span>
                        {switching ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                      {orgMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOrgMenuOpen(false)}
                          />
                          <div className="absolute left-0 z-20 mt-2 w-64 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                            <div className="py-1">
                              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                組織を切り替え
                              </div>
                              {organizations.map((org) => (
                                <button
                                  key={org.id}
                                  onClick={() => handleSwitchOrganization(org.id)}
                                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 ${
                                    org.id === session?.user?.organizationId
                                      ? 'bg-primary-50'
                                      : ''
                                  }`}
                                >
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {org.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {getRoleLabel(org.role)} / {org.memberCount}人
                                    </div>
                                  </div>
                                  {org.id === session?.user?.organizationId && (
                                    <Check className="h-4 w-4 text-primary-600" />
                                  )}
                                </button>
                              ))}
                              <div className="border-t border-gray-100 mt-1 pt-1">
                                <Link
                                  href="/zoom/onboarding"
                                  className="block px-3 py-2 text-sm text-primary-600 hover:bg-gray-50"
                                  onClick={() => setOrgMenuOpen(false)}
                                >
                                  + 新しい組織を作成
                                </Link>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-600">
                      <Building2 className="h-4 w-4 mr-1" />
                      <span>{session?.user?.organizationName || '組織'}</span>
                    </div>
                  )}
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
