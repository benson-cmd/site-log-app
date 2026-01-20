import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface Personnel {
    id: string;
    name: string;
    title: string;
    email: string;
    phone: string;
    startDate: string;
}

interface PersonnelContextType {
    personnelList: Personnel[];
    addPersonnel: (person: Omit<Personnel, 'id'>) => void;
    updatePersonnel: (id: string, updatedData: Partial<Personnel>) => void;
    deletePersonnel: (id: string) => void;
}

const PersonnelContext = createContext<PersonnelContextType | null>(null);

export const PersonnelProvider = ({ children }: { children: ReactNode }) => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([
        { id: '1', name: '吳資彬', title: '副總經理', email: 'wu@dwcc.com.tw', phone: '0988-967-900', startDate: '2017-07-17' },
        { id: '2', name: '陳曉華', title: '專案經理', email: 'chen@dwcc.com.tw', phone: '0912-345-678', startDate: '2019-03-01' }
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

    return (
        <PersonnelContext.Provider value={{ personnelList, addPersonnel, updatePersonnel, deletePersonnel }}>
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
