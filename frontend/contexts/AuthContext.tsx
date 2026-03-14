import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import axios from 'axios';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

interface User {
  user_id: string;
  auth0_id?: string;
  email: string;
  name: string;
  profile_photo?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  zip_code?: string;
  followers?: string[];
  following?: string[];
  bio?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  sessionToken: string | null;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  // Handle deep links
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check for initial URL (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => subscription.remove();
  }, []);

  const handleDeepLink = async (url: string) => {
    const sessionId = extractSessionId(url);
    if (sessionId) {
      await exchangeSessionId(sessionId);
    }
  };

  const extractSessionId = (url: string): string | null => {
    const hashMatch = url.match(/#session_id=([^&]+)/);
    if (hashMatch) return hashMatch[1];

    const queryMatch = url.match(/[?&]session_id=([^&]+)/);
    if (queryMatch) return queryMatch[1];

    return null;
  };

  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (token) {
        setSessionToken(token);
        await fetchUserProfile(token);
      }
    } catch (error) {
      console.error('Error checking existing session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      await AsyncStorage.removeItem('session_token');
      setSessionToken(null);
      setUser(null);
    }
  };

  const exchangeSessionId = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/exchange-session`,
        {},
        { headers: { 'X-Session-ID': sessionId } }
      );

      const { session_token, user } = response.data;
      await AsyncStorage.setItem('session_token', session_token);
      setSessionToken(session_token);
      setUser(user);
    } catch (error) {
      console.error('Error exchanging session ID:', error);
      throw new Error('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth Login via Emergent Auth
  const login = useCallback(async () => {
    try {
      const redirectUrl = Platform.OS === 'web'
        ? `${BACKEND_URL}/`
        : Linking.createURL('/');

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}&provider=google`;

      console.log('Auth URL:', authUrl);

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          const sessionId = extractSessionId(result.url);
          if (sessionId) {
            await exchangeSessionId(sessionId);
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Login failed. Please try again.');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (sessionToken) {
        await axios.post(
          `${BACKEND_URL}/api/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('session_token');
      setSessionToken(null);
      setUser(null);
    }
  }, [sessionToken]);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    sessionToken,
    updateUser,
  }), [user, isLoading, sessionToken, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
