'use client';

import { useState } from 'react';
import { Calendar, Clock, User, FileText, ExternalLink, Youtube, FileSpreadsheet, BookOpen, X } from 'lucide-react';
import { Recording } from '@/lib/api';

interface TodaysMeetingsProps {
  recordings: Recording[];
}

export function TodaysMeetings({ recordings }: TodaysMeetingsProps) {
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}分`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}時間${m}分` : `${h}時間`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'PROCESSING': return 'bg-blue-100 text-blue-700';
      case 'FAILED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '完了';
      case 'PROCESSING': return '処理中';
      case 'FAILED': return '失敗';
      case 'DOWNLOADING': return 'DL中';
      case 'TRANSCRIBING': return '文字起こし中';
      case 'SUMMARIZING': return '要約中';
      default: return status;
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-lg">今日のミーティング</h2>
            <span className="ml-auto text-sm text-gray-500">
              {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
          </div>
        </div>

        {recordings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>今日のミーティングはありません</p>
          </div>
        ) : (
          <div className="divide-y">
            {recordings.map(recording => (
              <div
                key={recording.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedRecording(recording)}
              >
                <div className="flex items-start gap-3">
                  <div className="text-center min-w-[50px]">
                    <div className="text-lg font-bold text-blue-600">{formatTime(recording.meetingDate)}</div>
                    <div className="text-xs text-gray-500">{formatDuration(recording.duration)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{recording.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {recording.clientName ? (
                        <span className="flex items-center gap-1 text-sm text-gray-600">
                          <User className="w-3 h-3" />
                          {recording.clientName}
                        </span>
                      ) : (
                        <span className="text-sm text-yellow-600">クライアント未設定</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Sync status icons */}
                    <div className="flex gap-1">
                      {recording.youtubeUrl && (
                        <Youtube className="w-4 h-4 text-red-500" />
                      )}
                      {recording.sheetsRowId && (
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      )}
                      {recording.notionPageId && (
                        <BookOpen className="w-4 h-4 text-gray-700" />
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(recording.status)}`}>
                      {getStatusLabel(recording.status)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Modal */}
      {selectedRecording && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRecording(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{selectedRecording.title}</h3>
                <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(selectedRecording.meetingDate)}
                  </span>
                  {selectedRecording.clientName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {selectedRecording.clientName}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedRecording(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {selectedRecording.summary ? (
                <div className="prose prose-sm max-w-none">
                  <div className="flex items-center gap-2 mb-3 text-gray-600">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium">要約</span>
                  </div>
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                    {selectedRecording.summary}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>要約はまだ生成されていません</p>
                </div>
              )}
            </div>
            {selectedRecording.clientName && (
              <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                <a
                  href={`/clients/${encodeURIComponent(selectedRecording.clientName)}/report`}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  クライアント報告書を生成
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
