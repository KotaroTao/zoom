'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  Search,
  Filter,
  Play,
  ExternalLink,
  FileText,
  Download,
  Loader2,
  Youtube,
  Table,
  BookOpen,
  CheckCircle,
  XCircle,
  MinusCircle,
  X,
  Edit2,
  FileOutput,
  Copy,
  Check,
  MessageCircle,
  MessageSquare,
  Hash,
  Mail,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { DashboardLayout } from '@/components/DashboardLayout';
import { SearchableSelect } from '@/components/SearchableSelect';
import { api, Recording, Client, ReportTemplate } from '@/lib/api';

// 連絡ツールアイコンを取得
const getContactIcon = (type: string | null | undefined) => {
  switch (type) {
    case 'line':
      return <MessageCircle className="h-4 w-4" />;
    case 'messenger':
      return <MessageCircle className="h-4 w-4" />;
    case 'chatwork':
      return <MessageSquare className="h-4 w-4" />;
    case 'slack':
      return <Hash className="h-4 w-4" />;
    case 'teams':
      return <MessageSquare className="h-4 w-4" />;
    case 'email':
      return <Mail className="h-4 w-4" />;
    case 'other':
      return <ExternalLink className="h-4 w-4" />;
    default:
      return <ExternalLink className="h-4 w-4" />;
  }
};

// 連絡ツール名を取得
const getContactLabel = (type: string | null | undefined) => {
  switch (type) {
    case 'line': return 'LINE';
    case 'messenger': return 'Messenger';
    case 'chatwork': return 'ChatWork';
    case 'slack': return 'Slack';
    case 'teams': return 'Teams';
    case 'email': return 'メール';
    case 'other': return '連絡';
    default: return '連絡';
  }
};

