'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  Play,
  ExternalLink,
  FileText,
  Loader2,
  X,
  Youtube,
  Edit2,
  RefreshCw,
  Trash2,
  Table,
  BookOpen,
  CheckCircle,
  XCircle,
  MinusCircle,
  FileOutput,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { SearchableSelect } from './SearchableSelect';
import { api, Recording, Client } from '@/lib/api';

// 連携ステータスアイコン
function SyncStatusIcon({
  success,
  error,
  icon: Icon,
  label,
  color,
}: {
  success: boolean | null;
  error?: string | null;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}) {
  if (success === null) {
    return (
      <div className="relative group">
        <MinusCircle className="h-4 w-4 text-gray-300" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
          {label}: 未実行
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="relative group">
        <div className="relative">
          <Icon className={`h-4 w-4 ${color}`} />
          <CheckCircle className="h-2.5 w-2.5 text-green-500 absolute -bottom-0.5 -right-0.5 bg-white rounded-full" />
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
          {label}: 成功
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="relative">
        <Icon className="h-4 w-4 text-gray-300" />
        <XCircle className="h-2.5 w-2.5 text-red-500 absolute -bottom-0.5 -right-0.5 bg-white rounded-full" />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 max-w-xs">
        {label}: 失敗{error && ` - ${error}`}
      </div>
    </div>
  );
}

export function RecentRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [editForm, setEditForm] = useState({ title: '', clientName: '' });
  const [saving, setSaving] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRecordings = async () => {
    try {
      const data = await api.getRecordings({ limit: 5 });
      setRecordings(data.recordings);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
      setError('録画の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const data = await api.getClients();
      setClients(data);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  useEffect(() => {
    fetchRecordings();
    fetchClients();
    const interval = setInterval(fetchRecordings, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleEditOpen = (recording: Recording) => {
    setEditingRecording(recording);
    setEditForm({
      title: recording.title,
      clientName: recording.clientName || '',
    });
  };

  const handleEditSave = async () => {
    if (!editingRecording) return;
    setSaving(true);
    try {
      await api.updateRecording({
        id: editingRecording.id,
        title: editForm.title,
        clientName: editForm.clientName || null,
      });
      await fetchRecordings();
      setEditingRecording(null);
    } catch (err) {
      console.error('Failed to update recording:', err);
      alert('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleReprocess = async (recordingId: string) => {
    if (!confirm('この録画の文字起こし・要約を再処理しますか？')) {
      return;
    }
    setReprocessingId(recordingId);
    try {
      const result = await api.reprocessRecording(recordingId);
      if (result.success) {
        alert(result.message || '再処理を開始しました');
        await fetchRecordings();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '再処理に失敗しました';
      alert(`再処理に失敗しました: ${errorMessage}`);
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDelete = async (recordingId: string, recordingTitle: string) => {
    if (!confirm(`「${recordingTitle}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }
    setDeletingId(recordingId);
    try {
      await api.deleteRecording(recordingId);
      alert('録画を削除しました');
      await fetchRecordings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '削除に失敗しました';
      alert(`削除に失敗しました: ${errorMessage}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">最近の録画</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">最近の録画</h2>
        </div>
        <div className="p-4 text-center text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">最近の録画</h2>
          <Link
            href="/recordings"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            すべて表示 →
          </Link>
        </div>
        {recordings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            録画がまだありません
          </div>
        ) : (
          <>
            {/* モバイル用カードレイアウト */}
            <div className="md:hidden divide-y divide-gray-200">
              {recordings.map((recording) => (
                <div key={recording.id} className="p-4">
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
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <span>{format(new Date(recording.meetingDate), 'M/d HH:mm', { locale: ja })}</span>
                    <span>•</span>
                    <span>{recording.duration ? `${recording.duration}分` : '-'}</span>
                    <span>•</span>
                    {recording.clientName ? (
                      <Link href={`/clients/${encodeURIComponent(recording.clientName)}`} className="text-primary-600">
                        {recording.clientName}
                      </Link>
                    ) : (
                      <button onClick={() => handleEditOpen(recording)} className="text-gray-400">未設定</button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SyncStatusIcon success={recording.youtubeSuccess} icon={Youtube} label="YouTube" color="text-red-500" />
                      <SyncStatusIcon success={recording.sheetsSuccess} error={recording.sheetsError} icon={Table} label="Sheets" color="text-green-600" />
                      <SyncStatusIcon success={recording.notionSuccess} error={recording.notionError} icon={BookOpen} label="Notion" color="text-gray-700" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEditOpen(recording)} className="p-2 text-gray-400 hover:text-gray-600" title="編集">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {recording.summary && (
                        <button onClick={() => setSelectedRecording(recording)} className="p-2 text-gray-400 hover:text-primary-600" title="要約">
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                      {recording.youtubeUrl && (
                        <a href={recording.youtubeUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-red-500" title="YouTube">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {(recording.status === 'FAILED' || !recording.transcript || !recording.summary) && (
                        <button onClick={() => handleReprocess(recording.id)} disabled={reprocessingId === recording.id} className="p-2 text-gray-400 hover:text-orange-500 disabled:opacity-50" title="再処理">
                          {reprocessingId === recording.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </button>
                      )}
                      <button onClick={() => handleDelete(recording.id, recording.title)} disabled={deletingId === recording.id} className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50" title="削除">
                        {deletingId === recording.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイトル</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">クライアント</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日時</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">連携</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">アクション</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recordings.map((recording) => (
                    <tr key={recording.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <button onClick={() => handleEditOpen(recording)} className="flex items-center text-left hover:bg-gray-100 rounded-lg p-1 -m-1 transition-colors" title="クリックして編集">
                          <Play className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate max-w-xs hover:text-primary-600">{recording.title}</span>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        {recording.clientName ? (
                          <Link href={`/clients/${encodeURIComponent(recording.clientName)}`} className="text-sm text-primary-600 hover:text-primary-700">
                            {recording.clientName}
                          </Link>
                        ) : (
                          <button onClick={() => handleEditOpen(recording)} className="text-sm text-gray-400 hover:text-primary-600 hover:underline" title="クリックしてクライアントを設定">
                            未設定
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {format(new Date(recording.meetingDate), 'M/d HH:mm', { locale: ja })}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={recording.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <SyncStatusIcon success={recording.youtubeSuccess} icon={Youtube} label="YouTube" color="text-red-500" />
                          <SyncStatusIcon success={recording.sheetsSuccess} error={recording.sheetsError} icon={Table} label="Sheets" color="text-green-600" />
                          <SyncStatusIcon success={recording.notionSuccess} error={recording.notionError} icon={BookOpen} label="Notion" color="text-gray-700" />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end space-x-1">
                          <button onClick={() => handleEditOpen(recording)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="編集">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {recording.youtubeUrl && (
                            <a href={recording.youtubeUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg" title="YouTubeで見る">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {recording.summary && (
                            <button onClick={() => setSelectedRecording(recording)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="要約を表示">
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          {(recording.status === 'FAILED' || !recording.transcript || !recording.summary) && (
                            <button onClick={() => handleReprocess(recording.id)} disabled={reprocessingId === recording.id} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-gray-100 rounded-lg disabled:opacity-50" title="文字起こし・要約を再処理">
                              {reprocessingId === recording.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </button>
                          )}
                          <button onClick={() => handleDelete(recording.id, recording.title)} disabled={deletingId === recording.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg disabled:opacity-50" title="削除">
                            {deletingId === recording.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 要約モーダル */}
      {selectedRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between p-3 sm:p-4 border-b gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2">
                {selectedRecording.title}
              </h3>
              <button onClick={() => setSelectedRecording(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0">
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
              <Link
                href="/recordings"
                onClick={() => setSelectedRecording(null)}
                className="px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg flex items-center justify-center gap-1 order-2 sm:order-1"
              >
                <FileOutput className="h-4 w-4" />
                <span className="hidden sm:inline">クライアント</span>報告書を生成
              </Link>
              <div className="flex gap-2 justify-end order-1 sm:order-2">
                {selectedRecording.youtubeUrl && (
                  <a href={selectedRecording.youtubeUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1">
                    <Youtube className="h-4 w-4" />
                    <span className="hidden sm:inline">YouTube</span>
                  </a>
                )}
                <button onClick={() => setSelectedRecording(null)} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">
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
              <button onClick={() => setEditingRecording(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">クライアント</label>
                <SearchableSelect
                  options={clients.map((client) => ({ value: client.name, label: client.name }))}
                  value={editForm.clientName}
                  onChange={(value) => setEditForm({ ...editForm, clientName: value })}
                  placeholder="クライアント名で検索..."
                  emptyLabel="未設定"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setEditingRecording(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                キャンセル
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving || !editForm.title.trim()}
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
