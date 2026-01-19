'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, ConnectionStatus } from '@/lib/api';

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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [testingService, setTestingService] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // 接続状態を取得
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await api.getConnectionStatus();
        setConnectionStatus(status);
      } catch (err) {
        console.error('Failed to fetch connection status:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
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

  const handleTest = async (serviceId: string, testFn: () => Promise<{ success: boolean; message: string }>) => {
    setTestingService(serviceId);
    try {
      const result = await testFn();
      setTestResults(prev => ({ ...prev, [serviceId]: result }));
      // 成功時は接続状態を更新
      if (result.success) {
        const status = await api.getConnectionStatus();
        setConnectionStatus(status);
      }
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
          title: 'Zoom Marketplaceでアプリを作成',
          description: 'Server-to-Server OAuthアプリを作成します',
          instructions: [
            'Zoom App Marketplace にアクセス',
            '「Develop」→「Build App」をクリック',
            '「Server-to-Server OAuth」を選択',
            'アプリ名を入力して作成',
          ],
          links: [
            { label: 'Zoom App Marketplace', url: 'https://marketplace.zoom.us/' },
          ],
        },
        {
          id: 'zoom-2',
          title: '認証情報を取得',
          description: 'Account ID、Client ID、Client Secretをコピーします',
          instructions: [
            '作成したアプリの「App Credentials」タブを開く',
            '「Account ID」をコピー',
            '「Client ID」をコピー',
            '「Client Secret」をコピー',
            '設定ページで各値を入力して保存',
          ],
          links: [
            { label: '設定ページ', url: '/settings' },
          ],
        },
        {
          id: 'zoom-3',
          title: 'スコープを設定',
          description: '録画へのアクセス権限を付与します',
          instructions: [
            '「Scopes」タブを開く',
            '「+ Add Scopes」をクリック',
            '以下のスコープを追加:',
            '  - cloud_recording:read:list_user_recordings',
            '  - cloud_recording:read:recording',
            '  - user:read:user',
          ],
          tips: [
            'スコープ名で検索すると見つけやすいです',
          ],
        },
        {
          id: 'zoom-4',
          title: 'Webhookを設定',
          description: '録画完了時に自動通知を受け取ります',
          instructions: [
            '「Feature」タブを開く',
            '「Event Subscriptions」をオンにする',
            '「Add Event Subscription」をクリック',
            '以下のWebhook URLを設定:',
          ],
          tips: [
            'Webhook URLはhttpsである必要があります',
            'ngrokなどを使ってローカル開発も可能です',
          ],
        },
        {
          id: 'zoom-5',
          title: 'イベントタイプを選択',
          description: '録画完了イベントを購読します',
          instructions: [
            '「Add Events」をクリック',
            '「Recording」カテゴリを展開',
            '「All Recordings have completed」を選択',
            '「Done」をクリック',
            '「Save」をクリック',
          ],
        },
        {
          id: 'zoom-6',
          title: 'Webhook Secret Tokenを取得',
          description: '署名検証用のシークレットトークンをコピーします',
          instructions: [
            'Event Subscriptionの「Secret Token」をコピー',
            '設定ページで「Webhook Secret Token」に入力して保存',
          ],
          warnings: [
            'Secret Tokenは必ず保存してください。Webhook署名の検証に使用します',
          ],
        },
        {
          id: 'zoom-7',
          title: 'アプリを有効化',
          description: 'アプリをアクティブにします',
          instructions: [
            '「Activation」タブを開く',
            '「Activate your app」をクリック',
            'アプリのステータスが「Active」になることを確認',
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
          title: 'OpenAIアカウントを作成',
          description: 'OpenAIプラットフォームにアカウントを登録します',
          instructions: [
            'OpenAI Platform にアクセス',
            '「Sign up」をクリック',
            'メールアドレスで登録またはGoogleアカウントでログイン',
          ],
          links: [
            { label: 'OpenAI Platform', url: 'https://platform.openai.com/' },
          ],
        },
        {
          id: 'openai-2',
          title: 'APIキーを作成',
          description: 'API呼び出し用のキーを発行します',
          instructions: [
            'ダッシュボードで「API keys」をクリック',
            '「Create new secret key」をクリック',
            'キーに名前をつけて作成',
            '表示されたキーをコピー（一度しか表示されません）',
            '設定ページで「OpenAI API Key」に入力して保存',
          ],
          links: [
            { label: 'API Keys', url: 'https://platform.openai.com/api-keys' },
            { label: '設定ページ', url: '/settings' },
          ],
          warnings: [
            'APIキーは作成時に一度だけ表示されます。必ずコピーしてください',
          ],
        },
        {
          id: 'openai-3',
          title: '利用料金を確認',
          description: '請求設定とクレジットを確認します',
          instructions: [
            '「Settings」→「Billing」をクリック',
            '支払い方法を設定（クレジットカード）',
            '必要に応じてUsage limitsを設定',
          ],
          links: [
            { label: 'Billing', url: 'https://platform.openai.com/settings/organization/billing' },
          ],
          tips: [
            '新規アカウントには無料クレジットが付与される場合があります',
            'Whisper APIは音声1分あたり約$0.006です',
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
          title: 'Google Cloud Projectを作成',
          description: 'Google Cloud Consoleで新しいプロジェクトを作成します',
          instructions: [
            'Google Cloud Console にアクセス',
            '上部の「プロジェクトを選択」をクリック',
            '「新しいプロジェクト」をクリック',
            'プロジェクト名を入力して「作成」',
          ],
          links: [
            { label: 'Google Cloud Console', url: 'https://console.cloud.google.com/' },
          ],
        },
        {
          id: 'google-2',
          title: 'APIを有効化',
          description: 'YouTube Data APIとGoogle Sheets APIを有効にします',
          instructions: [
            '「APIとサービス」→「ライブラリ」を開く',
            '「YouTube Data API v3」を検索して「有効にする」',
            '「Google Sheets API」を検索して「有効にする」',
          ],
          links: [
            { label: 'YouTube Data API v3', url: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com' },
            { label: 'Google Sheets API', url: 'https://console.cloud.google.com/apis/library/sheets.googleapis.com' },
          ],
        },
        {
          id: 'google-3',
          title: 'OAuth同意画面を設定',
          description: 'アプリの認証画面を設定します',
          instructions: [
            '「APIとサービス」→「OAuth同意画面」を開く',
            '「外部」を選択して「作成」',
            'アプリ名、ユーザーサポートメール、デベロッパー連絡先を入力',
            '「保存して次へ」をクリック',
            'スコープは後で設定するのでそのまま「保存して次へ」',
            'テストユーザーに自分のGmailアドレスを追加',
            '「保存して次へ」で完了',
          ],
          tips: [
            '本番環境で使用する場合はアプリの公開審査が必要です',
            'テストモードでは登録したテストユーザーのみ利用可能です',
          ],
        },
        {
          id: 'google-4',
          title: 'OAuth認証情報を作成',
          description: 'Client IDとClient Secretを取得します',
          instructions: [
            '「APIとサービス」→「認証情報」を開く',
            '「認証情報を作成」→「OAuthクライアントID」を選択',
            'アプリケーションの種類で「ウェブアプリケーション」を選択',
            '名前を入力',
            '「承認済みのリダイレクトURI」に以下を追加:',
            '  http://localhost:3002/auth/google/callback',
            '  https://your-domain.com/auth/google/callback',
            '「作成」をクリック',
            '表示されたClient IDとClient Secretをコピー',
            '設定ページで「Google Client ID」「Google Client Secret」に入力して保存',
          ],
          links: [
            { label: '認証情報', url: 'https://console.cloud.google.com/apis/credentials' },
            { label: '設定ページ', url: '/settings' },
          ],
        },
        {
          id: 'google-5',
          title: 'サーバーでGoogle認証を実行',
          description: '初回のOAuth認証をサーバーで実行します',
          instructions: [
            'サーバーが起動していることを確認',
            '以下のコマンドをサーバーで実行:',
            '  npx tsx scripts/google-auth.ts',
            '表示されるURLをブラウザで開く',
            'Googleアカウントでログイン',
            '必要な権限を許可',
            '認証完了メッセージを確認',
          ],
          tips: [
            '認証情報はサーバーのgoogle-tokens.jsonに保存されます',
            '認証は一度だけ必要です',
          ],
        },
        {
          id: 'google-6',
          title: 'スプレッドシートを作成・共有',
          description: '録画データを記録するスプレッドシートを準備します',
          instructions: [
            'Google Spreadsheetsで新しいスプレッドシートを作成',
            '最初のシートタブ名を「Sheet1」にリネーム',
            '  ※デフォルトの「シート1」ではエラーになります',
            'URLからスプレッドシートIDをコピー',
            '  例: https://docs.google.com/spreadsheets/d/[この部分がID]/edit',
            '設定ページで「Spreadsheet ID」に入力して保存',
            '「共有」ボタンをクリック',
            '認証したGoogleアカウントを「編集者」として追加',
          ],
          links: [
            { label: 'Google Spreadsheets', url: 'https://sheets.google.com/' },
            { label: '設定ページ', url: '/settings' },
          ],
          warnings: [
            'シートタブ名は必ず「Sheet1」にしてください（日本語の「シート1」ではエラーになります）',
            'スプレッドシートの共有設定で「編集者」権限を付与してください',
          ],
        },
      ],
    },
    {
      id: 'notion',
      name: 'Notion API',
      icon: <BookOpen className="h-5 w-5" />,
      color: 'text-gray-700',
      description: 'Notionデータベースへの自動記録に必要（オプション）',
      testFn: api.testNotion,
      steps: [
        {
          id: 'notion-1',
          title: 'Notion Integrationを作成',
          description: 'Notion APIにアクセスするためのインテグレーションを作成します',
          instructions: [
            'Notion Integrations にアクセス',
            '「新しいインテグレーション」をクリック',
            '名前を入力（例: Zoom Recording Sync）',
            '関連付けるワークスペースを選択',
            '「送信」をクリック',
          ],
          links: [
            { label: 'Notion Integrations', url: 'https://www.notion.so/my-integrations' },
          ],
        },
        {
          id: 'notion-2',
          title: 'APIキーを取得',
          description: 'Internal Integration Tokenをコピーします',
          instructions: [
            '作成したインテグレーションを開く',
            '「シークレット」セクションで「表示」をクリック',
            '「Internal Integration Token」をコピー',
            '設定ページで「Notion API Key」に入力して保存',
          ],
          links: [
            { label: '設定ページ', url: '/settings' },
          ],
          tips: [
            'トークンは「secret_」で始まります',
          ],
        },
        {
          id: 'notion-3',
          title: 'データベースを作成',
          description: '録画データを保存するデータベースを作成します',
          instructions: [
            'Notionで新しいページを作成',
            '「/database」と入力して「データベース - フルページ」を選択',
            '以下のプロパティを正確な名前で追加:',
            '  - タイトル: タイトル型（デフォルトの「名前」列をリネーム）',
            '  - クライアント: テキスト型',
            '  - 開催日時: 日付型',
            '  - YouTube: URL型',
            '  - Zoom URL: URL型',
            '  - 時間（分）: 数値型',
            '  - ホスト: テキスト型',
            '  - ステータス: セレクト型（COMPLETED, FAILED, PENDING）',
          ],
          warnings: [
            'プロパティ名は完全一致が必要です。「YouTube URL」ではなく「YouTube」としてください',
            '要約はページ本文に自動追記されます',
          ],
        },
        {
          id: 'notion-4',
          title: 'インテグレーションをデータベースに接続',
          description: 'データベースへのアクセス権限を付与します',
          instructions: [
            'データベースページの右上「...」をクリック',
            '「接続先」→ 作成したインテグレーション名を選択',
            '「確認」をクリック',
          ],
          warnings: [
            'この手順を忘れるとAPIからデータベースにアクセスできません',
          ],
        },
        {
          id: 'notion-5',
          title: 'Database IDを取得',
          description: 'データベースのIDをコピーします',
          instructions: [
            'データベースページを開く',
            'URLからDatabase IDをコピー',
            '  例: https://notion.so/[workspace]/[この32文字がID]?v=...',
            '  または: https://notion.so/[この32文字がID]?v=...',
            '設定ページで「Notion Database ID」に入力して保存',
          ],
          links: [
            { label: '設定ページ', url: '/settings' },
          ],
          tips: [
            'IDは32文字の英数字です（ハイフンを含む場合もあります）',
          ],
        },
      ],
    },
  ];

  const getServiceStatus = (serviceId: string): 'connected' | 'configured' | 'not_configured' => {
    if (!connectionStatus) return 'not_configured';

    switch (serviceId) {
      case 'zoom':
        return connectionStatus.zoom.connected ? 'connected' :
               connectionStatus.zoom.configured ? 'configured' : 'not_configured';
      case 'openai':
        return connectionStatus.openai.connected ? 'connected' :
               connectionStatus.openai.configured ? 'configured' : 'not_configured';
      case 'google':
        return connectionStatus.youtube.connected ? 'connected' :
               connectionStatus.youtube.configured ? 'configured' : 'not_configured';
      case 'notion':
        return connectionStatus.notion?.connected ? 'connected' :
               connectionStatus.notion?.configured ? 'configured' : 'not_configured';
      default:
        return 'not_configured';
    }
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
        return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">設定済み</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">未設定</span>;
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
          <h1 className="text-2xl font-bold text-gray-900">セットアップガイド</h1>
          <p className="text-gray-500 mt-1">各サービスのAPI設定を順番に行ってください</p>
        </div>

        {/* ステータスサマリー */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-sm font-medium text-gray-700 mb-3">接続状況</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {services.map(service => {
              const status = getServiceStatus(service.id);
              return (
                <div key={service.id} className="flex items-center gap-2">
                  <StatusIcon status={status} />
                  <span className="text-sm text-gray-600">{service.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* サービス別設定 */}
        <div className="space-y-4">
          {services.map(service => {
            const isExpanded = expandedService === service.id;
            const status = getServiceStatus(service.id);

            return (
              <div key={service.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* サービスヘッダー */}
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
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {/* 展開コンテンツ */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {/* 接続テストボタン */}
                    {service.testFn && (
                      <div className="p-4 bg-white border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTest(service.id, service.testFn!)}
                            disabled={testingService === service.id}
                            className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center transition-colors disabled:opacity-50"
                          >
                            {testingService === service.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                テスト中...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                接続テスト
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

                    {/* 設定ステップ */}
                    <div className="p-4">
                      <ol className="space-y-6">
                        {service.steps.map((step, index) => (
                          <li key={step.id} className="relative">
                            {/* ステップ番号 */}
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full font-medium text-sm">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-gray-900">{step.title}</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>

                                {/* 手順リスト */}
                                <ul className="mt-3 space-y-2">
                                  {step.instructions.map((instruction, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                      <span className="text-gray-400 mt-0.5">•</span>
                                      <span>{instruction}</span>
                                    </li>
                                  ))}
                                </ul>

                                {/* Webhook URL表示（Zoom用） */}
                                {step.id === 'zoom-4' && (
                                  <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                                    <div className="flex items-center justify-between gap-2">
                                      <code className="text-sm text-gray-800 break-all">{webhookUrl}</code>
                                      <button
                                        onClick={() => copyToClipboard(webhookUrl)}
                                        className="flex-shrink-0 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                                        title="コピー"
                                      >
                                        {copiedText === webhookUrl ? (
                                          <Check className="h-4 w-4 text-green-500" />
                                        ) : (
                                          <Copy className="h-4 w-4" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* リンク */}
                                {step.links && step.links.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {step.links.map((link, i) => (
                                      <a
                                        key={i}
                                        href={link.url}
                                        target={link.url.startsWith('http') ? '_blank' : undefined}
                                        rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 hover:underline"
                                      >
                                        {link.label}
                                        {link.url.startsWith('http') && <ExternalLink className="h-3 w-3" />}
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {/* ヒント */}
                                {step.tips && step.tips.length > 0 && (
                                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-xs font-medium text-blue-700 mb-1">ヒント</p>
                                    <ul className="space-y-1">
                                      {step.tips.map((tip, i) => (
                                        <li key={i} className="text-sm text-blue-600">{tip}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* 警告 */}
                                {step.warnings && step.warnings.length > 0 && (
                                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                                    <p className="text-xs font-medium text-yellow-700 mb-1">注意</p>
                                    <ul className="space-y-1">
                                      {step.warnings.map((warning, i) => (
                                        <li key={i} className="text-sm text-yellow-700">{warning}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
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

        {/* 設定ページへのリンク */}
        <div className="mt-8 p-4 bg-primary-50 rounded-lg">
          <p className="text-sm text-primary-700">
            API認証情報は<a href="/settings" className="font-medium underline hover:text-primary-800">設定ページ</a>で入力・保存できます。
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
