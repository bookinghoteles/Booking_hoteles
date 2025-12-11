// TODO: Replace with your specific Firebase configuration
// You can find these details in your Firebase Console > Project Settings
const firebaseConfig = {
    apiKey: "AIzaSyAKJy22slQgGAZrhyXqYgVaZi0gJcMjM4w",
    authDomain: "booking-hoteles-b6bc9.firebaseapp.com",
    projectId: "booking-hoteles-b6bc9",
    storageBucket: "booking-hoteles-b6bc9.firebasestorage.app",
    messagingSenderId: "759973011058",
    appId: "1:759973011058:web:5cb60c0875e7fb8a182ceb",
    measurementId: "G-F9MMGJXBTP"
};

// Import Firebase functions from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, initializeFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
const auth = getAuth(app);

export { db, auth };
