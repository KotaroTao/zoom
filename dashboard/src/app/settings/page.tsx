'use client';

import { useState, useEffect } from 'react';
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
  Video,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, Settings, ConnectionStatus } from '@/lib/api';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingZoom, setTestingZoom] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const [settings, setSettings] = useState<Settings>({
    id: 'default',
    youtubeEnabled: true,
    youtubePrivacy: 'unlisted',
    transcriptionEnabled: true,
    transcriptionLanguage: 'ja',
    summaryEnabled: true,
    summaryStyle: 'detailed',
    sheetsEnabled: true,
    notionEnabled: false,
    createdAt: '',
    updatedAt: '',
  });

  // 設定と接続状態を取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsData, statusData] = await Promise.all([
          api.getSettings(),
          api.getConnectionStatus(),
        ]);
        setSettings(settingsData);
        setConnectionStatus(statusData);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
        setError('設定の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await api.updateSettings({
        youtubeEnabled: settings.youtubeEnabled,
        youtubePrivacy: settings.youtubePrivacy,
        transcriptionEnabled: settings.transcriptionEnabled,
        transcriptionLanguage: settings.transcriptionLanguage,
        summaryEnabled: settings.summaryEnabled,
        summaryStyle: settings.summaryStyle,
        sheetsEnabled: settings.sheetsEnabled,
        notionEnabled: settings.notionEnabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleTestZoom = async () => {
    setTestingZoom(true);
    try {
      const result = await api.testZoom();
      setTestResults(prev => ({ ...prev, zoom: result }));
      if (result.success) {
        setConnectionStatus(prev => prev ? {
          ...prev,
          zoom: { connected: true, message: '接続済み' }
        } : null);
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, zoom: { success: false, message: '接続テストに失敗しました' } }));
    } finally {
      setTestingZoom(false);
    }
  };

  const handleTestGoogle = async () => {
    setTestingGoogle(true);
    try {
      const result = await api.testGoogle();
      setTestResults(prev => ({ ...prev, google: result }));
      if (result.success) {
        setConnectionStatus(prev => prev ? {
          ...prev,
          youtube: { connected: true, message: '接続済み' }
        } : null);
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, google: { success: false, message: '接続テストに失敗しました' } }));
    } finally {
      setTestingGoogle(false);
    }
  };

  const handleTestOpenAI = async () => {
    setTestingOpenAI(true);
    try {
      const result = await api.testOpenAI();
      setTestResults(prev => ({ ...prev, openai: result }));
      if (result.success) {
        setConnectionStatus(prev => prev ? {
          ...prev,
          openai: { connected: true, message: '接続済み' }
        } : null);
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, openai: { success: false, message: '接続テストに失敗しました' } }));
    } finally {
      setTestingOpenAI(false);
    }
  };

  const ConnectionIndicator = ({ connected, message }: { connected: boolean; message: string }) => (
    <div className={`flex items-center text-sm ${connected ? 'text-green-600' : 'text-gray-400'}`}>
      {connected ? <Wifi className="h-4 w-4 mr-1" /> : <WifiOff className="h-4 w-4 mr-1" />}
      {message}
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">設定</h1>
          <p className="text-gray-500 mt-1">自動処理の設定とAPI接続管理</p>
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
          {/* API接続状態 */}
          <div className="card">
            <div className="card-header flex items-center">
              <Zap className="h-5 w-5 text-yellow-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">API接続状態</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Zoom */}
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Video className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="font-medium">Zoom API</span>
                    </div>
                    {connectionStatus && (
                      <ConnectionIndicator
                        connected={connectionStatus.zoom.connected}
                        message={connectionStatus.zoom.message}
                      />
                    )}
                  </div>
                  <button
                    onClick={handleTestZoom}
                    disabled={testingZoom}
                    className="w-full mt-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                  >
                    {testingZoom ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    接続テスト
                  </button>
                  {testResults.zoom && (
                    <p className={`mt-2 text-xs ${testResults.zoom.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.zoom.message}
                    </p>
                  )}
                </div>

                {/* YouTube */}
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Youtube className="h-5 w-5 text-red-500 mr-2" />
                      <span className="font-medium">YouTube API</span>
                    </div>
                    {connectionStatus && (
                      <ConnectionIndicator
                        connected={connectionStatus.youtube.connected}
                        message={connectionStatus.youtube.message}
                      />
                    )}
                  </div>
                  <button
                    onClick={handleTestGoogle}
                    disabled={testingGoogle}
                    className="w-full mt-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                  >
                    {testingGoogle ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    接続テスト
                  </button>
                  {testResults.google && (
                    <p className={`mt-2 text-xs ${testResults.google.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.google.message}
                    </p>
                  )}
                </div>

                {/* OpenAI */}
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Zap className="h-5 w-5 text-green-500 mr-2" />
                      <span className="font-medium">OpenAI API</span>
                    </div>
                    {connectionStatus && (
                      <ConnectionIndicator
                        connected={connectionStatus.openai.connected}
                        message={connectionStatus.openai.message}
                      />
                    )}
                  </div>
                  <button
                    onClick={handleTestOpenAI}
                    disabled={testingOpenAI}
                    className="w-full mt-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                  >
                    {testingOpenAI ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    接続テスト
                  </button>
                  {testResults.openai && (
                    <p className={`mt-2 text-xs ${testResults.openai.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.openai.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

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
                    checked={settings.youtubeEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        youtubeEnabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {settings.youtubeEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    公開設定
                  </label>
                  <select
                    value={settings.youtubePrivacy}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        youtubePrivacy: e.target.value as 'public' | 'unlisted' | 'private',
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
                    checked={settings.transcriptionEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        transcriptionEnabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {settings.transcriptionEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    言語
                  </label>
                  <select
                    value={settings.transcriptionLanguage}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        transcriptionLanguage: e.target.value,
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
                    checked={settings.summaryEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        summaryEnabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {settings.summaryEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    要約スタイル
                  </label>
                  <select
                    value={settings.summaryStyle}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        summaryStyle: e.target.value as 'brief' | 'detailed',
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
                    checked={settings.sheetsEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sheetsEnabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              <p className="text-xs text-gray-500">
                スプレッドシートIDは環境変数で設定してください
              </p>
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
                    checked={settings.notionEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notionEnabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              <p className="text-xs text-gray-500">
                NotionのAPI KeyとDatabase IDは環境変数で設定してください
              </p>
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
