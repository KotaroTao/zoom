'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Settings,
  UserPlus,
  Crown,
  Shield,
  Eye,
  MoreVertical,
  Loader2,
  X,
  Check,
  Copy,
  Trash2,
  LogOut,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api } from '@/lib/api';

interface OrganizationMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  members: OrganizationMember[];
  _count?: {
    members: number;
    recordings: number;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

// 役割の表示名とアイコン
const roleConfig = {
  owner: { label: '管理者', icon: Crown, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  admin: { label: '管理者', icon: Crown, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  member: { label: 'メンバー', icon: Shield, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  viewer: { label: '閲覧のみ', icon: Eye, color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // モーダル状態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  // フォーム状態
  const [newOrgName, setNewOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  // 招待リスト
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);

  // 招待リンク
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // 組織一覧を取得
  const fetchOrganizations = async () => {
    try {
      const data = await api.getOrganizations();
      setOrganizations(data.organizations as unknown as Organization[]);
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
      setError('組織の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // 組織を作成
  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      await api.createOrganization(newOrgName.trim());
      setNewOrgName('');
      setShowCreateModal(false);
      await fetchOrganizations();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '組織の作成に失敗しました';
      setError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  // メンバーを招待
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedOrg) return;

    setInviting(true);
    setError(null);

    try {
      const result = await fetch(`/zoom/api/organizations/${selectedOrg.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error || '招待に失敗しました');
      }

      // 招待リンクを表示
      if (data.inviteLink) {
        setInviteLink(data.inviteLink);
      }

      setInviteEmail('');
      // 招待リストを再取得
      await fetchInvitations(selectedOrg.id);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '招待に失敗しました';
      setError(errorMessage);
    } finally {
      setInviting(false);
    }
  };

  // 招待リストを取得
  const fetchInvitations = async (orgId: string) => {
    setLoadingInvitations(true);
    try {
      const result = await fetch(`/zoom/api/organizations/${orgId}/invitations`, {
        credentials: 'include',
      });
      const data = await result.json();
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    } finally {
      setLoadingInvitations(false);
    }
  };

  // メンバーモーダルを開く
  const handleOpenMembers = async (org: Organization) => {
    setSelectedOrg(org);
    setShowMembersModal(true);
    await fetchInvitations(org.id);
  };

  // 招待モーダルを開く
  const handleOpenInvite = (org: Organization) => {
    setSelectedOrg(org);
    setInviteEmail('');
    setInviteRole('member');
    setInviteLink(null);
    setShowInviteModal(true);
  };

  // 招待リンクをコピー
  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // メンバーの役割を変更
  const handleChangeRole = async (memberId: string, newRole: string) => {
    if (!selectedOrg) return;

    try {
      const result = await fetch(`/zoom/api/organizations/${selectedOrg.id}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });

      if (!result.ok) {
        const data = await result.json();
        throw new Error(data.error || '役割の変更に失敗しました');
      }

      // 組織一覧を再取得
      await fetchOrganizations();
      // 選択中の組織を更新
      const updatedOrgs = await api.getOrganizations();
      const updatedOrg = (updatedOrgs.organizations as unknown as Organization[]).find(o => o.id === selectedOrg.id);
      if (updatedOrg) {
        setSelectedOrg(updatedOrg);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '役割の変更に失敗しました';
      setError(errorMessage);
    }
  };

  // メンバーを削除
  const handleRemoveMember = async (memberId: string) => {
    if (!selectedOrg) return;

    if (!confirm('このメンバーを組織から削除しますか？')) return;

    try {
      const result = await fetch(`/zoom/api/organizations/${selectedOrg.id}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!result.ok) {
        const data = await result.json();
        throw new Error(data.error || 'メンバーの削除に失敗しました');
      }

      // 組織一覧を再取得
      await fetchOrganizations();
      // 選択中の組織を更新
      const updatedOrgs = await api.getOrganizations();
      const updatedOrg = (updatedOrgs.organizations as unknown as Organization[]).find(o => o.id === selectedOrg.id);
      if (updatedOrg) {
        setSelectedOrg(updatedOrg);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'メンバーの削除に失敗しました';
      setError(errorMessage);
    }
  };

  // 招待をキャンセル
  const handleCancelInvitation = async (invitationId: string) => {
    if (!selectedOrg) return;

    try {
      const result = await fetch(`/zoom/api/organizations/${selectedOrg.id}/invitations/${invitationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!result.ok) {
        const data = await result.json();
        throw new Error(data.error || '招待のキャンセルに失敗しました');
      }

      await fetchInvitations(selectedOrg.id);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '招待のキャンセルに失敗しました';
      setError(errorMessage);
    }
  };

  // 組織から脱退
  const handleLeaveOrg = async (orgId: string) => {
    if (!confirm('この組織から脱退しますか？')) return;

    try {
      const result = await fetch(`/zoom/api/organizations/${orgId}/leave`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!result.ok) {
        const data = await result.json();
        throw new Error(data.error || '脱退に失敗しました');
      }

      await fetchOrganizations();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '脱退に失敗しました';
      setError(errorMessage);
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
      <div className="p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">組織・チーム</h1>
            <p className="text-gray-500 mt-1">組織を管理してメンバーと録画を共有</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            新規作成
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
              <X className="h-4 w-4 inline" />
            </button>
          </div>
        )}

        {/* 組織リスト */}
        {organizations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-2">まだ組織がありません</p>
            <p className="text-sm text-gray-500 mb-4">
              組織を作成してチームメンバーと録画を共有しましょう
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              組織を作成
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => {
              const myMembership = org.members?.find(m => m.userId === m.user?.id);
              const isAdmin = myMembership?.role === 'owner' || myMembership?.role === 'admin';

              return (
                <div key={org.id} className="card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{org.name}</h3>
                        <p className="text-xs text-gray-500">
                          {org._count?.members || org.members?.length || 0}人のメンバー
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        onClick={() => handleOpenMembers(org)}
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* メンバーアバター */}
                  <div className="flex items-center gap-1 mb-4">
                    {org.members?.slice(0, 5).map((member) => (
                      <div
                        key={member.id}
                        className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600"
                        title={member.user?.name || member.user?.email}
                      >
                        {(member.user?.name || member.user?.email || '?')[0].toUpperCase()}
                      </div>
                    ))}
                    {(org.members?.length || 0) > 5 && (
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-500">
                        +{(org.members?.length || 0) - 5}
                      </div>
                    )}
                  </div>

                  {/* アクションボタン */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenInvite(org)}
                      className="flex-1 px-3 py-2 text-sm bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center gap-1"
                    >
                      <UserPlus className="h-4 w-4" />
                      招待
                    </button>
                    <button
                      onClick={() => handleOpenMembers(org)}
                      className="flex-1 px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center gap-1"
                    >
                      <Users className="h-4 w-4" />
                      メンバー
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 組織作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">新しい組織を作成</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                組織名
              </label>
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="例: チームA、営業部"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500">
                組織を作成すると、メンバーを招待して録画を共有できます
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateOrg}
                disabled={creating || !newOrgName.trim()}
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メンバー招待モーダル */}
      {showInviteModal && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedOrg.name} にメンバーを招待
              </h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteLink(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  役割
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="admin">管理者 - 全権限</option>
                  <option value="member">メンバー - 一部操作可能</option>
                  <option value="viewer">閲覧のみ - 操作不可</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {inviteRole === 'admin' && '設定変更、メンバー招待など全ての操作が可能'}
                  {inviteRole === 'member' && '録画の閲覧、編集が可能（設定変更不可）'}
                  {inviteRole === 'viewer' && '録画の閲覧のみ可能'}
                </p>
              </div>

              {/* 招待リンク表示 */}
              {inviteLink && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 mb-2">招待リンクが生成されました</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="flex-1 text-xs bg-white border border-green-300 rounded px-2 py-1"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1"
                    >
                      {copiedLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedLink ? 'コピー済み' : 'コピー'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteLink(null);
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                閉じる
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                招待を送信
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メンバー管理モーダル */}
      {showMembersModal && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedOrg.name} のメンバー
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {/* メンバーリスト */}
              <div className="space-y-2 mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  メンバー（{selectedOrg.members?.length || 0}人）
                </h4>
                {selectedOrg.members?.map((member) => {
                  const config = roleConfig[member.role as keyof typeof roleConfig] || roleConfig.member;
                  const RoleIcon = config.icon;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                          {(member.user?.name || member.user?.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.user?.name || member.user?.email}
                          </p>
                          <p className="text-xs text-gray-500">{member.user?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.id, e.target.value)}
                          disabled={member.role === 'owner'}
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1 disabled:opacity-50"
                        >
                          <option value="admin">管理者</option>
                          <option value="member">メンバー</option>
                          <option value="viewer">閲覧のみ</option>
                        </select>
                        {member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1 text-red-500 hover:text-red-700 rounded"
                            title="削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 保留中の招待 */}
              {loadingInvitations ? (
                <div className="text-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                </div>
              ) : invitations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    保留中の招待（{invitations.length}件）
                  </h4>
                  <div className="space-y-2">
                    {invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm text-gray-900">{invitation.email}</p>
                          <p className="text-xs text-gray-500">
                            {roleConfig[invitation.role as keyof typeof roleConfig]?.label || invitation.role}
                            {' • '}
                            {new Date(invitation.expiresAt) > new Date()
                              ? `${Math.ceil((new Date(invitation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}日後に期限切れ`
                              : '期限切れ'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          キャンセル
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between p-4 border-t">
              <button
                onClick={() => handleLeaveOrg(selectedOrg.id)}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
              >
                <LogOut className="h-4 w-4" />
                組織から脱退
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenInvite(selectedOrg)}
                  className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  メンバーを招待
                </button>
                <button
                  onClick={() => setShowMembersModal(false)}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
