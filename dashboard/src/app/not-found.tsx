'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ページが見つかりません
        </h1>
        <p className="text-gray-500 mb-4">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <p className="text-sm text-gray-400 mb-6">
          パス: {pathname}
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
        >
          <Home className="h-5 w-5 mr-2" />
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  );
}
