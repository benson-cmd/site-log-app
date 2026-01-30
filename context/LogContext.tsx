import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Platform } from 'react-native';
import { db } from '../src/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

export interface MachineItem {
  id: string;
  name: string;           // 機具名稱
  quantity: number;       // 數量
  note?: string;          // 備註 (例如：進場時間)
}

export interface LaborItem {
  id: string;
  type: string;           // 工種/公司
  count: number;          // 人數
  work?: string;          // 工作內容
}

export interface LogEntry {
  id: string;
  date: string;
  project: string;
  projectId?: string;      // 新增 projectId 以便關聯
  weather: string;
  content: string;        // 施工項目
  machines?: MachineItem[];    // 機具列表
  labor?: LaborItem[];         // 人力列表
  plannedProgress?: number;
  reporter: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  photos?: string[];
  notes?: string;         // 新增備註欄位
  reporterId?: string;    // 新增提交者 ID 用於權限控管
  actualProgress?: string | number; // 實際累計進度
}

interface LogContextType {
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id'>) => Promise<void>;
  updateLog: (id: string, data: Partial<LogEntry>) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  uploadPhoto: (uri: string) => Promise<string>;
}

const LogContext = createContext<LogContextType | null>(null);

export const LogProvider = ({ children }: { children: ReactNode }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const q = query(collection(db, "logs"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: LogEntry[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as LogEntry);
      });
      setLogs(list);
    });

    return () => unsubscribe();
  }, []);

  const uploadPhoto = async (photoUri: any): Promise<string> => {
    try {
      // 確保拿到的是純網址字串或原始檔案 (手術級脫殼)
      const fileToUpload = photoUri?.uri || photoUri;

      const formData = new FormData();

      // [手術級修正] Web 端絕對不可使用 { uri: ... } 包裝，直接使用網址字串
      if (Platform.OS === 'web') {
        formData.append('file', fileToUpload);
      } else {
        // React Native 環境處理
        // @ts-ignore
        formData.append('file', {
          uri: fileToUpload,
          type: 'image/jpeg',
          name: 'upload.jpg'
        });
      }

      // 硬編碼 Cloudinary 設定
      formData.append('upload_preset', 'ml_default');

      const response = await fetch('https://api.cloudinary.com/v1_1/df8uaeazt/image/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.secure_url) {
        return data.secure_url;
      } else {
        const errorDetail = data.error?.message || JSON.stringify(data);
        console.error("[Cloudinary] 上傳失敗:", errorDetail);
        throw new Error(`Cloudinary 錯誤: ${errorDetail}`);
      }
    } catch (e: any) {
      console.error(`[Cloudinary] 處理異常:`, e);
      throw e;
    }
  };

  const addLog = async (log: Omit<LogEntry, 'id'>) => {
    try {
      await addDoc(collection(db, "logs"), {
        ...log,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error adding log: ", e);
      throw e;
    }
  };

  const updateLog = async (id: string, data: Partial<LogEntry>) => {
    try {
      const docRef = doc(db, "logs", id);
      await updateDoc(docRef, data);
    } catch (e) {
      console.error("Error updating log: ", e);
      throw e;
    }
  };

  const deleteLog = async (id: string) => {
    try {
      await deleteDoc(doc(db, "logs", id));
    } catch (e) {
      console.error("Error deleting log: ", e);
    }
  };

  return (
    <LogContext.Provider value={{ logs, addLog, updateLog, deleteLog, uploadPhoto }}>
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