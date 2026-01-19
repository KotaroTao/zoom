'use client';

import { useState, useEffect, use } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, CheckCircle, XCircle, Mail, UserPlus } from 'lucide-react';

interface InvitationInfo {
  email: string;
  role: string;
  organizationName: string;
  invitedBy: string;
  expiresAt: string;
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 招待情報を取得
  useEffect(() => {
    async function fetchInvitation() {
      try {
        const res = await fetch(`/api/invitations/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || '招待の取得に失敗しました');
        } else {
          setInvitation(data);
        }
      } catch (err) {
        setError('招待の取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    }

    fetchInvitation();
  }, [token]);

  // 招待を受け入れる
  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '招待の受け入れに失敗しました');
        setAccepting(false);
        return;
      }

      setSuccess(true);

      // セッションを更新
      await updateSession({
        organizationId: data.organizationId,
        organizationName: data.organizationName,
        role: invitation?.role || 'member',
      });

      // ダッシュボードへリダイレクト
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      setError('招待の受け入れ中にエラーが発生しました');
      setAccepting(false);
    }
  };

  // ローディング中
  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // エラー表示
  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            招待が無効です
          </h1>
          <p className="text-gray-500">
            {error}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  // 成功表示
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            組織に参加しました
          </h1>
          <p className="text-gray-500">
            ダッシュボードに移動しています...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
              <UserPlus className="h-8 w-8 text-primary-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            組織への招待
          </h1>
        </div>

        {/* 招待情報 */}
        {invitation && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-4">
              {/* 組織名 */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Building2 className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">組織</p>
                  <p className="font-medium text-gray-900">{invitation.organizationName}</p>
                </div>
              </div>

              {/* 招待メール */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">招待先メールアドレス</p>
                  <p className="font-medium text-gray-900">{invitation.email}</p>
                </div>
              </div>

              {/* 招待者 */}
              <p className="text-sm text-gray-500 text-center">
                {invitation.invitedBy || '管理者'}さんからの招待です
              </p>

              {/* エラー表示 */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* 未ログインの場合 */}
              {status === 'unauthenticated' && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-gray-600">
                    招待を受け入れるにはログインしてください
                  </p>
                  <button
                    onClick={() => signIn('google', { callbackUrl: `/invite/${token}` })}
                    className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Googleでログイン
                  </button>
                  <button
                    onClick={() => signIn(undefined, { callbackUrl: `/invite/${token}` })}
                    className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    メールアドレスでログイン
                  </button>
                </div>
              )}

              {/* ログイン済みの場合 */}
              {status === 'authenticated' && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-gray-600">
                    <span className="font-medium">{session?.user?.email}</span> としてログイン中
                  </p>
                  <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full flex items-center justify-center py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                        参加中...
                      </>
                    ) : (
                      '組織に参加する'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
