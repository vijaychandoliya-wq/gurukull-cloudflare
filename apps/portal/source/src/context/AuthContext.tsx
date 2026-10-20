import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { apiClient, API, TOKEN_KEY, SCHOOL_CODE_KEY, clearPortalSession } from '../services/api';

export type RoleType =
  | 'superadmin'
  | 'sitesubadmin'
  | 'schooladmin'
  | 'schoolsubadmin'
  | 'principal'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'librarian'
  | 'alumni'
  | 'receptionist'
  | 'accountant'
  | 'stockkeeper'
  | 'nonteaching'
  | 'staff';

export interface UserProfile {
  id: string | number;
  name: string;
  email: string | null;
  mobile: string | null;
  avatar?: string;
  usergroupId: number | null;
  designation: string | null;
  roles: RoleType[];
}

interface AuthContextType {
  user: UserProfile | null;
  schoolCode: string | null;
  schoolName: string | null;
  academicYear: string | null;
  schoolLogo: string | null;
  refreshSchool: () => Promise<void>;
  isAuthenticated: boolean;
  login: (schoolCode: string, identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: RoleType[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_KEY = 'gurukul_user';

function readStoredUser(): UserProfile | null {
  try {
    if (!localStorage.getItem(TOKEN_KEY) || !localStorage.getItem(SCHOOL_CODE_KEY)) {
      clearPortalSession();
      return null;
    }
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session is restored from the last successful login only. The previous
  // implementation seeded a hardcoded "Dr. Rajesh Sharma" principal, so the
  // app always rendered as an authenticated admin and no login was possible.
  const [user, setUser] = useState<UserProfile | null>(readStoredUser);
  const [schoolCode, setSchoolCode] = useState<string | null>(
    () => localStorage.getItem(SCHOOL_CODE_KEY)
  );
  const [school, setSchool] = useState<{ name: string | null; academicYear: string | null; logo: string | null }>(
    () => {
      try {
        return JSON.parse(localStorage.getItem('gurukul_school') || 'null') ?? { name: null, academicYear: null, logo: null };
      } catch {
        return { name: null, academicYear: null, logo: null };
      }
    }
  );

  const login = useCallback(
    async (code: string, identifier: string, password: string) => {
      const normalisedCode = code.trim().toUpperCase();

      // A new sign-in cannot inherit the previous actor's profile or school branding.
      clearPortalSession();
      setUser(null);
      setSchoolCode(null);
      setSchool({ name: null, academicYear: null, logo: null });

      // Set before the call so the request interceptor can resolve the tenant.
      localStorage.setItem(SCHOOL_CODE_KEY, normalisedCode);

      try {
        const response = await apiClient.post(API.portalLogin, {
          email: identifier.trim(),
          password,
        });

        const { token, user: profile } = response.data;
        if (typeof token !== 'string' || !token || !profile?.id || !Array.isArray(profile.roles)) {
          throw new Error('Login returned an invalid session.');
        }
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(profile));

        setSchoolCode(normalisedCode);
        setUser(profile);
        if(response.data.school){const identity={name:response.data.school.name,academicYear:null,logo:null};setSchool(identity);localStorage.setItem('gurukul_school',JSON.stringify(identity));}

        // School identity for the sidebar header. Best-effort: a failure here
        // must not block a successful sign-in.
        try {
          const opts = await apiClient.get(API.idCardOptionsApi);
          const s = opts.data.data.school;
          const info = { name: s.name ?? null, academicYear: s.academicYear ?? null, logo: s.logo ?? null };
          localStorage.setItem('gurukul_school', JSON.stringify(info));
          setSchool(info);
        } catch {
          // Sidebar falls back to the generic product name.
        }
      } catch (error) {
        clearPortalSession();
        setUser(null);
        throw error;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post(API.logout);
    } catch {
      // Server-side revocation is best-effort; clear locally regardless.
    }
    clearPortalSession();
    setUser(null);
    setSchoolCode(null);
    setSchool({ name: null, academicYear: null, logo: null });
  }, []);

  /** Re-reads school identity so a logo change shows without signing out. */
  const refreshSchool = useCallback(async () => {
    try {
      const res = await apiClient.get(API.idCardOptionsApi);
      const s = res.data.data.school;
      const info = { name: s.name ?? null, academicYear: s.academicYear ?? null, logo: s.logo ?? null };
      localStorage.setItem('gurukul_school', JSON.stringify(info));
      setSchool(info);
    } catch {
      // Leave the cached values in place.
    }
  }, []);

  const hasRole = useCallback(
    (...roles: RoleType[]) => !!user && roles.some((r) => user.roles?.includes(r)),
    [user]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      schoolCode,
      schoolName: school.name,
      academicYear: school.academicYear,
      schoolLogo: school.logo,
      refreshSchool,
      isAuthenticated: !!user && !!localStorage.getItem(TOKEN_KEY),
      login,
      logout,
      hasRole,
    }),
    [user, schoolCode, school, login, logout, hasRole, refreshSchool]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
