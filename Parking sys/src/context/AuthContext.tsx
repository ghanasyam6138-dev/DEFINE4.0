import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Role } from '../types';
import { authService } from '../services/authService';
import { dbService } from '../services/dbService';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isCustomer: boolean;
  isStaff: boolean;
  isApprovedStaff: boolean;
  isPendingStaff: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  isLoading: boolean;
  login: (mobile: string, pass: string) => Promise<{ success: boolean; error?: string; isPendingApproval?: boolean; role?: Role }>;
  register: (name: string, mobile: string, pass: string, confirm: string) => Promise<{ success: boolean; error?: string }>;
  requestStaffAccess: (name: string, mobile: string, pass: string, parkingAreaId: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  quickSwitchDemo: (rolePreset: 'customer' | 'staff_approved' | 'staff_pending' | 'parking_admin') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(() => {
    const sessionUser = authService.getCurrentSession();
    if (sessionUser) {
      const fresh = dbService.getUserById(sessionUser.id);
      if (fresh) {
        setUser(fresh);
        authService.setCurrentSession(fresh);
      } else {
        setUser(sessionUser);
      }
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Initialize DB and auth session
    dbService.initialize().then(() => {
      refreshUser();
      setIsLoading(false);
    });

    // Listen to changes in DB
    const unsubscribe = dbService.subscribe(() => {
      refreshUser();
    });

    return unsubscribe;
  }, [refreshUser]);

  const login = async (mobile: string, pass: string) => {
    setIsLoading(true);
    const result = await authService.login({ mobile, password: pass });
    setIsLoading(false);
    if (result.success && result.user) {
      setUser(result.user);
      return { success: true, isPendingApproval: result.isPendingApproval, role: result.user.role };
    }
    return { success: false, error: result.error, isPendingApproval: result.isPendingApproval };
  };

  const register = async (name: string, mobile: string, pass: string, confirm: string) => {
    setIsLoading(true);
    const result = await authService.register({ name, mobile, password: pass, confirmPassword: confirm });
    setIsLoading(false);
    if (result.success && result.user) {
      setUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const requestStaffAccess = async (name: string, mobile: string, pass: string, parkingAreaId: string, notes?: string) => {
    setIsLoading(true);
    const result = await authService.requestStaffAccess({ name, mobile, password: pass, parkingAreaId, requestedNotes: notes });
    setIsLoading(false);
    if (result.success && result.user) {
      setUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const quickSwitchDemo = async (rolePreset: 'customer' | 'staff_approved' | 'staff_pending' | 'parking_admin') => {
    const mobiles: Record<string, string> = {
      customer: '+919876543214',
      staff_approved: '+919876543212',
      staff_pending: '+919876543213',
      parking_admin: '+919876543211'
    };
    const mobile = mobiles[rolePreset];
    const targetUser = dbService.getUserByMobile(mobile);
    if (targetUser) {
      authService.setCurrentSession(targetUser);
      setUser(targetUser);
    }
  };

  const role = user?.role || null;
  const isAuthenticated = !!user;
  const isCustomer = role === 'customer';
  const isStaff = role === 'staff';
  const isApprovedStaff = isStaff && user?.status === 'active';
  const isPendingStaff = isStaff && user?.status === 'pending_approval';
  const isAdmin = role === 'parking_admin' || role === 'platform_admin';
  const isPlatformAdmin = role === 'platform_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isCustomer,
        isStaff,
        isApprovedStaff,
        isPendingStaff,
        isAdmin,
        isPlatformAdmin,
        isLoading,
        login,
        register,
        requestStaffAccess,
        logout,
        quickSwitchDemo
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
