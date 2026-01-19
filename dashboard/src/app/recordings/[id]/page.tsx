'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  ArrowLeft,
  Play,
  ExternalLink,
  Clock,
  Calendar,
  User,
  FileText,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { getRecording, reprocessRecording, type RecordingDetail, type ProcessLog } from '@/lib/api';

interface RecordingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function RecordingDetailPage({ params }: RecordingDetailPageProps) {
  const { id } = use(params);
  const [recording, setRecording] = useState<RecordingDetail | null>(null);
  const [logs, setLogs] = useState<ProcessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'logs'>('summary');

  useEffect(() => {
    const fetchRecording = async () => {
      try {
        setLoading(true);
        const data = await getRecording(id);
        setRecording(data.recording);
        setLogs(data.logs);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch recording:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch recording');
      } finally {
        setLoading(false);
      }
    };

    fetchRecording();
  }, [id]);

  const handleReprocess = async () => {
    if (!recording) return;

    try {
      setReprocessing(true);
      await reprocessRecording(recording.id);
      // 再取得
      const data = await getRecording(id);
      setRecording(data.recording);
      setLogs(data.logs);
    } catch (err) {
      console.error('Failed to reprocess:', err);
      setError(err instanceof Error ? err.message : 'Failed to reprocess');
    } finally {
      setReprocessing(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'transcript' | 'summary') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'transcript') {
        setCopiedTranscript(true);
        setTimeout(() => setCopiedTranscript(false), 2000);
      } else {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="p-6">
        <div className="card bg-red-50 border-red-200">
          <div className="card-body text-red-700 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error || '録画が見つかりません'}
          </div>
        </div>
        <Link href="/recordings" className="mt-4 inline-flex items-center text-primary-600 hover:text-primary-700">
          <ArrowLeft className="h-4 w-4 mr-1" />
          録画一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href="/recordings" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          録画一覧に戻る
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Play className="h-6 w-6 text-gray-400" />
              {recording.title}
            </h1>
            {recording.clientName && (
              <Link
                href={`/clients/${encodeURIComponent(recording.clientName)}`}
                className="text-primary-600 hover:text-primary-700 mt-1 inline-block"
              >
                {recording.clientName}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={recording.status} />
            {recording.youtubeUrl && (
              <a
                href={recording.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                YouTube
              </a>
            )}
            <button
              onClick={handleReprocess}
              disabled={reprocessing || recording.status === 'PENDING' || recording.status === 'DOWNLOADING' || recording.status === 'UPLOADING' || recording.status === 'TRANSCRIBING' || recording.status === 'SUMMARIZING'}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${reprocessing ? 'animate-spin' : ''}`} />
              再処理
            </button>
          </div>
        </div>
      </div>

      {/* メタ情報 */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">日時</p>
                <p className="text-sm font-medium">
                  {format(new Date(recording.meetingDate), 'yyyy年M月d日 HH:mm', { locale: ja })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">時間</p>
                <p className="text-sm font-medium">{recording.duration ? `${recording.duration}分` : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">ホスト</p>
                <p className="text-sm font-medium truncate">{recording.hostEmail || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Zoom ID</p>
                <p className="text-sm font-medium font-mono">{recording.zoomMeetingId}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {recording.status === 'FAILED' && recording.errorMessage && (
        <div className="card mb-6 bg-red-50 border-red-200">
          <div className="card-body">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700">処理エラー</p>
                <p className="text-sm text-red-600 mt-1">{recording.errorMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* タブ */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'summary'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              要約
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'transcript'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              文字起こし
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'logs'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              処理ログ
            </button>
          </nav>
        </div>

        <div className="card-body">
          {/* 要約タブ */}
          {activeTab === 'summary' && (
            <div>
              {recording.summary ? (
                <div>
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => copyToClipboard(recording.summary || '', 'summary')}
                      className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm"
                    >
                      {copiedSummary ? (
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
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700">{recording.summary}</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>要約がまだ生成されていません</p>
                </div>
              )}
            </div>
          )}

          {/* 文字起こしタブ */}
          {activeTab === 'transcript' && (
            <div>
              {recording.transcript ? (
                <div>
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => copyToClipboard(recording.transcript || '', 'transcript')}
                      className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm"
                    >
                      {copiedTranscript ? (
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
                  <div className="max-h-[500px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                      {recording.transcript}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>文字起こしがまだ生成されていません</p>
                </div>
              )}
            </div>
          )}

          {/* 処理ログタブ */}
          {activeTab === 'logs' && (
            <div>
              {logs.length > 0 ? (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        log.status === 'completed'
                          ? 'bg-green-50'
                          : log.status === 'failed'
                          ? 'bg-red-50'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {log.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : log.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 capitalize">{log.step}</p>
                          <span className="text-xs text-gray-500">
                            {format(new Date(log.createdAt), 'HH:mm:ss', { locale: ja })}
                          </span>
                        </div>
                        {log.message && (
                          <p className="text-sm text-gray-600 mt-1">{log.message}</p>
                        )}
                        {log.duration && (
                          <p className="text-xs text-gray-400 mt-1">
                            処理時間: {(log.duration / 1000).toFixed(1)}秒
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>処理ログがありません</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
