import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCandidate, type CandidateProfile } from '@/lib/firestore';

export interface User {
  uid: string;
  email: string;
  name?: string;
  role?: string;
}

interface AuthContextType {
  currentUser: User | null;
  candidateData: CandidateProfile | null;
  loading: boolean;
  refreshCandidate: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [candidateData, setCandidateData] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCandidate = async () => {
    if (currentUser) {
      const data = await getCandidate(currentUser.uid);
      setCandidateData(data);
    }
  };

  useEffect(() => {
    const localUser = localStorage.getItem("neurohire_session_user");
    if (localUser) {
      const userObj = JSON.parse(localUser);
      setCurrentUser(userObj);
      getCandidate(userObj.uid).then(data => {
        setCandidateData(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleSetCurrentUser = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem("neurohire_session_user", JSON.stringify(user));
      getCandidate(user.uid).then(data => setCandidateData(data));
    } else {
      localStorage.removeItem("neurohire_session_user");
      setCandidateData(null);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, candidateData, loading, refreshCandidate, setCurrentUser: handleSetCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
