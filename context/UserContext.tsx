import React, { createContext, useState, useContext, ReactNode } from 'react';
import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// 定義 User 型別
export interface User {
  email: string;
  role?: string; // 職稱
  name?: string;
  department?: string;
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

      // 1. Hardcoded Backup Account
      if (email === 'wu@dwcc.com.tw' && pass === '0720117') {
        setUser({
          email: 'wu@dwcc.com.tw',
          name: '吳資彬', // Backup Name
          role: '系統管理員(備援)',
          department: '總經理室'
        });
        return true;
      }

      // 2. Firestore Verification
      const q = query(collection(db, "personnel"), where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return false;
      }

      const docSnapshot = querySnapshot.docs[0];
      const userData = docSnapshot.data();

      // Password Check: 
      // 1. If user has a custom password, they MUST use it.
      // 2. If no custom password, they use initialPassword.
      let validPwd = false;
      if (userData.password) {
        validPwd = userData.password === pass;
      } else {
        validPwd = userData.initialPassword === pass;
      }

      if (validPwd) {
        setUser({
          email: userData.email,
          name: userData.name,
          role: userData.title || '員工',
          department: userData.department
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