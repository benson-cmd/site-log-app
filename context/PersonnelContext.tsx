import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { db, firebaseConfig } from '../src/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { initializeApp, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

export interface Education {
    school: string;
    major: string;  // 科系
    degree: string;
    year: string;   // Format: YYYY (西元年份)
}

export interface Experience {
    company: string;
    role: string;
    startMonth: string; // Format: YYYY-MM
    endMonth: string;   // Format: YYYY-MM
    duration?: string;  // Computed display: "西元 YYYY/MM - 西元 YYYY/MM" (for backward compatibility)
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
    password?: string; // 自訂密碼
    role?: 'admin' | 'user'; // 權限等級 (admin, user)
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
            // 1. Add to Firestore
            await addDoc(collection(db, "personnel"), person);

            // 2. Create in Firebase Auth (Secondary App)
            if (person.email && person.initialPassword) {
                const appName = 'SecondaryAuthApp';
                let secondaryApp: FirebaseApp;
                try {
                    secondaryApp = getApp(appName);
                } catch (e) {
                    secondaryApp = initializeApp(firebaseConfig, appName);
                }

                const secondaryAuth = getAuth(secondaryApp);
                try {
                    await createUserWithEmailAndPassword(secondaryAuth, person.email, person.initialPassword);
                    await signOut(secondaryAuth); // Ensure clean state
                    console.log(`Created Firebase Auth user for ${person.email}`);
                } catch (authErr: any) {
                    console.error("Error creating Firebase Auth user (non-fatal):", authErr);
                    // We don't throw here to avoid rolling back the Firestore addition, 
                    // or we could throw if strict consistency is required.
                }
            }

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
