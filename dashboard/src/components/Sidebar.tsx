'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  Video,
  Settings,
  BarChart3,
  RefreshCw,
  FileText,
} from 'lucide-react';

const navigation = [
  { name: 'ダッシュボード', href: '/', icon: Home },
  { name: '録画一覧', href: '/recordings', icon: Video },
  { name: 'クライアント', href: '/clients', icon: Users },
  { name: 'テンプレート', href: '/templates', icon: FileText },
  { name: '統計', href: '/stats', icon: BarChart3 },
  { name: 'セットアップ', href: '/setup', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* ロゴ */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <Video className="h-8 w-8 text-primary-600" />
        <span className="ml-2 text-lg font-semibold text-gray-900">
          Zoom録画管理
        </span>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon
                className={`h-5 w-5 mr-3 ${
                  isActive ? 'text-primary-600' : 'text-gray-400'
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* 同期ステータス */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center text-sm text-gray-500">
          <RefreshCw className="h-4 w-4 mr-2 text-green-500" />
          <span>自動同期中</span>
        </div>
      </div>
    </div>
  );
}
