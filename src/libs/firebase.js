import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAnjs1ZYIJVVbOoQfwvTuRTxfFCsJ_RcD8",
  authDomain: "studypersonalcoach.firebaseapp.com",
  projectId: "studypersonalcoach",
  storageBucket: "studypersonalcoach.firebasestorage.app",
  messagingSenderId: "905374796068",
  appId: "1:905374796068:web:7a7c3efc2eb730b6b3cbb1",
  measurementId: "G-JSKS2KQKK6",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
