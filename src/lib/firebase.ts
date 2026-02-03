import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// @ts-ignore
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { Platform } from "react-native";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
    apiKey: "AIzaSyDPsdk6B6LwWKY22FPiR0MGchZ-s5irhv0",
    authDomain: "site-log-app.firebaseapp.com",
    projectId: "site-log-app",
    storageBucket: "site-log-app.firebasestorage.app",
    messagingSenderId: "923382656123",
    appId: "1:923382656123:web:21e83b2449fd5d798746de",
    measurementId: "G-JTN8Z361N7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const auth = Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
