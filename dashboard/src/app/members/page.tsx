'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users,
  UserPlus,
  Loader2,
  MoreVertical,
  Shield,
  Trash2,
  Mail,
  Crown,
  UserCog,
  User,
  Eye,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, Member } from '@/lib/api';
import {
  getRoleLabel,
  getRoleColor,
  isAdmin,
  getAllRoles,
  ROLES,
} from '@/lib/permissions-client';

// 役割アイコン
function RoleIcon({ role }: { role: string }) {
  switch (role) {
    case 'owner':
      return <Crown className="h-4 w-4" />;
    case 'admin':
      return <Shield className="h-4 w-4" />;
    case 'member':
      return <UserCog className="h-4 w-4" />;
    case 'viewer':
      return <Eye className="h-4 w-4" />;
    default:
      return <User className="h-4 w-4" />;
  }
}

export default function MembersPage() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [roleChangeModal, setRoleChangeModal] = useState<{
    member: Member;
    newRole: string;
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<Member | null>(null);
  const [processing, setProcessing] = useState(false);

  const myRole = session?.user?.role;
  const canManageMembers = isAdmin(myRole);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await api.getMembers();
      setMembers(data.members);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setError('メンバーの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeModal) return;

    setProcessing(true);
    try {
      await api.updateMemberRole(roleChangeModal.member.id, roleChangeModal.newRole);
      await fetchMembers();
      setRoleChangeModal(null);
    } catch (err) {
      console.error('Failed to update role:', err);
      alert('役割の変更に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;

    setProcessing(true);
    try {
      await api.removeMember(deleteModal.id);
      await fetchMembers();
      setDeleteModal(null);
    } catch (err) {
      console.error('Failed to remove member:', err);
      alert('メンバーの削除に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  // 自分より下位の役割のみ変更可能
  const canModifyMember = (member: Member) => {
    if (!canManageMembers) return false;
    if (member.userId === session?.user?.id) return false;
    if (member.role === 'owner') return false;
    if (myRole === 'admin' && member.role === 'admin') return false;
    return true;
  };

  // 割り当て可能な役割
  const getAssignableRoles = () => {
    const roles = getAllRoles();
    if (myRole === 'owner') {
      return roles.filter((r) => r.value !== 'owner');
    }
    if (myRole === 'admin') {
      return roles.filter((r) => r.value !== 'owner' && r.value !== 'admin');
    }
    return [];
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-7 w-7" />
              メンバー管理
            </h1>
            <p className="text-gray-500 mt-1">組織のメンバーを管理します</p>
          </div>
          {canManageMembers && (
            <a
              href="/zoom/settings"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              メンバーを招待
            </a>
          )}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* ローディング */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            メンバーがいません
          </div>
        ) : (
          /* メンバー一覧 */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    メンバー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    役割
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    参加日
                  </th>
                  {canManageMembers && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {member.image ? (
                            <img
                              className="h-10 w-10 rounded-full"
                              src={member.image}
                              alt=""
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {member.name || '名前未設定'}
                            {member.userId === session?.user?.id && (
                              <span className="ml-2 text-xs text-gray-500">
                                (あなた)
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role).bg} ${getRoleColor(member.role).text}`}
                      >
                        <RoleIcon role={member.role} />
                        {getRoleLabel(member.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(member.joinedAt).toLocaleDateString('ja-JP')}
                    </td>
                    {canManageMembers && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {canModifyMember(member) && (
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() =>
                                setActionMenuOpen(
                                  actionMenuOpen === member.id ? null : member.id
                                )
                              }
                              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {actionMenuOpen === member.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setActionMenuOpen(null)}
                                />
                                <div className="absolute right-0 z-20 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                                  <div className="py-1">
                                    <button
                                      onClick={() => {
                                        setRoleChangeModal({
                                          member,
                                          newRole: member.role,
                                        });
                                        setActionMenuOpen(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <Shield className="h-4 w-4" />
                                      役割を変更
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeleteModal(member);
                                        setActionMenuOpen(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      メンバーを削除
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 役割の説明 */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">役割について</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {getAllRoles().map((role) => (
              <div
                key={role.value}
                className="border rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(role.value).bg} ${getRoleColor(role.value).text}`}
                  >
                    <RoleIcon role={role.value} />
                    {role.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{role.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 役割変更モーダル */}
      {roleChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setRoleChangeModal(null)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              役割を変更
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {roleChangeModal.member.email} の役割を変更します
            </p>
            <select
              value={roleChangeModal.newRole}
              onChange={(e) =>
                setRoleChangeModal({
                  ...roleChangeModal,
                  newRole: e.target.value,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {getAssignableRoles().map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label} - {role.description}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRoleChangeModal(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleRoleChange}
                disabled={processing || roleChangeModal.newRole === roleChangeModal.member.role}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                変更する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteModal(null)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              メンバーを削除
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{deleteModal.email}</strong> を組織から削除しますか？
              <br />
              この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
