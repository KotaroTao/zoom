'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import {
  Building2,
  Users,
  Plus,
  Settings,
  ChevronRight,
  RefreshCw,
  Crown,
  Shield,
  User,
  Eye,
  Mail,
  Copy,
  Check,
  X,
  UserPlus,
  Trash2,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
  memberCount: number;
  recordingCount: number;
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isDefault: boolean;
  memberCount: number;
  recordingCount: number;
  myRole: string | null;
  createdAt: string;
}

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  joinedAt: string;
}

const roleLabels: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  owner: { label: 'オーナー', icon: Crown, color: 'text-yellow-600 bg-yellow-50' },
  admin: { label: '管理者', icon: Shield, color: 'text-blue-600 bg-blue-50' },
  member: { label: 'メンバー', icon: User, color: 'text-green-600 bg-green-50' },
  viewer: { label: '閲覧のみ', icon: Eye, color: 'text-gray-600 bg-gray-50' },
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'teams' | 'members'>('teams');

  // モーダル状態
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [creating, setCreating] = useState(false);

  // 組織一覧を取得
  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations);
        if (data.organizations.length > 0 && !selectedOrg) {
          setSelectedOrg(data.organizations[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  // チーム一覧を取得
  const fetchTeams = async () => {
    if (!selectedOrg) return;
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  // メンバー一覧を取得
  const fetchMembers = async () => {
    if (!selectedOrg) return;
    try {
      const res = await fetch('/api/organizations/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchTeams();
      fetchMembers();
    }
  }, [selectedOrg]);

  // 組織作成
  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewOrgName('');
        setShowCreateOrg(false);
        await fetchOrganizations();
      } else {
        alert(`組織作成エラー: ${data.error || res.statusText}`);
      }
    } catch (error) {
      console.error('Failed to create organization:', error);
      alert('組織の作成に失敗しました。ネットワーク接続を確認してください。');
    } finally {
      setCreating(false);
    }
  };

  // チーム作成
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName,
          description: newTeamDescription || null,
        }),
      });
      if (res.ok) {
        setNewTeamName('');
        setNewTeamDescription('');
        setShowCreateTeam(false);
        await fetchTeams();
      }
    } catch (error) {
      console.error('Failed to create team:', error);
    } finally {
      setCreating(false);
    }
  };

  // メンバー招待
  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/organizations/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      if (res.ok) {
        setInviteEmail('');
        setInviteRole('member');
        setShowInviteMember(false);
        // 成功メッセージを表示
        alert('招待メールを送信しました');
      }
    } catch (error) {
      console.error('Failed to invite member:', error);
    } finally {
      setCreating(false);
    }
  };

  const isAdmin = selectedOrg && ['owner', 'admin'].includes(selectedOrg.role);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>読み込み中...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">組織・チーム</h1>
            <p className="text-gray-500 mt-1">組織とチームの管理</p>
          </div>
          <button
            onClick={() => setShowCreateOrg(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新しい組織を作成
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 組織一覧（左サイドバー） */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">組織一覧</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => setSelectedOrg(org)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedOrg?.id === org.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{org.name}</p>
                          <p className="text-sm text-gray-500">{org.memberCount}人</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div className="lg:col-span-3">
            {selectedOrg ? (
              <div className="bg-white rounded-lg shadow">
                {/* 組織ヘッダー */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-primary-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedOrg.name}</h2>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleLabels[selectedOrg.role].color}`}>
                            {(() => {
                              const RoleIcon = roleLabels[selectedOrg.role].icon;
                              return <RoleIcon className="w-3 h-3" />;
                            })()}
                            {roleLabels[selectedOrg.role].label}
                          </span>
                          <span className="text-sm text-gray-500">
                            メンバー {selectedOrg.memberCount}人 ・ 録画 {selectedOrg.recordingCount}件
                          </span>
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Settings className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* タブ */}
                <div className="border-b border-gray-200">
                  <nav className="flex -mb-px">
                    <button
                      onClick={() => setActiveTab('teams')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'teams'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      チーム ({teams.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('members')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'members'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      メンバー ({members.length})
                    </button>
                  </nav>
                </div>

                {/* タブコンテンツ */}
                <div className="p-6">
                  {activeTab === 'teams' && (
                    <div>
                      {isAdmin && (
                        <div className="mb-4">
                          <button
                            onClick={() => setShowCreateTeam(true)}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            新しいチームを作成
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {teams.map((team) => (
                          <div
                            key={team.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: `${team.color}20` }}
                                >
                                  <Users className="w-5 h-5" style={{ color: team.color || '#3B82F6' }} />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {team.name}
                                    {team.isDefault && (
                                      <span className="ml-2 text-xs text-gray-500">(デフォルト)</span>
                                    )}
                                  </p>
                                  {team.description && (
                                    <p className="text-sm text-gray-500 mt-0.5">{team.description}</p>
                                  )}
                                </div>
                              </div>
                              {team.myRole && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleLabels[team.myRole]?.color || 'text-gray-600 bg-gray-50'}`}>
                                  {roleLabels[team.myRole]?.label || team.myRole}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {team.memberCount}人
                              </span>
                              <span>録画 {team.recordingCount}件</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'members' && (
                    <div>
                      {isAdmin && (
                        <div className="mb-4">
                          <button
                            onClick={() => setShowInviteMember(true)}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <UserPlus className="w-4 h-4" />
                            メンバーを招待
                          </button>
                        </div>
                      )}
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                {member.image ? (
                                  <img src={member.image} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                  <User className="w-5 h-5 text-gray-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {member.name || member.email}
                                </p>
                                <p className="text-sm text-gray-500">{member.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleLabels[member.role].color}`}>
                                {(() => {
                                  const RoleIcon = roleLabels[member.role].icon;
                                  return <RoleIcon className="w-3 h-3" />;
                                })()}
                                {roleLabels[member.role].label}
                              </span>
                              {isAdmin && member.role !== 'owner' && (
                                <button className="p-1 text-gray-400 hover:text-red-500">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">組織を選択してください</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 組織作成モーダル */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">新しい組織を作成</h3>
              <button onClick={() => setShowCreateOrg(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">組織名</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="株式会社○○"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateOrg(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreateOrg}
                  disabled={creating || !newOrgName.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* チーム作成モーダル */}
      {showCreateTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">新しいチームを作成</h3>
              <button onClick={() => setShowCreateTeam(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">チーム名</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="営業部"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明（任意）</label>
                <input
                  type="text"
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="チームの説明"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateTeam(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreateTeam}
                  disabled={creating || !newTeamName.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メンバー招待モーダル */}
      {showInviteMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">メンバーを招待</h3>
              <button onClick={() => setShowInviteMember(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="admin">管理者 - 設定変更・メンバー招待可能</option>
                  <option value="member">メンバー - 録画の閲覧・管理</option>
                  <option value="viewer">閲覧のみ - 録画の閲覧のみ</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowInviteMember(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleInviteMember}
                  disabled={creating || !inviteEmail.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? '送信中...' : '招待を送信'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
