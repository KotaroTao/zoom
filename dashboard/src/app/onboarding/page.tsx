'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, ArrowRight, CheckCircle } from 'lucide-react';

export default function OnboardingPage() {
  const { data: session, update: updateSession, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<'loading' | 'create' | 'complete'>('loading');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 認証状態をチェック
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      // 既に組織に所属している場合はダッシュボードへ
      if (session?.user?.organizationId) {
        router.push('/');
        return;
      }
      setStep('create');
    }
  }, [status, session, router]);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/zoom/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '組織の作成に失敗しました');
        setLoading(false);
        return;
      }

      // セッションを更新して組織情報を反映
      await updateSession({
        organizationId: data.organization.id,
        organizationName: data.organization.name,
        role: 'owner',
      });

      setStep('complete');

      // 少し待ってからダッシュボードへ
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      setError('組織の作成中にエラーが発生しました');
      setLoading(false);
    }
  };

  if (step === 'loading' || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            組織を作成しました！
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
              <Building2 className="h-8 w-8 text-primary-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            組織を作成しましょう
          </h1>
          <p className="text-gray-500 mt-2">
            チームで録画を共有・管理するための組織を作成します
          </p>
        </div>

        {/* フォーム */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleCreateOrganization} className="space-y-4">
            {/* エラー表示 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* 組織名 */}
            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
                組織名 <span className="text-red-500">*</span>
              </label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="株式会社サンプル"
              />
              <p className="mt-1 text-sm text-gray-500">
                会社名やチーム名など、わかりやすい名前を設定してください
              </p>
            </div>

            {/* 作成ボタン */}
            <button
              type="submit"
              disabled={loading || !orgName.trim()}
              className="w-full flex items-center justify-center py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  作成中...
                </>
              ) : (
                <>
                  組織を作成
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* 説明 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            組織でできること
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>・ チームメンバーを招待して録画を共有</li>
            <li>・ 組織単位でAPI設定を管理</li>
            <li>・ メンバーごとに閲覧・編集権限を設定</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
