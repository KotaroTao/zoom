'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Video,
  Zap,
  Youtube,
  Table,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  Circle,
  Loader2,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  Key,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  FileText,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, Settings, ConnectionStatus, Credentials } from '@/lib/api';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  links?: { label: string; url: string }[];
  tips?: string[];
  warnings?: string[];
}

interface ServiceSetup {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  steps: SetupStep[];
  testFn?: () => Promise<{ success: boolean; message: string }>;
}

export default function SetupPage() {
  const { data: session } = useSession();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [testingService, setTestingService] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // 認証情報（入力用）
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
        console.error('Failed to fetch data:', err);
        setError('設定の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 処理設定を自動保存
  const saveSettings = useCallback(async (newSettings: Partial<Settings>) => {
    setSavingSettings(true);
    try {
      await api.updateSettings({
        youtubeEnabled: newSettings.youtubeEnabled ?? settings.youtubeEnabled,
        youtubePrivacy: newSettings.youtubePrivacy ?? settings.youtubePrivacy,
        transcriptionEnabled: newSettings.transcriptionEnabled ?? settings.transcriptionEnabled,
        transcriptionLanguage: newSettings.transcriptionLanguage ?? settings.transcriptionLanguage,
        summaryEnabled: newSettings.summaryEnabled ?? settings.summaryEnabled,
        summaryStyle: newSettings.summaryStyle ?? settings.summaryStyle,
        sheetsEnabled: newSettings.sheetsEnabled ?? settings.sheetsEnabled,
        notionEnabled: newSettings.notionEnabled ?? settings.notionEnabled,
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('設定の保存に失敗しました');
    } finally {
      setSavingSettings(false);
    }
  }, [settings]);

  // 設定変更ハンドラー（自動保存付き）
  const handleSettingsChange = (key: keyof Settings, value: boolean | string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings({ [key]: value });
  };

  // サービス固有の認証情報を取得
  const getServiceCredentials = (serviceId: string): Partial<Credentials> => {
    switch (serviceId) {
      case 'zoom':
        return {
          zoomAccountId: credentials.zoomAccountId,
          zoomClientId: credentials.zoomClientId,
          zoomClientSecret: credentials.zoomClientSecret,
          zoomWebhookSecretToken: credentials.zoomWebhookSecretToken,
        };
      case 'openai':
        return {
          openaiApiKey: credentials.openaiApiKey,
        };
      case 'google':
        return {
          googleClientId: credentials.googleClientId,
          googleClientSecret: credentials.googleClientSecret,
          googleSpreadsheetId: credentials.googleSpreadsheetId,
        };
      case 'notion':
        return {
          notionApiKey: credentials.notionApiKey,
          notionDatabaseId: credentials.notionDatabaseId,
        };
      default:
        return {};
    }
  };

  // 認証情報が入力されているかチェック
  const hasCredentialsInput = (serviceId: string): boolean => {
    const creds = getServiceCredentials(serviceId);
    return Object.values(creds).some(v => v && v.trim() !== '');
  };

  // 接続テスト（認証情報保存 + テスト）
  const handleTestAndSave = async (serviceId: string, testFn: () => Promise<{ success: boolean; message: string }>) => {
    setTestingService(serviceId);
    setError(null);

    try {
      // 認証情報が入力されていれば保存
      if (hasCredentialsInput(serviceId)) {
        const serviceCreds = getServiceCredentials(serviceId);
        const result = await api.updateCredentials(serviceCreds as Credentials);

        if (result.success) {
          // 更新されたマスク済み値でsettingsを更新
          setSettings(prev => ({
            ...prev,
            ...(serviceId === 'zoom' && {
              zoomAccountId: result.zoomAccountId ?? prev.zoomAccountId,
              zoomClientId: result.zoomClientId ?? prev.zoomClientId,
              zoomClientSecret: result.zoomClientSecret ?? prev.zoomClientSecret,
              zoomWebhookSecretToken: result.zoomWebhookSecretToken ?? prev.zoomWebhookSecretToken,
            }),
            ...(serviceId === 'openai' && {
              openaiApiKey: result.openaiApiKey ?? prev.openaiApiKey,
            }),
            ...(serviceId === 'google' && {
              googleClientId: result.googleClientId ?? prev.googleClientId,
              googleClientSecret: result.googleClientSecret ?? prev.googleClientSecret,
              googleSpreadsheetId: result.googleSpreadsheetId ?? prev.googleSpreadsheetId,
            }),
            ...(serviceId === 'notion' && {
              notionApiKey: result.notionApiKey ?? prev.notionApiKey,
              notionDatabaseId: result.notionDatabaseId ?? prev.notionDatabaseId,
            }),
          }));

          // 入力フォームをクリア
          setCredentials(prev => ({
            ...prev,
            ...(serviceId === 'zoom' && {
              zoomAccountId: '',
              zoomClientId: '',
              zoomClientSecret: '',
              zoomWebhookSecretToken: '',
            }),
            ...(serviceId === 'openai' && {
              openaiApiKey: '',
            }),
            ...(serviceId === 'google' && {
              googleClientId: '',
              googleClientSecret: '',
              googleSpreadsheetId: '',
            }),
            ...(serviceId === 'notion' && {
              notionApiKey: '',
              notionDatabaseId: '',
            }),
          }));
        }
      }

      // 接続テスト実行
      const testResult = await testFn();
      setTestResults(prev => ({ ...prev, [serviceId]: testResult }));

      // 接続状態を再取得
      const status = await api.getConnectionStatus();
      setConnectionStatus(status);
    } catch (err) {
      setTestResults(prev => ({ ...prev, [serviceId]: { success: false, message: '接続テストに失敗しました' } }));
    } finally {
      setTestingService(null);
    }
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin.replace(':3001', ':3002')}/webhook/zoom`
    : 'https://your-domain.com:3002/webhook/zoom';

  const services: ServiceSetup[] = [
    {
      id: 'zoom',
      name: 'Zoom API',
      icon: <Video className="h-5 w-5" />,
      color: 'text-blue-500',
      description: 'Zoom録画の自動取得に必要',
      testFn: api.testZoom,
      steps: [
        {
          id: 'zoom-1',
          title: 'Server-to-Server OAuthアプリを作成',
          description: '認証情報を取得してフォームに入力',
          instructions: [
            'Zoom App Marketplace →「Build App」→「Server-to-Server OAuth」',
            '「App Credentials」からAccount ID、Client ID、Client Secretをコピー',
            '上のフォームに入力',
          ],
          links: [
            { label: 'Zoom App Marketplace', url: 'https://marketplace.zoom.us/' },
          ],
        },
        {
          id: 'zoom-2',
          title: 'スコープとWebhookを設定',
          description: '録画アクセス権限とWebhook通知を設定',
          instructions: [
            '「Scopes」タブで以下を追加: cloud_recording:read:list_user_recordings, cloud_recording:read:recording, user:read:user',
            '「Feature」→「Event Subscriptions」をオンにして下記URLを設定',
            '「Recording」→「All Recordings have completed」を選択',
            '「Secret Token」をコピーしてフォームに入力',
          ],
        },
        {
          id: 'zoom-3',
          title: 'アプリを有効化して接続テスト',
          description: '設定を完了して接続確認',
          instructions: [
            '「Activation」タブでアプリを有効化',
            '「保存して接続テスト」をクリック',
          ],
        },
      ],
    },
    {
      id: 'openai',
      name: 'OpenAI API',
      icon: <Zap className="h-5 w-5" />,
      color: 'text-green-500',
      description: '文字起こし（Whisper）と要約生成（GPT）に必要',
      testFn: api.testOpenAI,
      steps: [
        {
          id: 'openai-1',
          title: 'APIキーを取得',
          description: 'OpenAIダッシュボードでキーを発行',
          instructions: [
            'OpenAI Platform →「API keys」→「Create new secret key」',
            '表示されたキーをコピー（一度のみ表示）',
          ],
          links: [{ label: 'OpenAI API Keys', url: 'https://platform.openai.com/api-keys' }],
        },
        {
          id: 'openai-2',
          title: '接続テスト',
          description: 'キーを入力して接続確認',
          instructions: [
            '上のフォームにAPIキーを入力',
            '「保存して接続テスト」をクリック',
          ],
        },
      ],
    },
    {
      id: 'google',
      name: 'Google / YouTube API',
      icon: <Youtube className="h-5 w-5" />,
      color: 'text-red-500',
      description: 'YouTubeアップロードとGoogle Sheets連携に必要',
      testFn: api.testGoogle,
      steps: [
        {
          id: 'google-1',
          title: 'プロジェクト作成とAPI有効化',
          description: 'YouTube Data APIとGoogle Sheets APIを有効に',
          instructions: [
            'Google Cloud Console でプロジェクトを作成',
            '「APIとサービス」→「ライブラリ」でYouTube Data API v3とGoogle Sheets APIを有効化',
          ],
          links: [{ label: 'Google Cloud Console', url: 'https://console.cloud.google.com/' }],
        },
        {
          id: 'google-2',
          title: 'OAuth認証情報を取得',
          description: 'Client IDとClient Secretをコピー',
          instructions: [
            '「認証情報」→「認証情報を作成」→「OAuthクライアントID」→「ウェブアプリケーション」',
            'Client IDとClient Secretをフォームに入力',
          ],
        },
        {
          id: 'google-3',
          title: 'スプレッドシートを準備して接続テスト',
          description: 'データ記録用シートを作成',
          instructions: [
            'Google Sheetsで新規作成、シート名を「Sheet1」に',
            'URLからSpreadsheet IDをコピーしてフォームに入力',
            '「保存して接続テスト」をクリック',
          ],
        },
      ],
    },
    {
      id: 'notion',
      name: 'Notion API',
      icon: <BookOpen className="h-5 w-5" />,
      color: 'text-gray-700',
      description: 'Notionデータベースへの自動記録（オプション）',
      testFn: api.testNotion,
      steps: [
        {
          id: 'notion-1',
          title: 'Integrationを作成してAPIキーを取得',
          description: 'Internal Integration Tokenをコピー',
          instructions: [
            'Notion Integrations →「新しいインテグレーション」を作成',
            '「Internal Integration Token」をコピーしてフォームに入力',
          ],
          links: [{ label: 'Notion Integrations', url: 'https://www.notion.so/my-integrations' }],
        },
        {
          id: 'notion-2',
          title: 'データベースを接続して接続テスト',
          description: 'データベースにインテグレーションを追加',
          instructions: [
            'データベースページ →「...」→「接続先」でインテグレーションを選択',
            'URLからDatabase IDをコピーしてフォームに入力',
            '「保存して接続テスト」をクリック',
          ],
        },
      ],
    },
  ];

  const getServiceStatus = (serviceId: string): 'connected' | 'configured' | 'not_configured' => {
    if (!connectionStatus) return 'not_configured';
    switch (serviceId) {
      case 'zoom':
        return connectionStatus.zoom.connected ? 'connected' : connectionStatus.zoom.configured ? 'configured' : 'not_configured';
      case 'openai':
        return connectionStatus.openai.connected ? 'connected' : connectionStatus.openai.configured ? 'configured' : 'not_configured';
      case 'google':
        return connectionStatus.youtube.connected ? 'connected' : connectionStatus.youtube.configured ? 'configured' : 'not_configured';
      case 'notion':
        return connectionStatus.notion?.connected ? 'connected' : connectionStatus.notion?.configured ? 'configured' : 'not_configured';
      default:
        return 'not_configured';
    }
  };

  // 各サービスが接続済みかどうかをチェック
  const isServiceConnected = (serviceId: string): boolean => {
    return getServiceStatus(serviceId) === 'connected';
  };

  const StatusIcon = ({ status }: { status: 'connected' | 'configured' | 'not_configured' }) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'configured':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const StatusBadge = ({ status }: { status: 'connected' | 'configured' | 'not_configured' }) => {
    switch (status) {
      case 'connected':
        return <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">接続済み</span>;
      case 'configured':
        return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">要接続テスト</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">未設定</span>;
    }
  };

  // 各サービスの認証情報フォームを生成
  const renderCredentialsForm = (serviceId: string) => {
    switch (serviceId) {
      case 'zoom':
        return (
          <div className="p-4 bg-white border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <Key className="h-4 w-4 mr-2 text-orange-500" />
              認証情報
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account ID
                  {settings.zoomAccountId && <span className="ml-2 text-xs text-green-600">設定済み</span>}
                </label>
                <input
                  type="text"
                  value={credentials.zoomAccountId || ''}
                  onChange={(e) => setCredentials({ ...credentials, zoomAccountId: e.target.value })}
                  placeholder={settings.zoomAccountId || 'wK96yaY3SJ6i6X1XtJrfjA'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID
                  {settings.zoomClientId && <span className="ml-2 text-xs text-green-600">設定済み</span>}
                </label>
                <input
                  type="text"
                  value={credentials.zoomClientId || ''}
                  onChange={(e) => setCredentials({ ...credentials, zoomClientId: e.target.value })}
                  placeholder={settings.zoomClientId || 'c7uav0NJSCqcJzqOvsl69g'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                  {settings.zoomClientSecret && <span className="ml-2 text-xs text-green-600">設定済み</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecrets['zoomClientSecret'] ? 'text' : 'password'}
                    value={credentials.zoomClientSecret || ''}
                    onChange={(e) => setCredentials({ ...credentials, zoomClientSecret: e.target.value })}
                    placeholder="****"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500"
                  />
                  <button type="button" onClick={() => toggleShowSecret('zoomClientSecret')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSecrets['zoomClientSecret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook Secret Token
                  {settings.zoomWebhookSecretToken && <span className="ml-2 text-xs text-green-600">設定済み</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecrets['zoomWebhookSecret'] ? 'text' : 'password'}
                    value={credentials.zoomWebhookSecretToken || ''}
                    onChange={(e) => setCredentials({ ...credentials, zoomWebhookSecretToken: e.target.value })}
                    placeholder="****"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500"
                  />
                  <button type="button" onClick={() => toggleShowSecret('zoomWebhookSecret')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSecrets['zoomWebhookSecret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'openai':
        return (
          <div className="p-4 bg-white border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <Key className="h-4 w-4 mr-2 text-orange-500" />
              認証情報
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
                {settings.openaiApiKey && <span className="ml-2 text-xs text-green-600">設定済み</span>}
              </label>
              <div className="relative">
                <input
                  type={showSecrets['openaiApiKey'] ? 'text' : 'password'}
                  value={credentials.openaiApiKey || ''}
                  onChange={(e) => setCredentials({ ...credentials, openaiApiKey: e.target.value })}
                  placeholder="sk-proj-..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500"
                />
                <button type="button" onClick={() => toggleShowSecret('openaiApiKey')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showSecrets['openaiApiKey'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        );
      case 'google':
        return (
          <div className="p-4 bg-white border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <Key className="h-4 w-4 mr-2 text-orange-500" />
              認証情報
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID
                  {settings.googleClientId && <span className="ml-2 text-xs text-green-600">設定済み</span>}
                </label>
                <input
                  type="text"
                  value={credentials.googleClientId || ''}
                  onChange={(e) => setCredentials({ ...credentials, googleClientId: e.target.value })}
                  placeholder={settings.googleClientId || 'xxxxx.apps.googleusercontent.com'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                  {settings.googleClientSecret && <span className="ml-2 text-xs text-green-600">設定済み</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecrets['googleClientSecret'] ? 'text' : 'password'}
                    value={credentials.googleClientSecret || ''}
                    onChange={(e) => setCredentials({ ...credentials, googleClientSecret: e.target.value })}
                    placeholder="GOCSPX-..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500"
                  />
                  <button type="button" onClick={() => toggleShowSecret('googleClientSecret')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSecrets['googleClientSecret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Spreadsheet ID
                  {settings.googleSpreadsheetId && <span className="ml-2 text-xs text-green-600">設定済み</span>}
                </label>
                <input
                  type="text"
                  value={credentials.googleSpreadsheetId || ''}
                  onChange={(e) => setCredentials({ ...credentials, googleSpreadsheetId: e.target.value })}
                  placeholder={settings.googleSpreadsheetId || '18DBlYtvDPNqn2BmQwmThQ5V9lrd1WQNF...'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        );
      case 'notion':
        return (
          <div className="p-4 bg-white border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <Key className="h-4 w-4 mr-2 text-orange-500" />
              認証情報
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                  {settings.notionApiKey && <span className="ml-2 text-xs text-green-600">設定済み</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecrets['notionApiKey'] ? 'text' : 'password'}
                    value={credentials.notionApiKey || ''}
                    onChange={(e) => setCredentials({ ...credentials, notionApiKey: e.target.value })}
                    placeholder="secret_..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-primary-500"
                  />
                  <button type="button" onClick={() => toggleShowSecret('notionApiKey')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSecrets['notionApiKey'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Database ID
                  {settings.notionDatabaseId && <span className="ml-2 text-xs text-green-600">設定済み</span>}
                </label>
                <input
                  type="text"
                  value={credentials.notionDatabaseId || ''}
                  onChange={(e) => setCredentials({ ...credentials, notionDatabaseId: e.target.value })}
                  placeholder={settings.notionDatabaseId || 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
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
      <div className="p-6 max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">セットアップ</h1>
          <p className="text-gray-500 mt-1">各サービスのAPI設定と処理オプション</p>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {/* ステータスサマリー */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-sm font-medium text-gray-700 mb-3">接続状況</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {services.map(service => (
              <div key={service.id} className="flex items-center gap-2">
                <StatusIcon status={getServiceStatus(service.id)} />
                <span className="text-sm text-gray-600">{service.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* サービス別設定 */}
        <div className="space-y-4">
          {services.map(service => {
            const isExpanded = expandedService === service.id;
            const status = getServiceStatus(service.id);

            return (
              <div key={service.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedService(isExpanded ? null : service.id)}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={service.color}>{service.icon}</span>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{service.name}</span>
                        <StatusBadge status={status} />
                      </div>
                      <p className="text-sm text-gray-500">{service.description}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {/* 認証情報フォーム */}
                    {renderCredentialsForm(service.id)}

                    {/* 保存＆接続テストボタン */}
                    {service.testFn && (
                      <div className="p-4 bg-white border-t border-gray-200">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTestAndSave(service.id, service.testFn!)}
                            disabled={testingService === service.id}
                            className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center transition-colors disabled:opacity-50"
                          >
                            {testingService === service.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                {hasCredentialsInput(service.id) ? '保存＆テスト中...' : 'テスト中...'}
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                {hasCredentialsInput(service.id) ? '保存して接続テスト' : '接続テスト'}
                              </>
                            )}
                          </button>
                          {testResults[service.id] && (
                            <span className={`text-sm ${testResults[service.id].success ? 'text-green-600' : 'text-red-600'}`}>
                              {testResults[service.id].success ? '✓' : '✗'} {testResults[service.id].message}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 設定手順 */}
                    <div className="p-4">
                      <h4 className="font-medium text-gray-900 mb-4">設定手順</h4>
                      <ol className="space-y-4">
                        {service.steps.map((step, index) => (
                          <li key={step.id} className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 text-sm">{step.title}</h3>
                              <p className="text-xs text-gray-500">{step.description}</p>
                              <ul className="mt-2 space-y-1">
                                {step.instructions.map((instruction, i) => (
                                  <li key={i} className="text-xs text-gray-600">• {instruction}</li>
                                ))}
                              </ul>
                              {step.id === 'zoom-4' && (
                                <div className="mt-2 p-2 bg-gray-100 rounded flex items-center justify-between gap-2">
                                  <code className="text-xs text-gray-800 break-all">{webhookUrl}</code>
                                  <button onClick={() => copyToClipboard(webhookUrl)} className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-700">
                                    {copiedText === webhookUrl ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                  </button>
                                </div>
                              )}
                              {step.links && step.links.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {step.links.map((link, i) => (
                                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                                      {link.label} <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ))}
                                </div>
                              )}
                              {step.warnings && step.warnings.length > 0 && (
                                <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
                                  {step.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 処理設定 */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">処理設定</h2>
            {savingSettings && <span className="text-xs text-gray-500 flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1" />保存中...</span>}
          </div>
          <div className="space-y-3">
            {/* YouTube */}
            <div className={`card p-4 ${!isServiceConnected('google') ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Youtube className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-gray-900">YouTubeアップロード</p>
                    <p className="text-xs text-gray-500">
                      {isServiceConnected('google')
                        ? '録画を自動的にYouTubeにアップロード'
                        : 'Google/YouTube APIの接続が必要です'}
                    </p>
                  </div>
                </div>
                <label className={`relative inline-flex items-center ${isServiceConnected('google') ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <input
                    type="checkbox"
                    checked={settings.youtubeEnabled && isServiceConnected('google')}
                    onChange={(e) => handleSettingsChange('youtubeEnabled', e.target.checked)}
                    disabled={!isServiceConnected('google')}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${!isServiceConnected('google') ? 'peer-checked:bg-gray-400' : ''}`}></div>
                </label>
              </div>
              {settings.youtubeEnabled && isServiceConnected('google') && (
                <div className="mt-3 pl-8">
                  <select
                    value={settings.youtubePrivacy}
                    onChange={(e) => handleSettingsChange('youtubePrivacy', e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  >
                    <option value="private">非公開</option>
                    <option value="unlisted">限定公開</option>
                    <option value="public">公開</option>
                  </select>
                </div>
              )}
            </div>

            {/* 文字起こし */}
            <div className={`card p-4 ${!isServiceConnected('openai') ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-gray-900">文字起こし（Whisper）</p>
                    <p className="text-xs text-gray-500">
                      {isServiceConnected('openai')
                        ? 'OpenAI Whisperで自動的に文字起こし'
                        : 'OpenAI APIの接続が必要です'}
                    </p>
                  </div>
                </div>
                <label className={`relative inline-flex items-center ${isServiceConnected('openai') ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <input
                    type="checkbox"
                    checked={settings.transcriptionEnabled && isServiceConnected('openai')}
                    onChange={(e) => handleSettingsChange('transcriptionEnabled', e.target.checked)}
                    disabled={!isServiceConnected('openai')}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${!isServiceConnected('openai') ? 'peer-checked:bg-gray-400' : ''}`}></div>
                </label>
              </div>
              {settings.transcriptionEnabled && isServiceConnected('openai') && (
                <div className="mt-3 pl-8">
                  <select
                    value={settings.transcriptionLanguage}
                    onChange={(e) => handleSettingsChange('transcriptionLanguage', e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  >
                    <option value="ja">日本語</option>
                    <option value="en">英語</option>
                    <option value="auto">自動検出</option>
                  </select>
                </div>
              )}
            </div>

            {/* 要約 */}
            <div className={`card p-4 ${!isServiceConnected('openai') ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SettingsIcon className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium text-gray-900">要約生成（GPT-4）</p>
                    <p className="text-xs text-gray-500">
                      {isServiceConnected('openai')
                        ? 'GPT-4でミーティング内容を自動要約'
                        : 'OpenAI APIの接続が必要です'}
                    </p>
                  </div>
                </div>
                <label className={`relative inline-flex items-center ${isServiceConnected('openai') ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <input
                    type="checkbox"
                    checked={settings.summaryEnabled && isServiceConnected('openai')}
                    onChange={(e) => handleSettingsChange('summaryEnabled', e.target.checked)}
                    disabled={!isServiceConnected('openai')}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${!isServiceConnected('openai') ? 'peer-checked:bg-gray-400' : ''}`}></div>
                </label>
              </div>
              {settings.summaryEnabled && isServiceConnected('openai') && (
                <div className="mt-3 pl-8">
                  <select
                    value={settings.summaryStyle}
                    onChange={(e) => handleSettingsChange('summaryStyle', e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  >
                    <option value="brief">簡潔</option>
                    <option value="detailed">詳細</option>
                  </select>
                </div>
              )}
            </div>

            {/* Google Sheets */}
            <div className={`card p-4 ${!isServiceConnected('google') ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Table className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-gray-900">Google Sheets連携</p>
                    <p className="text-xs text-gray-500">
                      {isServiceConnected('google')
                        ? '処理結果をGoogle Sheetsに自動記録'
                        : 'Google/YouTube APIの接続が必要です'}
                    </p>
                  </div>
                </div>
                <label className={`relative inline-flex items-center ${isServiceConnected('google') ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <input
                    type="checkbox"
                    checked={settings.sheetsEnabled && isServiceConnected('google')}
                    onChange={(e) => handleSettingsChange('sheetsEnabled', e.target.checked)}
                    disabled={!isServiceConnected('google')}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${!isServiceConnected('google') ? 'peer-checked:bg-gray-400' : ''}`}></div>
                </label>
              </div>
            </div>

            {/* Notion */}
            <div className={`card p-4 ${!isServiceConnected('notion') ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-gray-700" />
                  <div>
                    <p className="font-medium text-gray-900">Notion連携</p>
                    <p className="text-xs text-gray-500">
                      {isServiceConnected('notion')
                        ? '処理結果をNotionに自動記録'
                        : 'Notion APIの接続が必要です'}
                    </p>
                  </div>
                </div>
                <label className={`relative inline-flex items-center ${isServiceConnected('notion') ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <input
                    type="checkbox"
                    checked={settings.notionEnabled && isServiceConnected('notion')}
                    onChange={(e) => handleSettingsChange('notionEnabled', e.target.checked)}
                    disabled={!isServiceConnected('notion')}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${!isServiceConnected('notion') ? 'peer-checked:bg-gray-400' : ''}`}></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
