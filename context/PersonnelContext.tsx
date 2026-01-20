import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface Education {
    school: string;
    degree: string;
    year: string;
}

export interface Experience {
    company: string;
    role: string;
    duration: string;
}

export interface Personnel {
    id: string;
    name: string;
    title: string;
    email: string;
    phone: string;
    startDate: string;
    birthDate?: string;      // 生日
    department?: string;     // 部門
    licenses?: string[];     // 證照清單
    education?: Education[]; // 學歷
    experience?: Experience[] // 經歷
}

interface PersonnelContextType {
    personnelList: Personnel[];
    addPersonnel: (person: Omit<Personnel, 'id'>) => void;
    updatePersonnel: (id: string, updatedData: Partial<Personnel>) => void;
    deletePersonnel: (id: string) => void;
    getPersonnelByEmail: (email: string) => Personnel | undefined;
}

const PersonnelContext = createContext<PersonnelContextType | null>(null);

export const PersonnelProvider = ({ children }: { children: ReactNode }) => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([
        {
            id: '1',
            name: '吳資彬',
            title: '副總經理',
            email: 'wu@dwcc.com.tw',
            phone: '0988-967-900',
            startDate: '2017-07-17',
            birthDate: '1988-05-20',
            department: '工務部',
            licenses: ['工地主任', '品管工程師', '勞安乙級'],
            education: [
                { school: '國立成功大學', degree: '土木工程系 學士', year: '2010' },
                { school: '國立交通大學', degree: '土木工程研究所 碩士', year: '2012' }
            ],
            experience: [
                { company: '大陸工程', role: '專案經理', duration: '2012 - 2017' },
                { company: 'DW營造', role: '副總經理', duration: '2017 - Present' }
            ]
        },
        {
            id: '2',
            name: '陳曉華',
            title: '專案經理',
            email: 'chen@dwcc.com.tw',
            phone: '0912-345-678',
            startDate: '2019-03-01',
            education: [],
            experience: [],
            licenses: []
        }
    ]);

    const addPersonnel = (person: Omit<Personnel, 'id'>) => {
        const newPerson = { ...person, id: Math.random().toString(36).substr(2, 9) };
        setPersonnelList(prev => [...prev, newPerson]);
    };

    const updatePersonnel = (id: string, updatedData: Partial<Personnel>) => {
        setPersonnelList(prev => prev.map(p => p.id === id ? { ...p, ...updatedData } : p));
    };

    const deletePersonnel = (id: string) => {
        setPersonnelList(prev => prev.filter(p => p.id !== id));
    };

    const getPersonnelByEmail = (email: string) => {
        return personnelList.find(p => p.email === email);
    }

    return (
        <PersonnelContext.Provider value={{ personnelList, addPersonnel, updatePersonnel, deletePersonnel, getPersonnelByEmail }}>
            {children}
        </PersonnelContext.Provider>
    );
};

export const usePersonnel = () => {
    const context = useContext(PersonnelContext);
    if (!context) {
        throw new Error('usePersonnel must be used within a PersonnelProvider');
    }
    return context;
};
