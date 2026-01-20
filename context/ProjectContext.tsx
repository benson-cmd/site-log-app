import React, { createContext, useState, useContext, ReactNode } from 'react';

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
  addProject: (proj: Omit<Project, 'id'>) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: '台中七期商辦大樓',
      address: '台中市西屯區市政路',
      manager: '王大明',
      progress: 35,
      status: 'construction',
      startDate: '2025-01-01',
      contractDuration: 600,
      extensions: [],
      awardDate: '2024-11-15'
    },
    {
      id: '2',
      name: '高雄亞灣住宅案',
      address: '高雄市前鎮區成功路',
      manager: '林建國',
      progress: 12,
      status: 'construction',
      startDate: '2025-06-01',
      contractDuration: 450,
      extensions: [],
      awardDate: '2025-03-01'
    },
    {
      id: '3',
      name: '台北信義區總部修繕',
      address: '台北市信義區松高路',
      manager: '陳曉華',
      progress: 85,
      status: 'construction',
      startDate: '2024-05-15',
      contractDuration: 300,
      extensions: [{ id: 'e1', days: 15, date: '2024-10-01', docNumber: '北市工字第12345號', reason: '颱風影響' }],
      awardDate: '2024-04-01'
    },
    {
      id: '4',
      name: '桃園青埔物流中心',
      address: '桃園市中壢區領航北路',
      manager: '張志偉',
      progress: 0,
      status: 'planning',
      startDate: '',
      contractDuration: 0,
      extensions: []
    }
  ]);

  const addProject = (proj: Omit<Project, 'id'>) => {
    const newProj = { ...proj, id: Math.random().toString(36).substr(2, 9) };
    setProjects(prev => [newProj, ...prev]);
  };

  const updateProject = (id: string, data: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
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