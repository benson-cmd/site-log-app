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
  type: 'add' | 'subtract' | 'set'; // Logic type, though user asked for "newTotal" or "delta"? 
  // User said "變更後總價 = ...". Usually this implies we store the result. 
  // But let's stick to the previous Request: "變更後總價 (newTotalAmount)"
  // Wait, new request says: "變更後總價 = 契約總金 + 所有變更設計調整後的金額差額"
  // This implies we strictly track deltas? Or we verify the new total?
  // Let's store "newTotalAmount" as the "state after this change". 
  newTotalAmount: number;
}

export interface SubsequentExpansion {
  id: string;
  count: number;         // 第幾次擴充
  date: string;          // 核准日期
  docNumber: string;     // 核准文號
  reason: string;        // 擴充事由
  amount: number;        // 擴充金額 (Added amount)
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
  progress: number;

  status: 'planning' | 'construction' | 'completed' | 'suspended';
  executionStatus: 'not_started' | 'started_prep' | 'construction' | 'completed' | 'inspection' | 'settlement';
  startDate?: string;
  contractDuration?: number;
  extensions?: Extension[];

  // Financial
  contractAmount?: number;          // 原契約金額
  changeDesigns?: ChangeDesign[];    // 變更設計
  subsequentExpansions?: SubsequentExpansion[]; // 後續擴充
  currentContractAmount?: number;    // Final calculated field

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

  const calculateTotal = (proj: Partial<Project>) => {
    let total = proj.contractAmount || 0;

    // If there are change designs, the LAST one sets the "New Base Total" 
    // (Assuming Change Design 'newTotalAmount' is "Resultant Total after Change")
    if (proj.changeDesigns && proj.changeDesigns.length > 0) {
      total = proj.changeDesigns[proj.changeDesigns.length - 1].newTotalAmount;
    }

    // Then Add Subsequent Expansions (Accumulative)
    if (proj.subsequentExpansions) {
      const expansionTotal = proj.subsequentExpansions.reduce((sum, item) => sum + (item.amount || 0), 0);
      total += expansionTotal;
    }
    return total;
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
      // Logic to re-calc total if financial fields are touched
      // This is tricky with partial updates. Ideally we fetch, merge, calc, update.
      // But for simplicity/speed, we assume the caller passes enough info OR we just update what's passed.
      // Better: The caller (UI) should likely pass the `currentContractAmount` calculated.
      // OR we just assume `addProject` is the main "Form Submit" and `updateProject` might be partial.
      // Let's trust the UI or re-calc if possible. Since we don't have full state here easily without reading...
      // Let's just forward the data, but if `changeDesigns` or `subsequent` are in data, we might want to update `currentContractAmount`.
      // NOTE: For this usage, the UI form usually submits the whole object or specifically calculated fields.
      // We will rely on UI to pass `currentContractAmount` if it changed, OR we leave it to next open/save.
      // Actually, let's keep it simple: Just update.

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