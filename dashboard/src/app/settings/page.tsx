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
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, Settings, ConnectionStatus, Credentials } from '@/lib/api';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingZoom, setTestingZoom] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [testingNotion, setTestingNotion] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const [settings, setSettings] = useState<Settings>({
    id: 'default',
    organizationId: '',
    youtubeEnabled: true,
    youtubePrivacy: 'unlisted',
    transcriptionEnabled: true,
    transcriptionLanguage: 'ja',
    summaryEnabled: true,
    summaryStyle: 'detailed',
    sheetsEnabled: true,
    notionEnabled: false,
    zoomAccountId: null,
    zoomClientId: null,
    zoomClientSecret: null,
    zoomWebhookSecretToken: null,
    openaiApiKey: null,
    googleClientId: null,
    googleClientSecret: null,
    googleSpreadsheetId: null,
    notionApiKey: null,
    notionDatabaseId: null,
    createdAt: '',
    updatedAt: '',
  });

  // 新しい認証情報（入力用）
  const [credentials, setCredentials] = useState<Credentials>({
    zoomAccountId: '',
    zoomClientId: '',
    zoomClientSecret: '',
    zoomWebhookSecretToken: '',
    openaiApiKey: '',
    googleClientId: '',
    googleClientSecret: '',
    googleSpreadsheetId: '',
    notionApiKey: '',
    notionDatabaseId: '',
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

  const handleSaveCredentials = async () => {
    setSavingCredentials(true);
    setError(null);
    setSavedCredentials(false);

    try {
      const result = await api.updateCredentials(credentials);
      if (result.success) {
        setSavedCredentials(true);
        setTimeout(() => setSavedCredentials(false), 3000);
        // 更新されたマスク済み値でsettingsを更新
        setSettings(prev => ({
          ...prev,
          zoomAccountId: result.zoomAccountId,
          zoomClientId: result.zoomClientId,
          zoomClientSecret: result.zoomClientSecret,
          zoomWebhookSecretToken: result.zoomWebhookSecretToken,
          openaiApiKey: result.openaiApiKey,
          googleClientId: result.googleClientId,
          googleClientSecret: result.googleClientSecret,
          googleSpreadsheetId: result.googleSpreadsheetId,
          notionApiKey: result.notionApiKey,
          notionDatabaseId: result.notionDatabaseId,
        }));
        // 入力フォームをクリア
        setCredentials({
          zoomAccountId: '',
          zoomClientId: '',
          zoomClientSecret: '',
          zoomWebhookSecretToken: '',
          openaiApiKey: '',
          googleClientId: '',
          googleClientSecret: '',
          googleSpreadsheetId: '',
          notionApiKey: '',
          notionDatabaseId: '',
        });
        // 接続状態を再取得
        const statusData = await api.getConnectionStatus();
        setConnectionStatus(statusData);
      }
    } catch (err) {
      setError('認証情報の保存に失敗しました');
    } finally {
      setSavingCredentials(false);
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
          zoom: { connected: true, message: '接続済み', configured: true }
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
          youtube: { connected: true, message: '接続済み', configured: true }
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
          openai: { connected: true, message: '接続済み', configured: true }
        } : null);
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, openai: { success: false, message: '接続テストに失敗しました' } }));
    } finally {
      setTestingOpenAI(false);
    }
  };

  const handleTestNotion = async () => {
    setTestingNotion(true);
    try {
      const result = await api.testNotion();
      setTestResults(prev => ({ ...prev, notion: result }));
      if (result.success) {
        setConnectionStatus(prev => prev ? {
          ...prev,
          notion: { connected: true, message: '接続済み', configured: true }
        } : null);
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, notion: { success: false, message: '接続テストに失敗しました' } }));
    } finally {
      setTestingNotion(false);
    }
  };

  const ConnectionIndicator = ({ connected, configured, message }: { connected: boolean; configured: boolean; message: string }) => (
    <div className={`flex items-center text-sm ${connected ? 'text-green-600' : configured ? 'text-yellow-600' : 'text-gray-400'}`}>
      {connected ? <Wifi className="h-4 w-4 mr-1" /> : <WifiOff className="h-4 w-4 mr-1" />}
      {message}
    </div>
  );

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
        {(saved || savedCredentials) && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
            <CheckCircle className="h-5 w-5 mr-2" />
            {savedCredentials ? 'API認証情報を保存しました' : '設定を保存しました'}
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
          {/* API認証情報 */}
          <div className="card">
            <div className="card-header flex items-center">
              <Key className="h-5 w-5 text-orange-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">API認証情報</h2>
            </div>
            <div className="card-body space-y-6">
              {/* Zoom API */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Video className="h-5 w-5 text-blue-500 mr-2" />
                    <h3 className="font-medium text-gray-900">Zoom API</h3>
                  </div>
                  {connectionStatus && (
                    <ConnectionIndicator
                      connected={connectionStatus.zoom.connected}
                      configured={connectionStatus.zoom.configured}
                      message={connectionStatus.zoom.message}
                    />
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account ID
                      {settings.zoomAccountId && (
                        <span className="ml-2 text-xs text-gray-500">現在: {settings.zoomAccountId}</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={credentials.zoomAccountId || ''}
                      onChange={(e) => setCredentials({ ...credentials, zoomAccountId: e.target.value })}
                      placeholder="wK96yaY3SJ6i6X1XtJrfjA"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client ID
                      {settings.zoomClientId && (
                        <span className="ml-2 text-xs text-gray-500">現在: {settings.zoomClientId}</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={credentials.zoomClientId || ''}
                      onChange={(e) => setCredentials({ ...credentials, zoomClientId: e.target.value })}
                      placeholder="c7uav0NJSCqcJzqOvsl69g"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client Secret
                      {settings.zoomClientSecret && (
                        <span className="ml-2 text-xs text-gray-500">現在: {settings.zoomClientSecret}</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets['zoomClientSecret'] ? 'text' : 'password'}
                        value={credentials.zoomClientSecret || ''}
                        onChange={(e) => setCredentials({ ...credentials, zoomClientSecret: e.target.value })}
                        placeholder="****"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('zoomClientSecret')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSecrets['zoomClientSecret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook Secret Token
                      {settings.zoomWebhookSecretToken && (
                        <span className="ml-2 text-xs text-gray-500">現在: {settings.zoomWebhookSecretToken}</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets['zoomWebhookSecret'] ? 'text' : 'password'}
                        value={credentials.zoomWebhookSecretToken || ''}
                        onChange={(e) => setCredentials({ ...credentials, zoomWebhookSecretToken: e.target.value })}
                        placeholder="****"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('zoomWebhookSecret')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSecrets['zoomWebhookSecret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleTestZoom}
                    disabled={testingZoom}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center transition-colors disabled:opacity-50"
                  >
                    {testingZoom ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    接続テスト
                  </button>
                  {testResults.zoom && (
                    <span className={`text-sm ${testResults.zoom.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.zoom.message}
                    </span>
                  )}
                </div>
              </div>

              {/* OpenAI API */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Zap className="h-5 w-5 text-green-500 mr-2" />
                    <h3 className="font-medium text-gray-900">OpenAI API</h3>
                  </div>
                  {connectionStatus && (
                    <ConnectionIndicator
                      connected={connectionStatus.openai.connected}
                      configured={connectionStatus.openai.configured}
                      message={connectionStatus.openai.message}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                    {settings.openaiApiKey && (
                      <span className="ml-2 text-xs text-gray-500">現在: {settings.openaiApiKey}</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets['openaiApiKey'] ? 'text' : 'password'}
                      value={credentials.openaiApiKey || ''}
                      onChange={(e) => setCredentials({ ...credentials, openaiApiKey: e.target.value })}
                      placeholder="sk-proj-..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('openaiApiKey')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets['openaiApiKey'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleTestOpenAI}
                    disabled={testingOpenAI}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center transition-colors disabled:opacity-50"
                  >
                    {testingOpenAI ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    接続テスト
                  </button>
                  {testResults.openai && (
                    <span className={`text-sm ${testResults.openai.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.openai.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Google API */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Youtube className="h-5 w-5 text-red-500 mr-2" />
                    <h3 className="font-medium text-gray-900">Google / YouTube API</h3>
                  </div>
                  {connectionStatus && (
                    <ConnectionIndicator
                      connected={connectionStatus.youtube.connected}
                      configured={connectionStatus.youtube.configured}
                      message={connectionStatus.youtube.message}
                    />
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client ID
                      {settings.googleClientId && (
                        <span className="ml-2 text-xs text-gray-500">現在: {settings.googleClientId}</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={credentials.googleClientId || ''}
                      onChange={(e) => setCredentials({ ...credentials, googleClientId: e.target.value })}
                      placeholder="xxxxx.apps.googleusercontent.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client Secret
                      {settings.googleClientSecret && (
                        <span className="ml-2 text-xs text-gray-500">現在: {settings.googleClientSecret}</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets['googleClientSecret'] ? 'text' : 'password'}
                        value={credentials.googleClientSecret || ''}
                        onChange={(e) => setCredentials({ ...credentials, googleClientSecret: e.target.value })}
                        placeholder="GOCSPX-..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('googleClientSecret')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSecrets['googleClientSecret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Spreadsheet ID
                      {settings.googleSpreadsheetId && (
                        <span className="ml-2 text-xs text-gray-500">現在: {settings.googleSpreadsheetId}</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={credentials.googleSpreadsheetId || ''}
                      onChange={(e) => setCredentials({ ...credentials, googleSpreadsheetId: e.target.value })}
                      placeholder="18DBlYtvDPNqn2BmQwmThQ5V9lrd1WQNF-St64W9qg_M"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleTestGoogle}
                    disabled={testingGoogle}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center transition-colors disabled:opacity-50"
                  >
                    {testingGoogle ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    接続テスト
                  </button>
                  {testResults.google && (
                    <span className={`text-sm ${testResults.google.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.google.message}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  YouTube認証にはサーバーでの初回認証が必要です。認証後に接続テストを実行してください。
                </p>
              </div>

              {/* Notion API */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-gray-700 mr-2" />
                    <h3 className="font-medium text-gray-900">Notion API</h3>
                  </div>
                  {connectionStatus && connectionStatus.notion && (
                    <ConnectionIndicator
                      connected={connectionStatus.notion.connected}
                      configured={connectionStatus.notion.configured}
                      message={connectionStatus.notion.message}
                    />
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key (Integration Token)
                      {settings.notionApiKey && (
                        <span className="ml-2 text-xs text-gray-500">現在: {settings.notionApiKey}</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets['notionApiKey'] ? 'text' : 'password'}
                        value={credentials.notionApiKey || ''}
                        onChange={(e) => setCredentials({ ...credentials, notionApiKey: e.target.value })}
                        placeholder="secret_..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('notionApiKey')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSecrets['notionApiKey'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Database ID
                      {settings.notionDatabaseId && (
                        <span className="ml-2 text-xs text-gray-500">現在: {settings.notionDatabaseId}</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={credentials.notionDatabaseId || ''}
                      onChange={(e) => setCredentials({ ...credentials, notionDatabaseId: e.target.value })}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleTestNotion}
                    disabled={testingNotion}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center transition-colors disabled:opacity-50"
                  >
                    {testingNotion ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    接続テスト
                  </button>
                  {testResults.notion && (
                    <span className={`text-sm ${testResults.notion.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.notion.message}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Notion Integrations (https://www.notion.so/my-integrations) でトークンを作成し、対象データベースに接続を許可してください。
                </p>
              </div>

              {/* 認証情報保存ボタン */}
              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={handleSaveCredentials}
                  disabled={savingCredentials}
                  className="flex items-center px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingCredentials ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Key className="h-5 w-5 mr-2" />
                      認証情報を保存
                    </>
                  )}
                </button>
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
