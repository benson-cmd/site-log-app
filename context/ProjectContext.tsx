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

export interface Project {
  id: string;
  name: string;
  address: string;
  manager: string;
  progress: number;
  status: 'planning' | 'construction' | 'completed' | 'suspended';
  startDate?: string;          // 開工日
  contractDuration?: number;   // 契約工期 (天)
  extensions?: Extension[];    // 展延列表

  // New Fields
  awardDate?: string;          // 決標日期
  actualCompletionDate?: string; // 實際竣工日
  inspectionDate?: string;     // 驗收日期
  reinspectionDate?: string;   // 複驗日期
  inspectionPassedDate?: string; // 驗收合格日
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
    const q = query(collection(db, "projects"), orderBy("name")); // Simple default sort
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
      await addDoc(collection(db, "projects"), proj);
    } catch (e) {
      console.error("Error adding project: ", e);
    }
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    try {
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