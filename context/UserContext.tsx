import React, { createContext, useState, useContext, ReactNode } from 'react';

// 定義 User 型別，避免使用 any
interface User {
  email: string;
  role: string;
  name?: string;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      // 模擬 API 請求延遲
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 簡易驗證邏輯
      if (email.trim() && pass.trim()) {
        setUser({ 
          email, 
          role: 'admin',
          name: '吳資彬' // 範例名稱
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};