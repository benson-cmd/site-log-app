import React, { createContext, useState, useContext } from 'react';

type User = { email: string; role: 'admin' | 'user'; };

type UserContextType = {
  user: User | null;
  isLoading: boolean; // 新增這個
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    setTimeout(() => {
      const role = (email === 'admin' || email.includes('admin')) ? 'admin' : 'user';
      setUser({ email, role });
      setIsLoading(false);
    }, 500);
  };

  const logout = () => { setUser(null); };

  return (
    <UserContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser error');
  return context;
};