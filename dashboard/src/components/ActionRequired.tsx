'use client';

import { useState } from 'react';
import { AlertTriangle, UserX, FileX, RefreshCw, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { Recording, api, Client } from '@/lib/api';
import { SearchableSelect } from './SearchableSelect';

interface ActionRequiredProps {
  failed: Recording[];
  noClient: Recording[];
  noSummary: Recording[];
  clients: Client[];
  onUpdate: () => void;
}

export function ActionRequired({ failed, noClient, noSummary, clients, onUpdate }: ActionRequiredProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(
    failed.length > 0 ? 'failed' : noClient.length > 0 ? 'noClient' : noSummary.length > 0 ? 'noSummary' : null
  );
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState<string>('');

  const totalIssues = failed.length + noClient.length + noSummary.length;

  if (totalIssues === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 text-green-600">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            ✓
          </div>
          <div>
            <h3 className="font-semibold">対応が必要な項目はありません</h3>
            <p className="text-sm text-gray-500">すべての録画が正常に処理されています</p>
          </div>
        </div>
      </div>
    );
  }

  const handleReprocess = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await api.reprocessRecording(id);
      onUpdate();
    } catch (error) {
      console.error('Reprocess failed:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleEditStart = (recording: Recording) => {
    setEditingId(recording.id);
    setEditClientName(recording.clientName || '');
  };

  const handleEditSave = async (id: string) => {
    try {
      await api.updateRecording({ id, clientName: editClientName || null });
      setEditingId(null);
      onUpdate();
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const clientOptions = clients.map(c => ({ value: c.name, label: c.name }));

  const sections = [
    {
      key: 'failed',
      items: failed,
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      title: '処理失敗',
      description: '再処理が必要です',
    },
    {
      key: 'noClient',
      items: noClient,
      icon: UserX,
      iconColor: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      title: 'クライアント未設定',
      description: 'クライアントを設定してください',
    },
    {
      key: 'noSummary',
      items: noSummary,
      icon: FileX,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      title: '要約未生成',
      description: '要約の生成が必要です',
    },
  ].filter(s => s.items.length > 0);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="font-bold text-lg">対応が必要</h2>
          <span className="ml-auto bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-sm font-medium">
            {totalIssues}件
          </span>
        </div>
      </div>

      <div className="divide-y">
        {sections.map(section => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.key;

          return (
            <div key={section.key}>
              <button
                onClick={() => toggleSection(section.key)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors ${isExpanded ? section.bgColor : ''}`}
              >
                <div className={`w-8 h-8 rounded-full ${section.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${section.iconColor}`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{section.title}</div>
                  <div className="text-sm text-gray-500">{section.items.length}件</div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className={`${section.bgColor} border-t ${section.borderColor}`}>
                  {section.items.map(recording => (
                    <div
                      key={recording.id}
                      className="p-3 border-b last:border-b-0 border-white/50 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{recording.title}</div>
                        <div className="text-xs text-gray-500">{formatDate(recording.meetingDate)}</div>
                      </div>

                      {section.key === 'noClient' ? (
                        editingId === recording.id ? (
                          <div className="flex items-center gap-2">
                            <SearchableSelect
                              options={clientOptions}
                              value={editClientName}
                              onChange={setEditClientName}
                              placeholder="クライアント"
                              className="w-40"
                            />
                            <button
                              onClick={() => handleEditSave(recording.id)}
                              className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditStart(recording)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            設定
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleReprocess(recording.id)}
                          disabled={processingIds.has(recording.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${processingIds.has(recording.id) ? 'animate-spin' : ''}`} />
                          {processingIds.has(recording.id) ? '処理中' : '再処理'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
