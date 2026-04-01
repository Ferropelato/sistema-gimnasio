/**
 * Firebase App + Auth + Realtime Database - Center Gym
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyA_dkDfYag6tAEhMyfsOE84UAeNDwxTE9Y',
  authDomain: 'gestion-center-gym-yacanto.firebaseapp.com',
  projectId: 'gestion-center-gym-yacanto',
  storageBucket: 'gestion-center-gym-yacanto.firebasestorage.app',
  messagingSenderId: '446624562635',
  appId: '1:446624562635:web:b14fe3693b99b475e88a4e',
  databaseURL: 'https://gestion-center-gym-yacanto-default-rtdb.firebaseio.com'
};

const app = initializeApp(firebaseConfig);
export { app };
export const auth = getAuth(app);
export const db = getDatabase(app);
