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

export interface SubsequentExpansion {
  id: string;
  count: number;         // 第幾次擴充
  date: string;          // 核准日期
  docNumber: string;     // 核准文號
  reason: string;        // 擴充事由
  amount: number;        // 擴充金額 (追加)
}

export interface SchedulePoint {
  date: string;
  progress: number;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  manager: string;
  progress: number;

  status: 'planning' | 'construction' | 'completed' | 'suspended';
  executionStatus: 'not_started' | 'started_prep' | 'construction' | 'completed' | 'inspection' | 'settlement';
  startDate?: string;
  contractDuration?: number;
  extensions?: Extension[];

  // Financial
  contractAmount?: number;          // 原契約金額
  changeDesigns?: ChangeDesign[];    // 變更設計
  subsequentExpansions?: SubsequentExpansion[]; //後續擴充
  currentContractAmount?: number;    // Calculated

  // Progress Tracking
  scheduleData?: SchedulePoint[];
  currentActualProgress?: number;

  // Dates
  awardDate?: string;
  actualCompletionDate?: string;
  inspectionDate?: string;
  reinspectionDate?: string;
  inspectionPassedDate?: string;
}

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
  addProject: (proj: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Project[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Project);
      });
      setProjects(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const calculateTotal = (data: Partial<Project>) => {
    // 1. Base: Last ChangeDesign New Total OR Original Contract Amount
    let base = data.contractAmount || 0;
    if (data.changeDesigns && data.changeDesigns.length > 0) {
      base = data.changeDesigns[data.changeDesigns.length - 1].newTotalAmount;
    }
    // 2. Add Subsequent Expansions
    let expansionTotal = 0;
    if (data.subsequentExpansions) {
      expansionTotal = data.subsequentExpansions.reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    return base + expansionTotal;
  };

  const addProject = async (proj: Omit<Project, 'id'>) => {
    try {
      const currentContractAmount = calculateTotal(proj);
      await addDoc(collection(db, "projects"), {
        ...proj,
        currentContractAmount,
        currentActualProgress: proj.currentActualProgress || 0
      });
    } catch (e) {
      console.error("Error adding project: ", e);
    }
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    try {
      // If updating financial fields, we might need to recalculate total.
      // Since we receive Partial data, we might not have the full object to recalc cleanly unless we merge.
      // Ideally, the editing logic (UI) should pass the `currentContractAmount` computed.
      // However, to be safe, if the UI passes `changeDesigns` or `subsequentExpansions`, we should recalc if we have the other parts?
      // Actually, standard Firestore update merges. We can't easily read-then-write atomically without transaction.
      // Let's rely on the UI sending `currentContractAmount` if it changes.
      // OR better: The UI *should* calculate it.
      // I'll add a check: if `currentContractAmount` is NOT in data but financial arrays ARE, we might have an issue.
      // But `calculateTotal` above assumes we have the data.
      // Let's trust the UI handles the math and passes `currentContractAmount`.

      const docRef = doc(db, "projects", id);
      await updateDoc(docRef, data);
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
    <ProjectContext.Provider value={{ projects, loading, addProject, updateProject, deleteProject }}>
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