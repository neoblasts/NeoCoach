import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "@/libs/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true until Firebase resolves first auth state

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signup = (email, password, displayName) =>
    createUserWithEmailAndPassword(auth, email, password).then(({ user }) =>
      updateProfile(user, { displayName })
    );

  const login  = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = ()               => signOut(auth);

  const resetPassword = async (email) => {
    const actionCodeSettings = {
      url: "https://studypersonalcoach.firebaseapp.com/__/auth/action",
      handleCodeInApp: true,
    };
    try {
      return await sendPasswordResetEmail(auth, email, actionCodeSettings);
    } catch (err) {
      console.warn("sendPasswordResetEmail with actionCodeSettings failed, falling back to default:", err?.message || err);
      return await sendPasswordResetEmail(auth, email);
    }
  };

  const confirmResetPassword = (oobCode, newPassword) =>
    confirmPasswordReset(auth, oobCode, newPassword);

  const verifyResetCode = (oobCode) =>
    verifyPasswordResetCode(auth, oobCode);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signup,
        login,
        logout,
        resetPassword,
        confirmResetPassword,
        verifyResetCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
