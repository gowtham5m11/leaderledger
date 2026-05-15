import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from '../firebase';
import SignInModal from './SignInModal';

const AuthContext = createContext({
  user: null,
  loading: true,
  configured: false,
  isAdmin: false,
  error: null,
  signIn: async () => {},
  signOutUser: async () => {},
  openSignIn: () => {},
  closeSignIn: () => {},
  requireAuth: async () => null,
});

async function syncUserProfile(user) {
  if (!db || !user) return;
  const ref = doc(db, 'users', user.uid);
  await setDoc(
    ref,
    {
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      lastLogin: serverTimestamp(),
    },
    { merge: true },
  );
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingResolvers, setPendingResolvers] = useState([]);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        try {
          const tokenResult = await u.getIdTokenResult();
          setIsAdmin(Boolean(tokenResult.claims.admin));
        } catch {
          setIsAdmin(false);
        }
        syncUserProfile(u).catch((e) => console.warn('Profile sync failed:', e.message));
      } else {
        setIsAdmin(false);
      }
    });
  }, []);

  useEffect(() => {
    if (user && pendingResolvers.length) {
      pendingResolvers.forEach((r) => r(user));
      setPendingResolvers([]);
      setModalOpen(false);
    }
  }, [user, pendingResolvers]);

  const signIn = useCallback(async () => {
    if (!auth) throw new Error('Firebase not configured');
    setError(null);
    try {
      const provider = googleProvider || new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(err.message || 'Sign-in failed');
      }
      throw err;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
  }, []);

  const openSignIn = useCallback(() => {
    setError(null);
    setModalOpen(true);
  }, []);

  const closeSignIn = useCallback(() => {
    setModalOpen(false);
    pendingResolvers.forEach((r) => r(null));
    setPendingResolvers([]);
  }, [pendingResolvers]);

  const requireAuth = useCallback(() => {
    if (user) return Promise.resolve(user);
    setModalOpen(true);
    return new Promise((resolve) => {
      setPendingResolvers((prev) => [...prev, resolve]);
    });
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured: isFirebaseConfigured,
        isAdmin,
        error,
        signIn,
        signOutUser,
        openSignIn,
        closeSignIn,
        requireAuth,
      }}
    >
      {children}
      {isFirebaseConfigured && (
        <SignInModal open={modalOpen} onClose={closeSignIn} onSignIn={signIn} error={error} />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
