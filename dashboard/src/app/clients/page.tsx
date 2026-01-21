'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  Users,
  Video,
  Clock,
  ChevronRight,
  Loader2,
  Plus,
  X,
  Edit2,
  Trash2,
  MessageCircle,
  MessageSquare,
  Hash,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, Client } from '@/lib/api';

// カラーオプション
const colorOptions = [
  { value: '#3B82F6', label: '青' },
  { value: '#10B981', label: '緑' },
  { value: '#F59E0B', label: 'オレンジ' },
  { value: '#EF4444', label: '赤' },
  { value: '#8B5CF6', label: '紫' },
  { value: '#EC4899', label: 'ピンク' },
  { value: '#6B7280', label: 'グレー' },
];

// 連絡ツールオプション
const contactTypeOptions = [
  { value: '', label: '未設定' },
  { value: 'line', label: 'LINE' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'chatwork', label: 'ChatWork' },
  { value: 'slack', label: 'Slack' },
  { value: 'teams', label: 'Teams' },
  { value: 'email', label: 'メール' },
  { value: 'other', label: 'その他' },
];

// 連絡ツールアイコンを取得
const getContactIcon = (type: string | null | undefined) => {
  switch (type) {
    case 'line':
      return <MessageCircle className="h-4 w-4 text-green-500" />;
    case 'messenger':
      return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case 'chatwork':
      return <MessageSquare className="h-4 w-4 text-red-500" />;
    case 'slack':
      return <Hash className="h-4 w-4 text-purple-500" />;
    case 'teams':
      return <MessageSquare className="h-4 w-4 text-blue-600" />;
    case 'email':
      return <Mail className="h-4 w-4 text-gray-600" />;
    case 'other':
      return <ExternalLink className="h-4 w-4 text-gray-500" />;
    default:
      return null;
  }
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    zoomUrl: '',
    contactType: '',
    contactUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      const data = await api.getClients();
      setClients(data.clients);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
      setError('クライアントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleOpenModal = (client?: Client) => {
    if (client && client.id) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        description: client.description || '',
        color: client.color || '#3B82F6',
        zoomUrl: client.zoomUrl || '',
        contactType: client.contactType || '',
        contactUrl: client.contactUrl || '',
      });
    } else {
      setEditingClient(null);
      setFormData({ name: '', description: '', color: '#3B82F6', zoomUrl: '', contactType: '', contactUrl: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({ name: '', description: '', color: '#3B82F6', zoomUrl: '', contactType: '', contactUrl: '' });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('クライアント名を入力してください');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingClient?.id) {
        await api.updateClient({
          id: editingClient.id,
          name: formData.name,
          description: formData.description || undefined,
          color: formData.color,
          zoomUrl: formData.zoomUrl || undefined,
          contactType: formData.contactType || undefined,
          contactUrl: formData.contactUrl || undefined,
        });
      } else {
        await api.createClient({
          name: formData.name,
          description: formData.description || undefined,
          color: formData.color,
          zoomUrl: formData.zoomUrl || undefined,
          contactType: formData.contactType || undefined,
          contactUrl: formData.contactUrl || undefined,
        });
      }
      handleCloseModal();
      await fetchClients();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '保存に失敗しました';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteClient(id);
      setDeleteConfirm(null);
      await fetchClients();
    } catch (err) {
      console.error('Failed to delete client:', err);
      setError('削除に失敗しました');
    }
  };

  const totalRecordings = clients.reduce((acc, c) => acc + c.recordingCount, 0);
  const totalDuration = clients.reduce((acc, c) => acc + c.totalDuration, 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">クライアント一覧</h1>
            <p className="text-gray-500 mt-1">クライアント別のミーティング履歴を確認</p>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">クライアント一覧</h1>
            <p className="text-gray-500 mt-1">
              クライアント別のミーティング履歴を確認
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            クライアント追加
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 統計サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <div className="card-body flex items-center">
              <div className="p-2 bg-blue-50 rounded-lg mr-3">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">総クライアント数</p>
                <p className="text-xl font-bold text-gray-900">
                  {clients.length}社
                </p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body flex items-center">
              <div className="p-2 bg-green-50 rounded-lg mr-3">
                <Video className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">総録画数</p>
                <p className="text-xl font-bold text-gray-900">
                  {totalRecordings}件
                </p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body flex items-center">
              <div className="p-2 bg-purple-50 rounded-lg mr-3">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">総時間</p>
                <p className="text-xl font-bold text-gray-900">
                  {Math.round(totalDuration / 60)}時間
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* クライアントリスト */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">クライアント</h2>
          </div>
          {clients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              クライアントがまだありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      クライアント名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      録画数
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      総時間
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      最終MTG
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id || client.name} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: client.color ? `${client.color}20` : '#E0E7FF' }}
                          >
                            <span
                              className="font-medium"
                              style={{ color: client.color || '#4F46E5' }}
                            >
                              {client.name.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {client.name}
                              </span>
                              {client.contactUrl && client.contactType && (
                                <a
                                  href={client.contactUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:opacity-70"
                                  title={`${contactTypeOptions.find(o => o.value === client.contactType)?.label || '連絡'}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {getContactIcon(client.contactType)}
                                </a>
                              )}
                            </div>
                            {client.description && (
                              <p className="text-xs text-gray-500">{client.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">
                          {client.recordingCount}件
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">
                          {Math.floor(client.totalDuration / 60)}時間
                          {client.totalDuration % 60}分
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">
                          {client.lastMeetingDate
                            ? format(new Date(client.lastMeetingDate), 'yyyy/M/d', {
                                locale: ja,
                              })
                            : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {client.id && (
                            <>
                              <button
                                onClick={() => handleOpenModal(client)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                title="編集"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(client.id!)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="削除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <Link
                            href={`/clients/${encodeURIComponent(client.name)}`}
                            className="inline-flex items-center px-2 py-1 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded"
                          >
                            詳細
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 追加/編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingClient ? 'クライアント編集' : 'クライアント追加'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  クライアント名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="株式会社サンプル"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明（任意）
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="プロジェクト名や担当者など"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zoom URL（任意）
                </label>
                <input
                  type="text"
                  value={formData.zoomUrl}
                  onChange={(e) => setFormData({ ...formData, zoomUrl: e.target.value })}
                  placeholder="https://us02web.zoom.us/j/1234567890"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  このURLで行われたミーティングは自動的にこのクライアントに割り当てられます
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  連絡ツール（任意）
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.contactType}
                    onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {contactTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={formData.contactUrl}
                    onChange={(e) => setFormData({ ...formData, contactUrl: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={!formData.contactType}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  報告書生成後、このURLをワンクリックで開けます
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  カラー
                </label>
                <div className="flex gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color.value
                          ? 'border-gray-900 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingClient ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              クライアントを削除しますか？
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              この操作は取り消せません。録画データは削除されません。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
