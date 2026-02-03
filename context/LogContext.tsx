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
  note?: string;          // 備註
}

export interface LogIssue {
  id: string;
  content: string;
  status: 'pending' | 'resolved';
}

export interface LogEntry {
  id: string;
  date: string;
  project: string;
  projectId?: string;
  weather: string;
  content: string;
  machineList?: MachineItem[];    // 改名
  personnelList?: LaborItem[];    // 改名
  plannedProgress?: number;
  reporter: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'issue';
  photos?: string[];
  issues?: string;           // 統一備註欄位名為 issues (字串)
  issueList?: LogIssue[];    // 原本的列表改名為 issueList
  reporterId?: string;
  actualProgress?: string | number;
}

interface LogContextType {
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id'>) => Promise<void>;
  updateLog: (id: string, data: Partial<LogEntry>) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  uploadPhoto: (uri: string, fileName?: string) => Promise<string>;
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

  const uploadPhoto = async (photoUri: any, fileName?: string): Promise<string> => {
    try {
      // [手術級修正] 使用 blob 轉換確保跨平台穩定性
      let fileToUpload: any = photoUri?.uri || photoUri;
      const formData = new FormData();

      if (Platform.OS !== 'web') {
        const response = await fetch(fileToUpload);
        const blob = await response.blob();
        formData.append('file', blob, fileName || 'upload.jpg');
      } else {
        formData.append('file', fileToUpload);
      }

      formData.append('upload_preset', 'ml_default');

      // [核心修正] 根據副檔名判定 resource_type
      const isPdf = (photoUri && typeof photoUri === 'string' && photoUri.toLowerCase().endsWith('.pdf')) ||
        (fileName && fileName.toLowerCase().endsWith('.pdf'));

      const resourceType = isPdf ? 'raw' : 'image';
      const apiUrl = `https://api.cloudinary.com/v1_1/df8uaeazt/${resourceType}/upload`;

      const response = await fetch(apiUrl, {
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