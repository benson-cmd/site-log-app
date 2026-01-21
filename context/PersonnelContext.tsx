import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { db } from '../src/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

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
    experience?: Experience[]; // 經歷
    initialPassword?: string; // 初始密碼 (ROC Birthday)
}

interface PersonnelContextType {
    personnelList: Personnel[];
    loading: boolean;
    error: string | null;
    addPersonnel: (person: Omit<Personnel, 'id'>) => Promise<void>;
    updatePersonnel: (id: string, updatedData: Partial<Personnel>) => Promise<void>;
    deletePersonnel: (id: string) => Promise<void>;
    getPersonnelByEmail: (email: string) => Personnel | undefined;
}

const PersonnelContext = createContext<PersonnelContextType | null>(null);

export const PersonnelProvider = ({ children }: { children: ReactNode }) => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    // Fetch from Firestore
    useEffect(() => {
        const q = query(collection(db, "personnel"), orderBy("name"));
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const list: Personnel[] = [];
                snapshot.forEach((doc) => {
                    list.push({ id: doc.id, ...doc.data() } as Personnel);
                });
                setPersonnelList(list);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error("Firestore Error:", err);
                setError(err.message);
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, []);

    const addPersonnel = async (person: Omit<Personnel, 'id'>) => {
        try {
            await addDoc(collection(db, "personnel"), person);
        } catch (e: any) {
            console.error("Error adding personnel: ", e);
            throw e;
        }
    };

    const updatePersonnel = async (id: string, updatedData: Partial<Personnel>) => {
        try {
            const docRef = doc(db, "personnel", id);
            await updateDoc(docRef, updatedData);
        } catch (e: any) {
            console.error("Error updating personnel: ", e);
            throw e;
        }
    };

    const deletePersonnel = async (id: string) => {
        try {
            await deleteDoc(doc(db, "personnel", id));
        } catch (e: any) {
            console.error("Error deleting personnel: ", e);
            throw e;
        }
    };

    const getPersonnelByEmail = (email: string) => {
        return personnelList.find(p => p.email === email);
    }

    return (
        <PersonnelContext.Provider value={{ personnelList, loading, error, addPersonnel, updatePersonnel, deletePersonnel, getPersonnelByEmail }}>
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
