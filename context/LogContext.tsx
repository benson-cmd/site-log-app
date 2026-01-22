import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { db } from '../src/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

export interface MachineryItem {
  id: string;
  name: string;           // 機具名稱
  quantity: number;       // 數量
  note?: string;          // 備註 (例如：進場時間)
}

export interface ManpowerItem {
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
  content: string;        // 施工項目 (renamed from content)
  machinery?: MachineryItem[];     // 機具列表
  manpower?: ManpowerItem[];      // 人力列表
  plannedProgress?: number; // 預定進度 (from CSV)
  reporter: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  photos?: string[];      // 施工照片
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

  const uploadPhoto = async (uri: string): Promise<string> => {
    try {
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', {
        uri: uri,
        type: 'image/jpeg',
        name: 'upload.jpg'
      });
      formData.append('upload_preset', 'ml_default');

      const response = await fetch('https://api.cloudinary.com/v1_1/df8uaeazt/image/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();
      if (data.secure_url) {
        return data.secure_url;
      } else {
        console.error("Cloudinary Error:", data);
        throw new Error("Upload failed");
      }
    } catch (e) {
      console.error("Upload failed:", e);
      throw e;
    }
  };

  const addLog = async (log: Omit<LogEntry, 'id'>) => {
    try {
      let finalPhotos: string[] = [];
      if (log.photos && log.photos.length > 0) {
        finalPhotos = await Promise.all(log.photos.map(async (p) => {
          if (p.startsWith('http')) return p; // Already a remote URL
          return await uploadPhoto(p);
        }));
      }

      await addDoc(collection(db, "logs"), { ...log, photos: finalPhotos });
    } catch (e) {
      console.error("Error adding log: ", e);
      throw e;
    }
  };

  const updateLog = async (id: string, data: Partial<LogEntry>) => {
    try {
      let finalPhotos = data.photos;
      if (data.photos && data.photos.length > 0) {
        finalPhotos = await Promise.all(data.photos.map(async (p) => {
          if (p.startsWith('http')) return p;
          return await uploadPhoto(p);
        }));
      }

      const docRef = doc(db, "logs", id);
      await updateDoc(docRef, { ...data, photos: finalPhotos || data.photos });
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