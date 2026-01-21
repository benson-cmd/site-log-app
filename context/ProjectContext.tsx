import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { db } from '../src/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

export interface Extension {
  id: string;
  days: number;
  date: string;       // 公文日期
  docNumber: string;  // 公文文號
  reason: string;     // 展延理由
}

export interface ChangeDesign {
  id: string;
  count: number;         // 第幾次變更
  date: string;          // 議價/公文日期
  docNumber: string;     // 公文文號
  reason: string;        // 變更事由
  newTotalAmount: number; // 變更後總價
}

export interface SchedulePoint {
  date: string;
  progress: number; // 0-100
}

export interface Project {
  id: string;
  name: string;
  address: string;
  manager: string;
  progress: number; // calculated or manual

  // Status & Dates
  status: 'planning' | 'construction' | 'completed' | 'suspended'; // simple status (kept for back-compat or replaced?) users asked for dropdown
  executionStatus: 'not_started' | 'started_prep' | 'construction' | 'completed' | 'inspection' | 'settlement';
  startDate?: string;
  contractDuration?: number;
  extensions?: Extension[];

  // Financial
  contractAmount?: number;          // 原契約金額
  changeDesigns?: ChangeDesign[];   // 變更設計明細
  currentContractAmount?: number;   // 目前契約金額 (Auto-calc)

  // Progress Tracking
  scheduleData?: SchedulePoint[];   // 預定進度表 (CSV Imported)
  currentActualProgress?: number;   // 最新實際進度 (Synced from Logs)

  // Validations
  awardDate?: string;
  actualCompletionDate?: string;
  inspectionDate?: string;
  reinspectionDate?: string;
  inspectionPassedDate?: string;
}

interface ProjectContextType {
  projects: Project[];
  addProject: (proj: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Project[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Project);
      });
      setProjects(list);
    });

    return () => unsubscribe();
  }, []);

  const addProject = async (proj: Omit<Project, 'id'>) => {
    try {
      // Auto-calc currentContractAmount
      let currentAmount = proj.contractAmount || 0;
      if (proj.changeDesigns && proj.changeDesigns.length > 0) {
        // Take the last one's newTotalAmount
        currentAmount = proj.changeDesigns[proj.changeDesigns.length - 1].newTotalAmount;
      }

      await addDoc(collection(db, "projects"), {
        ...proj,
        currentContractAmount: currentAmount,
        currentActualProgress: proj.currentActualProgress || 0
      });
    } catch (e) {
      console.error("Error adding project: ", e);
    }
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    try {
      // If updating changeDesigns, re-calc currentContractAmount
      let extraUpdates: any = {};
      if (data.changeDesigns) {
        if (data.changeDesigns.length > 0) {
          extraUpdates.currentContractAmount = data.changeDesigns[data.changeDesigns.length - 1].newTotalAmount;
        } else {
          // Fallback to original? We might need to fetch doc to know, but partial update tricky.
          // For now assume if provided, we use it. If list empty, maybe revert to base?
          // Simplify: Just update if present.
        }
      }

      const docRef = doc(db, "projects", id);
      await updateDoc(docRef, { ...data, ...extraUpdates });
    } catch (e) {
      console.error("Error updating project: ", e);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, "projects", id));
    } catch (e) {
      console.error("Error deleting project: ", e);
    }
  };

  return (
    <ProjectContext.Provider value={{ projects, addProject, updateProject, deleteProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};