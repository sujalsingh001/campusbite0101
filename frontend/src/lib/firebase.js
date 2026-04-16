import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
apiKey: "AIzaSyDndeRNMZ_qn07ziIzQeqRrVUKHL5pyqYA",
authDomain: "campusbite-e54ec.firebaseapp.com",
projectId: "campusbite-e54ec",
storageBucket: "campusbite-e54ec.firebasestorage.app",
messagingSenderId: "73001842134",
appId: "1:73001842134:web:3937db1f40947e8de22077"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
