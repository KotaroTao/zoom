'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  teams: Team[];
  currentTeam: Team | null;
  setCurrentOrg: (org: Organization | null) => void;
  setCurrentTeam: (team: Team | null) => void;
  loading: boolean;
  refreshOrganizations: () => Promise<void>;
  refreshTeams: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOrganizations = async () => {
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

  const refreshTeams = async () => {
    if (!currentOrg) {
      setTeams([]);
      return;
    }
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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await refreshOrganizations();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (currentOrg) {
      refreshTeams();
    }
  }, [currentOrg]);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        teams,
        currentTeam,
        setCurrentOrg,
        setCurrentTeam,
        loading,
        refreshOrganizations,
        refreshTeams,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