// 同期ステータスアイコンコンポーネント
function SyncStatusIcon({
  success,
  error,
  icon: Icon,
  label,
  color
}: {
  success: boolean | null;
  error?: string | null;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}) {
  // null = 未実行、true = 成功、false = 失敗
  const getStatusColor = () => {
    if (success === null) return 'text-gray-300';
    if (success) return color;
    return 'text-red-500';
  };

  const getStatusIcon = () => {
    if (success === null) return <MinusCircle className="h-3 w-3 absolute -bottom-0.5 -right-0.5 text-gray-400 bg-white rounded-full" />;
    if (success) return <CheckCircle className="h-3 w-3 absolute -bottom-0.5 -right-0.5 text-green-500 bg-white rounded-full" />;
    return <XCircle className="h-3 w-3 absolute -bottom-0.5 -right-0.5 text-red-500 bg-white rounded-full" />;
  };

  const getTooltip = () => {
    if (success === null) return `${label}: 未実行`;
    if (success) return `${label}: 成功`;
    return `${label}: 失敗${error ? ` - ${error}` : ''}`;
  };

  return (
    <div className="relative inline-block" title={getTooltip()}>
      <Icon className={`h-4 w-4 ${getStatusColor()}`} />
      {getStatusIcon()}
    </div>
  );
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [editForm, setEditForm] = useState({ title: '', clientName: '' });
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const limit = 20;

  // 報告書生成状態
  const [reportRecording, setReportRecording] = useState<Recording | null>(null);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [generatedReport, setGeneratedReport] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reportClientContacts, setReportClientContacts] = useState<{ type: string; url: string; label?: string | null }[]>([]);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 詳細要約状態
  const [detailedSummaryRecording, setDetailedSummaryRecording] = useState<Recording | null>(null);
  const [detailedSummary, setDetailedSummary] = useState<string | null>(null);
  const [generatingDetailed, setGeneratingDetailed] = useState(false);
  const [loadingDetailed, setLoadingDetailed] = useState(false);

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      const data = await api.getRecordings({
        limit,
        offset: page * limit,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setRecordings(data.recordings);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
      setError('録画の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, [page, statusFilter]);

  const handleEditOpen = async (recording: Recording) => {
    setEditingRecording(recording);
    setEditForm({
      title: recording.title,
      clientName: recording.clientName || '',
    });
    setShowNewClientForm(false);
    setNewClientName('');
    // クライアント一覧を取得
    try {
      const data = await api.getClients();
      // 登録済みクライアントのみ（idがあるもの）をフィルタ
      setClients(data.clients.filter((c: Client) => c.id));
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  // クライアント新規作成
  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;

    setCreatingClient(true);
    try {
      await api.createClient({ name: newClientName.trim() });
      // クライアント一覧を再取得
      const data = await api.getClients();
      setClients(data.clients.filter((c: Client) => c.id));
      // 作成したクライアントを選択
      setEditForm({ ...editForm, clientName: newClientName.trim() });
      setShowNewClientForm(false);
      setNewClientName('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'クライアントの作成に失敗しました';
      setError(errorMessage);
    } finally {
      setCreatingClient(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingRecording) return;

    setSaving(true);
    setError(null);

    try {
      await api.updateRecording({
        id: editingRecording.id,
        title: editForm.title,
        clientName: editForm.clientName || null,
      });
      setEditingRecording(null);
      await fetchRecordings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '保存に失敗しました';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // 報告書生成モーダルを開く
  const handleOpenReportModal = async (recording: Recording) => {
    setReportRecording(recording);
    setGeneratedReport('');
    setSelectedTemplateId('');
    setCopied(false);
    setReportClientContacts([]);

    try {
      // テンプレートとクライアント情報を並行取得
      const [templatesData, clientsData] = await Promise.all([
        api.getTemplates(),
        api.getClients(),
      ]);

      setTemplates(templatesData.templates);
      // デフォルトテンプレートを選択
      const defaultTemplate = templatesData.templates.find(t => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      } else if (templatesData.templates.length > 0) {
        setSelectedTemplateId(templatesData.templates[0].id);
      }

      // クライアントの連絡先情報を取得
      if (recording.clientName) {
        const client = clientsData.clients.find(c => c.name === recording.clientName);
        if (client?.contacts && client.contacts.length > 0) {
          setReportClientContacts(client.contacts.map(c => ({
            type: c.type,
            url: c.url,
            label: c.label,
          })));
        }
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      setError('テンプレートの取得に失敗しました');
    }
  };

  // 報告書を生成
  const handleGenerateReport = async () => {
    if (!reportRecording) return;

    setGenerating(true);
    setError(null);

    try {
      const data = await api.generateReport(
        reportRecording.id,
        selectedTemplateId || undefined,
        false
      );
      setGeneratedReport(data.report);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '報告書の生成に失敗しました';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  // 報告書をコピー
  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(generatedReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // 文字起こし・要約を再処理
  const handleReprocess = async (recordingId: string) => {
    if (!confirm('この録画の文字起こし・要約を再処理しますか？\n処理には数分〜十数分かかる場合があります。\nページを更新してステータスを確認できます。')) {
      return;
    }

    setReprocessingId(recordingId);
    setError(null);

    try {
      const result = await api.reprocessRecording(recordingId);
      if (result.success) {
        alert(result.message || '再処理を開始しました。処理には数分〜十数分かかる場合があります。');
        await fetchRecordings();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '再処理に失敗しました';
      // 「既に処理中」エラーは特別扱い
      if (errorMessage.includes('既に処理中')) {
        alert('この録画は既に処理中です。しばらくお待ちください。');
      } else {
        setError(errorMessage);
        alert(`再処理に失敗しました: ${errorMessage}`);
      }
    } finally {
      setReprocessingId(null);
    }
  };

  // 録画を削除
  const handleDelete = async (recordingId: string, recordingTitle: string) => {
    if (!confirm(`「${recordingTitle}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    setDeletingId(recordingId);
    setError(null);

    try {
      await api.deleteRecording(recordingId);
      alert('録画を削除しました');
      await fetchRecordings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '削除に失敗しました';
      setError(errorMessage);
      alert(`削除に失敗しました: ${errorMessage}`);
    } finally {
      setDeletingId(null);
    }
  };

  // 詳細要約を開く
  const handleOpenDetailedSummary = async (recording: Recording) => {
    setDetailedSummaryRecording(recording);
    setDetailedSummary(null);
    setLoadingDetailed(true);

    try {
      const result = await api.getDetailedSummary(recording.id);
      if (result.success && result.summary) {
        setDetailedSummary(result.summary);
      }
    } catch (err) {
      console.error('Failed to fetch detailed summary:', err);
    } finally {
      setLoadingDetailed(false);
    }
  };

  // 詳細要約を生成
  const handleGenerateDetailedSummary = async () => {
    if (!detailedSummaryRecording) return;

    setGeneratingDetailed(true);

    try {
      const result = await api.generateDetailedSummary(detailedSummaryRecording.id);
      if (result.cached && result.summary) {
        setDetailedSummary(result.summary);
      } else {
        alert('詳細要約の生成を開始しました。処理には数分かかります。\n後ほど再度確認してください。');
        // ポーリングで結果を取得
        const pollInterval = setInterval(async () => {
          try {
            const pollResult = await api.getDetailedSummary(detailedSummaryRecording.id);
            if (pollResult.success && pollResult.summary) {
              setDetailedSummary(pollResult.summary);
              clearInterval(pollInterval);
            }
          } catch {
            // ignore polling errors
          }
        }, 10000); // 10秒ごとにチェック

        // 5分後にポーリング停止
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '詳細要約の生成に失敗しました';
      alert(`エラー: ${errorMessage}`);
    } finally {
      setGeneratingDetailed(false);
    }
  };

  // クライアント側でのテキスト検索フィルター
  const filteredRecordings = recordings.filter((recording) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      recording.title.toLowerCase().includes(query) ||
      recording.clientName?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">録画一覧</h1>
          <p className="text-gray-500 mt-1">すべてのZoom録画を確認</p>
        </div>

      {/* フィルター */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 検索 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="タイトルまたはクライアント名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* ステータスフィルター */}
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">すべて</option>
                <option value="COMPLETED">完了</option>
                <option value="TRANSCRIBING">文字起こし中</option>
                <option value="UPLOADING">アップロード中</option>
                <option value="DOWNLOADING">ダウンロード中</option>
                <option value="PENDING">待機中</option>
                <option value="FAILED">失敗</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* 録画リスト */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* モバイル用カードレイアウト */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredRecordings.map((recording) => (
                <div key={recording.id} className="p-4">
                  {/* タイトルとステータス */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <button
                      onClick={() => handleEditOpen(recording)}
                      className="flex-1 text-left"
                    >
                      <span className="text-sm font-medium text-gray-900 line-clamp-2">
                        {recording.title}
                      </span>
                    </button>
                    <StatusBadge status={recording.status} />
                  </div>

                  {/* クライアントと日時 */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <span>
                      {format(new Date(recording.meetingDate), 'M/d HH:mm', { locale: ja })}
                    </span>
                    <span>•</span>
                    <span>{recording.duration ? `${recording.duration}分` : '-'}</span>
                    <span>•</span>
                    {recording.clientName ? (
                      <Link
                        href={`/clients/${encodeURIComponent(recording.clientName)}`}
                        className="text-primary-600"
                      >
                        {recording.clientName}
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleEditOpen(recording)}
                        className="text-gray-400"
                      >
                        未設定
                      </button>
                    )}
                  </div>

                  {/* 連携状況とアクション */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SyncStatusIcon
                        success={recording.youtubeSuccess}
                        icon={Youtube}
                        label="YouTube"
                        color="text-red-500"
                      />
                      <SyncStatusIcon
                        success={recording.sheetsSuccess}
                        error={recording.sheetsError}
                        icon={Table}
                        label="Sheets"
                        color="text-green-600"
                      />
                      <SyncStatusIcon
                        success={recording.notionSuccess}
                        error={recording.notionError}
                        icon={BookOpen}
                        label="Notion"
                        color="text-gray-700"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditOpen(recording)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="編集"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {recording.summary && (
                        <button
                          onClick={() => setSelectedRecording(recording)}
                          className="p-2 text-gray-400 hover:text-primary-600"
                          title="要約"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                      {recording.youtubeUrl && (
                        <a
                          href={recording.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-red-500"
                          title="YouTube"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {(recording.status === 'FAILED' || !recording.transcript || !recording.summary) && (
                        <button
                          onClick={() => handleReprocess(recording.id)}
                          disabled={reprocessingId === recording.id}
                          className="p-2 text-gray-400 hover:text-orange-500 disabled:opacity-50"
                          title="再処理"
                        >
                          {reprocessingId === recording.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(recording.id, recording.title)}
                        disabled={deletingId === recording.id}
                        className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50"
                        title="削除"
                      >
                        {deletingId === recording.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* デスクトップ用テーブルレイアウト */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      タイトル
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      クライアント
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      日時
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      時間
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ステータス
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      連携
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecordings.map((recording) => (
                    <tr key={recording.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleEditOpen(recording)}
                          className="flex items-center text-left hover:bg-gray-100 rounded-lg p-1 -m-1 transition-colors"
                          title="クリックして編集"
                        >
                          <Play className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate max-w-xs hover:text-primary-600">
                            {recording.title}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        {recording.clientName ? (
                          <Link
                            href={`/clients/${encodeURIComponent(recording.clientName)}`}
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            {recording.clientName}
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleEditOpen(recording)}
                            className="text-sm text-gray-400 hover:text-primary-600 hover:underline"
                            title="クリックしてクライアントを設定"
                          >
                            未設定
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {format(new Date(recording.meetingDate), 'yyyy/M/d HH:mm', {
                          locale: ja,
                        })}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {recording.duration ? `${recording.duration}分` : '-'}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={recording.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <SyncStatusIcon
                            success={recording.youtubeSuccess}
                            icon={Youtube}
                            label="YouTube"
                            color="text-red-500"
                          />
                          <SyncStatusIcon
                            success={recording.sheetsSuccess}
                            error={recording.sheetsError}
                            icon={Table}
                            label="Sheets"
                            color="text-green-600"
                          />
                          <SyncStatusIcon
                            success={recording.notionSuccess}
                            error={recording.notionError}
                            icon={BookOpen}
                            label="Notion"
                            color="text-gray-700"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleEditOpen(recording)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="編集"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {recording.youtubeUrl && (
                            <a
                              href={recording.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg"
                              title="YouTubeで見る"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {recording.summary && (
                            <>
                              <button
                                onClick={() => setSelectedRecording(recording)}
                                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                                title="要約を表示"
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {(recording.status === 'FAILED' || !recording.transcript || !recording.summary) && (
                            <button
                              onClick={() => handleReprocess(recording.id)}
                              disabled={reprocessingId === recording.id}
                              className="p-2 text-gray-400 hover:text-orange-500 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                              title="文字起こし・要約を再処理"
                            >
                              {reprocessingId === recording.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(recording.id, recording.title)}
                            disabled={deletingId === recording.id}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                            title="削除"
                          >
                            {deletingId === recording.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 結果なし */}
            {filteredRecordings.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">該当する録画が見つかりません</p>
              </div>
            )}

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-500 order-2 sm:order-1">
                  全{total}件中 {page * limit + 1}-{Math.min((page + 1) * limit, total)}件
                </div>
                <div className="flex gap-2 order-1 sm:order-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    前へ
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {/* 要約モーダル */}
      {selectedRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between p-3 sm:p-4 border-b gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2">
                {selectedRecording.title}
              </h3>
              <button
                onClick={() => setSelectedRecording(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3 sm:p-4 overflow-y-auto flex-1">
              <div className="text-xs sm:text-sm text-gray-500 mb-3">
                {format(new Date(selectedRecording.meetingDate), 'yyyy年M月d日 HH:mm', { locale: ja })}
                {selectedRecording.clientName && ` • ${selectedRecording.clientName}`}
              </div>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 p-3 sm:p-4 rounded-lg">
                  {selectedRecording.summary}
                </pre>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 p-3 sm:p-4 border-t">
              <div className="flex gap-2 order-2 sm:order-1">
                <button
                  onClick={() => {
                    setSelectedRecording(null);
                    handleOpenReportModal(selectedRecording);
                  }}
                  className="px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg flex items-center justify-center gap-1"
                >
                  <FileOutput className="h-4 w-4" />
                  <span className="hidden sm:inline">報告書</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedRecording(null);
                    handleOpenDetailedSummary(selectedRecording);
                  }}
                  className="px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg flex items-center justify-center gap-1"
                >
                  <FileText className="h-4 w-4" />
                  詳細要約
                </button>
              </div>
              <div className="flex gap-2 justify-end order-1 sm:order-2">
                {selectedRecording.youtubeUrl && (
                  <a
                    href={selectedRecording.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                  >
                    <Youtube className="h-4 w-4" />
                    <span className="hidden sm:inline">YouTube</span>
                  </a>
                )}
                <button
                  onClick={() => setSelectedRecording(null)}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editingRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">録画を編集</h3>
              <button
                onClick={() => setEditingRecording(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    クライアント
                  </label>
                  {!showNewClientForm && (
                    <button
                      type="button"
                      onClick={() => setShowNewClientForm(true)}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      + 新規作成
                    </button>
                  )}
                </div>
                {showNewClientForm ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="新しいクライアント名"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateClient}
                        disabled={creatingClient || !newClientName.trim()}
                        className="px-3 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
                      >
                        {creatingClient && <Loader2 className="h-3 w-3 animate-spin" />}
                        作成
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewClientForm(false);
                        setNewClientName('');
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      ← 既存のクライアントから選択
                    </button>
                  </div>
                ) : (
                  <SearchableSelect
                    options={clients.map((client) => ({
                      value: client.name,
                      label: client.name,
                    }))}
                    value={editForm.clientName}
                    onChange={(value) => setEditForm({ ...editForm, clientName: value })}
                    placeholder="クライアント名で検索..."
                    emptyLabel="未設定"
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setEditingRecording(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving || !editForm.title.trim() || showNewClientForm}
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 報告書生成モーダル */}
      {reportRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                クライアント報告書を生成
              </h3>
              <button
                onClick={() => setReportRecording(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="text-sm text-gray-500 mb-4">
                {reportRecording.title}
                {reportRecording.clientName && ` • ${reportRecording.clientName}`}
              </div>

              {/* テンプレート選択 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  テンプレート
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {templates.length === 0 ? (
                    <option value="">テンプレートがありません</option>
                  ) : (
                    templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.isDefault && ' (デフォルト)'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* 生成ボタン */}
              {!generatedReport && (
                <button
                  onClick={handleGenerateReport}
                  disabled={generating || templates.length === 0}
                  className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <FileOutput className="h-4 w-4" />
                      報告書を生成
                    </>
                  )}
                </button>
              )}

              {/* 生成結果 */}
              {generatedReport && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">生成結果</span>
                    <button
                      onClick={handleCopyReport}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          コピーしました
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          コピー
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    {generatedReport}
                  </pre>
                </div>
              )}
            </div>
            <div className="flex justify-between p-4 border-t">
              <div className="flex gap-2">
                {generatedReport && reportClientContacts.length > 0 && (
                  reportClientContacts.map((contact, index) => (
                    <a
                      key={index}
                      href={contact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                    >
                      {getContactIcon(contact.type)}
                      {contact.label || getContactLabel(contact.type)}
                    </a>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                {generatedReport && (
                  <button
                    onClick={() => {
                      setGeneratedReport('');
                    }}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    再生成
                  </button>
                )}
                <button
                  onClick={() => setReportRecording(null)}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 詳細要約モーダル */}
      {detailedSummaryRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between p-3 sm:p-4 border-b gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2">
                  詳細要約: {detailedSummaryRecording.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {format(new Date(detailedSummaryRecording.meetingDate), 'yyyy年M月d日 HH:mm', { locale: ja })}
                  {detailedSummaryRecording.clientName && ` • ${detailedSummaryRecording.clientName}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setDetailedSummaryRecording(null);
                  setDetailedSummary(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 sm:p-4 overflow-y-auto flex-1">
              {loadingDetailed ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  <span className="ml-2 text-gray-500">読み込み中...</span>
                </div>
              ) : detailedSummary ? (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 p-3 sm:p-4 rounded-lg leading-relaxed">
                    {detailedSummary}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-4">詳細要約はまだ生成されていません</p>
                  <p className="text-sm text-gray-400 mb-6">
                    詳細要約は、通常の要約より長く、ミーティングの内容を<br />
                    より詳細に記録します。処理には数分かかります。
                  </p>
                  <button
                    onClick={handleGenerateDetailedSummary}
                    disabled={generatingDetailed || !detailedSummaryRecording.transcript}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 mx-auto"
                  >
                    {generatingDetailed ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        生成開始中...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        詳細要約を生成
                      </>
                    )}
                  </button>
                  {!detailedSummaryRecording.transcript && (
                    <p className="text-sm text-red-500 mt-2">
                      文字起こしがありません。先に再処理を実行してください。
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center gap-2 p-3 sm:p-4 border-t">
              {detailedSummary && (
                <button
                  onClick={handleGenerateDetailedSummary}
                  disabled={generatingDetailed}
                  className="px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg flex items-center gap-1"
                >
                  {generatingDetailed ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      再生成
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  setDetailedSummaryRecording(null);
                  setDetailedSummary(null);
                }}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg ml-auto"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
