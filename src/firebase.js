import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAZFi4Xfpv3wYvs7xhEjJuegEEW6awQh_0",
  authDomain: "bhukker-transport.firebaseapp.com",
  projectId: "bhukker-transport",
  storageBucket: "bhukker-transport.firebasestorage.app",
  messagingSenderId: "559074068683",
  appId: "1:559074068683:web:b4015a930ccf1cd22e734e"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);