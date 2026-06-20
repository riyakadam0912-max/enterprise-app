'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ApiError } from '@/api/apiClient';

import {
  clearAuthSession,
  setAuthSession,
  useAuthSession,
} from '@/stores/auth-store';

import {
  getCurrentUser,
  loginUser,
  logoutUser,
} from '@/api/authApi';

import type { AuthSession } from '@/stores/auth-store';

export type AuthStatus = {
  session: AuthSession;
  authenticated: boolean;
  loading: boolean;

  login: (
    email: string,
    password: string,
  ) => Promise<void>;

  logout: () => Promise<void>;
};

const AuthContext =
  createContext<AuthStatus | null>(null);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useAuthSession();

  const [loading, setLoading] =
    useState(true);

  const authenticated =
    session.user !== null;



  useEffect(() => {

    let mounted = true;



    async function bootstrapAuth() {

      try {

        console.log(
          '[AuthProvider] Bootstrapping auth...',
        );



        const current =
          await getCurrentUser();



        console.log(
          '[AuthProvider] Current user:',
          current,
        );



        setAuthSession({

          user: current.user,

          role: current.role,

          roles: current.roles,

          permissions: current.permissions,

          employeeId: current.employeeId,

        });

      }

      catch (error) {

        if (

          error instanceof ApiError &&

          error.status === 401

        ) {

          console.log(
            '[AuthProvider] User not authenticated',
          );

          clearAuthSession();

          return;
        }



        console.error(
          '[AuthProvider] bootstrapAuth failed:',
          error,
        );
      }

      finally {

        if (mounted) {

          setLoading(false);

        }

      }
    }



    bootstrapAuth();



    return () => {

      mounted = false;

    };

  }, []);





  const login = useCallback(

    async (

      email: string,

      password: string,

    ) => {

      const data =
        await loginUser(
          email,
          password,
        );



      setAuthSession({

        user: data.user,

        role: data.role,

        roles: data.roles,

        permissions:
          data.permissions,

        employeeId:
          data.employeeId,

      });

    },

    [],

  );





  const logout = useCallback(

    async () => {

      try {

        await logoutUser();

      }

      catch (error) {

        console.error(
          '[AuthProvider] Logout failed:',
          error,
        );

      }

      finally {

        clearAuthSession();

      }

    },

    [],

  );





  const value = useMemo(

    () => ({

      session,

      authenticated,

      loading,

      login,

      logout,

    }),

    [

      session,

      authenticated,

      loading,

      login,

      logout,

    ],

  );





  return (

    <AuthContext.Provider value={value}>

      {children}

    </AuthContext.Provider>

  );
}





export function useAuth() {

  const context =
    useContext(AuthContext);



  if (!context) {

    throw new Error(

      'useAuth must be used within an AuthProvider',

    );

  }



  return context;
}