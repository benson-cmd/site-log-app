import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// 定義 User 型別
export interface User {
  email: string;
  role?: 'admin' | 'user'; // 權限等級 (admin, user)
  title?: string;          // 職稱
  name?: string;
  department?: string;
  uid?: string;            // Firestore 文件 ID
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
  const [isLoading, setIsLoading] = useState(true);

  // 1. 初始化時檢查 LocalStorage
  useEffect(() => {
    const initializeUser = async () => {
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('dwcc_user_info');
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (e) {
            console.error("Failed to parse user info", e);
            localStorage.removeItem('dwcc_user_info');
          }
        }
      }
      // 重點：檢查完畢後，一定要告訴系統「讀取結束」
      setIsLoading(false);
    };

    initializeUser();
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // 1. Hardcoded Backup Account
      if (email === 'wu@dwcc.com.tw' && pass === '0720117') {
        const adminUser: User = { // 定義物件
          email: 'wu@dwcc.com.tw',
          name: '吳資彬', // Backup Name
          role: 'admin',
          title: '副總',
          department: '總經理室',
          uid: 'admin_backup'
        };
        setUser(adminUser);
        localStorage.setItem('dwcc_user_info', JSON.stringify(adminUser));
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
        const loggedInUser: User = {
          email: userData.email,
          name: userData.name,
          role: userData.role || 'user',
          title: userData.title || '員工',
          department: userData.department,
          uid: docSnapshot.id
        };
        setUser(loggedInUser);
        localStorage.setItem('dwcc_user_info', JSON.stringify(loggedInUser));
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
    localStorage.removeItem('dwcc_user_info');
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