import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface LogEntry {
  id: string;
  date: string;
  project: string;
  weather: string;
  temperature: string;
  content: string;
  reporter: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected'; // 審核狀態
}

interface LogContextType {
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id'>) => void;
  updateLog: (id: string, data: Partial<LogEntry>) => void;
  deleteLog: (id: string) => void;
}

const LogContext = createContext<LogContextType | null>(null);

export const LogProvider = ({ children }: { children: ReactNode }) => {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      date: '2026-01-20',
      project: '台中七期商辦',
      weather: '晴 ☀️',
      temperature: '24°C',
      content: '1. 1F 柱牆鋼筋綁紮查驗\n2. B1F 模板拆除作業',
      reporter: '吳資彬',
      status: 'pending_review' // 待審核
    },
    {
      id: '2',
      date: '2026-01-19',
      project: '台中七期商辦',
      weather: '陰 ☁️',
      temperature: '20°C',
      content: '1. B1F 混凝土澆置養護\n2. 進場材料：鋼筋 50 噸',
      reporter: '陳曉華',
      status: 'approved' // 已簽核
    },
    {
      id: '3',
      date: '2026-01-18',
      project: '高雄亞灣住宅案',
      weather: '雨 🌧️',
      temperature: '18°C',
      content: '1. 暫停戶外吊掛作業\n2. 室內泥作粉刷',
      reporter: '林建國',
      status: 'pending_review' // 待審核
    },
    {
      id: '4',
      date: '2026-01-18',
      project: '桃園青埔物流中心',
      weather: '晴',
      temperature: '22°C',
      content: '1. 整地作業',
      reporter: '張志偉',
      status: 'draft' // 草稿
    },
  ]);

  const addLog = (log: Omit<LogEntry, 'id'>) => {
    const newLog = { ...log, id: Math.random().toString(36).substr(2, 9) };
    setLogs(prev => [newLog, ...prev]);
  };

  const updateLog = (id: string, data: Partial<LogEntry>) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
  };

  const deleteLog = (id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  return (
    <LogContext.Provider value={{ logs, addLog, updateLog, deleteLog }}>
      {children}
    </LogContext.Provider>
  );
};

export const useLogs = () => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLogs must be used within a LogProvider');
  }
  return context;
};