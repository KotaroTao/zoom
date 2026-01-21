'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Star,
  Eye,
  Loader2,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, ReportTemplate } from '@/lib/api';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // モーダル状態
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    isDefault: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates(true);
      setTemplates(data.templates);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      setError('テンプレートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleNew = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      content: getDefaultTemplateContent(),
      isDefault: false,
    });
    setShowEditor(true);
  };

  const handleEdit = (template: ReportTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      content: template.content,
      isDefault: template.isDefault,
    });
    setShowEditor(true);
  };

  const handlePreview = async () => {
    try {
      const data = await api.previewTemplate(formData.content);
      setPreviewContent(data.preview);
      setShowPreview(true);
    } catch (err) {
      console.error('Preview error:', err);
      setError('プレビューの生成に失敗しました');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      setError('テンプレート名と本文は必須です');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, {
          name: formData.name,
          description: formData.description || undefined,
          content: formData.content,
          isDefault: formData.isDefault,
        });
      } else {
        await api.createTemplate({
          name: formData.name,
          description: formData.description || undefined,
          content: formData.content,
          isDefault: formData.isDefault,
        });
      }
      setShowEditor(false);
      await fetchTemplates();
    } catch (err) {
      console.error('Save error:', err);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);

    try {
      await api.deleteTemplate(id);
      setShowDeleteConfirm(null);
      await fetchTemplates();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '削除に失敗しました';
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (template: ReportTemplate) => {
    try {
      await api.updateTemplate(template.id, { isDefault: true });
      await fetchTemplates();
    } catch (err) {
      console.error('Set default error:', err);
      setError('デフォルト設定に失敗しました');
    }
  };

  const handleDuplicate = (template: ReportTemplate) => {
    setEditingTemplate(null);
    setFormData({
      name: `${template.name} (コピー)`,
      description: template.description || '',
      content: template.content,
      isDefault: false,
    });
    setShowEditor(true);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">レポートテンプレート</h1>
            <p className="text-gray-500 mt-1">クライアント向け報告書のテンプレートを管理</p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
          >
            <Plus className="h-4 w-4" />
            新規作成
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* テンプレート一覧 */}
        <div className="card">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">テンプレートがありません</p>
              <button
                onClick={handleNew}
                className="text-primary-600 hover:text-primary-700"
              >
                テンプレートを作成
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-4 hover:bg-gray-50 ${!template.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {template.name}
                        </h3>
                        {template.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
                            <Star className="h-3 w-3" />
                            デフォルト
                          </span>
                        )}
                        {!template.isActive && (
                          <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                            無効
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="mt-1 text-sm text-gray-500">{template.description}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        更新日: {new Date(template.updatedAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {!template.isDefault && template.isActive && (
                        <button
                          onClick={() => handleSetDefault(template)}
                          className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-gray-100 rounded-lg"
                          title="デフォルトに設定"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="複製"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                        title="編集"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {!template.isDefault && (
                        <button
                          onClick={() => setShowDeleteConfirm(template.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg"
                          title="削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 利用可能な変数 */}
        <div className="mt-8 card">
          <div className="card-body">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">利用可能な変数</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
              {[
                { var: '{{date}}', desc: '日付（例: 2024年1月15日）' },
                { var: '{{time}}', desc: '時刻（例: 14:00）' },
                { var: '{{datetime}}', desc: '日時' },
                { var: '{{clientName}}', desc: 'クライアント名' },
                { var: '{{title}}', desc: 'ミーティングタイトル' },
                { var: '{{summary}}', desc: '概要' },
                { var: '{{discussions}}', desc: '議論内容（箇条書き）' },
                { var: '{{decisions}}', desc: '決定事項（箇条書き）' },
                { var: '{{actionItems}}', desc: 'アクションアイテム' },
                { var: '{{nextSteps}}', desc: '次回に向けて' },
                { var: '{{youtubeUrl}}', desc: 'YouTube URL' },
                { var: '{{duration}}', desc: '所要時間（分）' },
              ].map(({ var: v, desc }) => (
                <div key={v} className="p-2 bg-gray-50 rounded">
                  <code className="text-primary-600 font-mono text-xs">{v}</code>
                  <p className="text-gray-500 text-xs mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 編集モーダル */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTemplate ? 'テンプレートを編集' : '新規テンプレート'}
              </h3>
              <button
                onClick={() => setShowEditor(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    テンプレート名 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="例: 標準報告テンプレート"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="例: 一般的なミーティング報告に適したテンプレート"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  テンプレート本文 *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={15}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                  placeholder="テンプレート本文を入力..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isDefault" className="text-sm text-gray-700">
                  デフォルトテンプレートに設定
                </label>
              </div>
            </div>
            <div className="flex justify-between gap-2 p-4 border-t">
              <button
                onClick={handlePreview}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                プレビュー
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim() || !formData.content.trim()}
                  className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* プレビューモーダル */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">プレビュー</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                {previewContent}
              </pre>
            </div>
            <div className="flex justify-end p-4 border-t">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                テンプレートを削除
              </h3>
              <p className="text-gray-500">
                このテンプレートを削除してもよろしいですか？この操作は取り消せません。
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// デフォルトのテンプレート内容
function getDefaultTemplateContent(): string {
  return `【MTG報告】{{clientName}}様 {{date}}

■ 概要
{{summary}}

■ 主な議論内容
{{discussions}}

■ 決定事項
{{decisions}}

■ 今後のアクション
{{actionItems}}

■ 次回に向けて
{{nextSteps}}

---
録画URL: {{youtubeUrl}}
ミーティング時間: {{duration}}分`;
}
