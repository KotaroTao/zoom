'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { LogOut, User, Loader2, Building2, Users, ChevronDown } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
}

interface Team {
  id: string;
  name: string;
  color: string | null;
  isDefault: boolean;
}

interface DashboardLayoutProps {
  children: ReactNode;
  onOrgChange?: (orgId: string) => void;
  onTeamChange?: (teamId: string | null) => void;
}

export function DashboardLayout({ children, onOrgChange, onTeamChange }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/organizations`);
        if (res.ok) {
          const data = await res.json();
          setOrganizations(data.organizations);
          if (data.organizations.length > 0 && !currentOrg) {
            setCurrentOrg(data.organizations[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      }
    };
    fetchOrganizations();
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      if (!currentOrg) return;
      try {
        const res = await fetch(`${API_BASE}/api/teams`);
        if (res.ok) {
          const data = await res.json();
          setTeams(data.teams);
        }
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      }
    };
    fetchTeams();
  }, [currentOrg]);

  const handleOrgChange = (org: Organization) => {
    setCurrentOrg(org);
    setCurrentTeam(null);
    setShowOrgDropdown(false);
    onOrgChange?.(org.id);
    onTeamChange?.(null);
  };

  const handleTeamChange = (team: Team | null) => {
    setCurrentTeam(team);
    setShowTeamDropdown(false);
    onTeamChange?.(team?.id || null);
  };

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* 組織・チーム選択 */}
            <div className="flex items-center gap-2">
              {/* 組織セレクター */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowOrgDropdown(!showOrgDropdown);
                    setShowTeamDropdown(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {currentOrg?.name || '組織を選択'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </button>
                {showOrgDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      {organizations.map((org) => (
                        <button
                          key={org.id}
                          onClick={() => handleOrgChange(org)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                            currentOrg?.id === org.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                          }`}
                        >
                          <Building2 className="h-4 w-4" />
                          <span className="truncate">{org.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* チームセレクター */}
              {teams.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowTeamDropdown(!showTeamDropdown);
                      setShowOrgDropdown(false);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="hidden sm:inline max-w-[100px] truncate">
                      {currentTeam?.name || '全チーム'}
                    </span>
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                  </button>
                  {showTeamDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="py-1">
                        <button
                          onClick={() => handleTeamChange(null)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                            !currentTeam ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                          }`}
                        >
                          <Users className="h-4 w-4" />
                          <span>全チーム</span>
                        </button>
                        {teams.map((team) => (
                          <button
                            key={team.id}
                            onClick={() => handleTeamChange(team)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                              currentTeam?.id === team.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                            }`}
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: team.color || '#6B7280' }}
                            />
                            <span className="truncate">{team.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ユーザー情報 */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-1" />
                <span>{session?.user?.email}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/zoom/login' })}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">ログアウト</span>
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gray-50" onClick={() => {
          setShowOrgDropdown(false);
          setShowTeamDropdown(false);
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
