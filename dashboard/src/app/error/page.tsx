'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const errorMessages: Record<string, string> = {
  Configuration: 'サーバー設定にエラーがあります',
  AccessDenied: 'アクセスが拒否されました',
  Verification: '認証リンクの有効期限が切れています',
  OAuthSignin: 'OAuth認証の開始に失敗しました。Google認証が設定されていない可能性があります。',
  OAuthCallback: 'OAuth認証のコールバックに失敗しました',
  OAuthCreateAccount: 'アカウントの作成に失敗しました',
  EmailCreateAccount: 'メールアカウントの作成に失敗しました',
  Callback: '認証コールバックでエラーが発生しました',
  OAuthAccountNotLinked: 'このメールアドレスは別の認証方法で登録されています',
  EmailSignin: 'メール送信に失敗しました',
  CredentialsSignin: '認証情報が正しくありません',
  SessionRequired: 'ログインが必要です',
  Default: '認証エラーが発生しました',
};

function ErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';

  const errorMessage = errorMessages[error] || errorMessages.Default;

  useEffect(() => {
    // 5秒後に自動的にログインページへリダイレクト
    const timer = setTimeout(() => {
      router.push('/login?error=' + error);
    }, 5000);

    return () => clearTimeout(timer);
  }, [error, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4 text-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">
            認証エラー
          </h1>

          <p className="text-gray-600 mb-6">
            {errorMessage}
          </p>

          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              ログインページへ戻る
            </Link>

            <p className="text-sm text-gray-500">
              5秒後に自動的にリダイレクトされます...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingContent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={<LoadingContent />}>
      <ErrorContent />
    </Suspense>
  );
}
