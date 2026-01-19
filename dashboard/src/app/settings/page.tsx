'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Settings as SettingsIcon,
  Youtube,
  FileText,
  Table,
  BookOpen,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

interface SettingsState {
  youtube: {
    enabled: boolean;
    privacyStatus: 'public' | 'unlisted' | 'private';
  };
  transcription: {
    enabled: boolean;
    language: string;
  };
  summary: {
    enabled: boolean;
    style: 'brief' | 'detailed';
  };
  sheets: {
    enabled: boolean;
    spreadsheetId: string;
  };
  notion: {
    enabled: boolean;
    databaseId: string;
  };
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<SettingsState>({
    youtube: {
      enabled: true,
      privacyStatus: 'unlisted',
    },
    transcription: {
      enabled: true,
      language: 'ja',
    },
    summary: {
      enabled: true,
      style: 'detailed',
    },
    sheets: {
      enabled: true,
      spreadsheetId: '',
    },
    notion: {
      enabled: false,
      databaseId: '',
    },
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      // TODO: APIを呼び出して設定を保存
      await new Promise((resolve) => setTimeout(resolve, 1000)); // シミュレーション
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">設定</h1>
          <p className="text-gray-500 mt-1">自動処理の設定を管理</p>
        </div>

        {/* 保存成功メッセージ */}
        {saved && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
            <CheckCircle className="h-5 w-5 mr-2" />
            設定を保存しました
          </div>
        )}

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* YouTube設定 */}
          <div className="card">
            <div className="card-header flex items-center">
              <Youtube className="h-5 w-5 text-red-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">YouTubeアップロード</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">自動アップロード</p>
                  <p className="text-sm text-gray-500">録画を自動的にYouTubeにアップロード</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.youtube.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        youtube: { ...settings.youtube, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {settings.youtube.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    公開設定
                  </label>
                  <select
                    value={settings.youtube.privacyStatus}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        youtube: {
                          ...settings.youtube,
                          privacyStatus: e.target.value as 'public' | 'unlisted' | 'private',
                        },
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="private">非公開</option>
                    <option value="unlisted">限定公開</option>
                    <option value="public">公開</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 文字起こし設定 */}
          <div className="card">
            <div className="card-header flex items-center">
              <FileText className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">文字起こし（Whisper）</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">自動文字起こし</p>
                  <p className="text-sm text-gray-500">OpenAI Whisperで自動的に文字起こし</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.transcription.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        transcription: { ...settings.transcription, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {settings.transcription.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    言語
                  </label>
                  <select
                    value={settings.transcription.language}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        transcription: { ...settings.transcription, language: e.target.value },
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="ja">日本語</option>
                    <option value="en">英語</option>
                    <option value="auto">自動検出</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 要約設定 */}
          <div className="card">
            <div className="card-header flex items-center">
              <SettingsIcon className="h-5 w-5 text-purple-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">要約生成（GPT-4）</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">自動要約</p>
                  <p className="text-sm text-gray-500">GPT-4でミーティング内容を自動要約</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.summary.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        summary: { ...settings.summary, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {settings.summary.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    要約スタイル
                  </label>
                  <select
                    value={settings.summary.style}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        summary: {
                          ...settings.summary,
                          style: e.target.value as 'brief' | 'detailed',
                        },
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="brief">簡潔</option>
                    <option value="detailed">詳細</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Google Sheets設定 */}
          <div className="card">
            <div className="card-header flex items-center">
              <Table className="h-5 w-5 text-green-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Google Sheets連携</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">スプレッドシート連携</p>
                  <p className="text-sm text-gray-500">処理結果をGoogle Sheetsに自動記録</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sheets.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sheets: { ...settings.sheets, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {settings.sheets.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    スプレッドシートID
                  </label>
                  <input
                    type="text"
                    value={settings.sheets.spreadsheetId}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sheets: { ...settings.sheets, spreadsheetId: e.target.value },
                      })
                    }
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    スプレッドシートURLからIDをコピーしてください
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notion設定 */}
          <div className="card">
            <div className="card-header flex items-center">
              <BookOpen className="h-5 w-5 text-gray-700 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Notion連携</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Notionデータベース連携</p>
                  <p className="text-sm text-gray-500">処理結果をNotionに自動記録</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notion.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notion: { ...settings.notion, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {settings.notion.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    データベースID
                  </label>
                  <input
                    type="text"
                    value={settings.notion.databaseId}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notion: { ...settings.notion, databaseId: e.target.value },
                      })
                    }
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    NotionデータベースのURLからIDをコピーしてください
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  設定を保存
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
