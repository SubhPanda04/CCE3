import React, { useEffect, useState } from 'react'
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { Projects, SignUp } from '../container';
import { auth } from '../config/firebase.config';

const Home = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    // Clear any existing auth state when the app loads
    localStorage.removeItem('userUID');
    localStorage.removeItem('userName');
    
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
      
      // We'll no longer store auth state in localStorage automatically
      // This prevents auto-login behavior
    });

    return () => unsubscribe();
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen flex flex-col items-center justify-start ${location.pathname === '/home/auth' ? 'bg-[#051630]' : ''}`}>
      <div className='w-full h-full flex flex-col items-start justify-start'>
        <div className='w-full h-full'>
          <Routes>
            <Route 
              path="/auth" 
              element={<SignUp />} 
            />
            <Route 
              path="/projects" 
              element={
                user ? (
                  <Projects />
                ) : (
                  <Navigate to="/home/auth" replace state={{ from: location.pathname }} />
                )
              } 
            />
            <Route path="/" element={<Navigate to="/home/auth" replace />} />
            <Route path="*" element={<Navigate to="/home/auth" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Home;