import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COLLECTION_NAME = 'reservations';

// Helper for timeout
const withTimeout = (promise, ms = 10000, opName = 'Operation') => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${opName} timed out after ${ms}ms`)), ms))
    ]);
};

/**
 * Obtiene todas las reservas desde Firestore
 * @returns {Promise<Array>} Lista de reservas
 */
export async function getReservations() {
    console.log("Iniciando getReservations...");
    try {
        const querySnapshot = await withTimeout(
            getDocs(collection(db, COLLECTION_NAME)),
            10000,
            'Obtener reservas'
        );
        const reservations = [];
        querySnapshot.forEach((doc) => {
            reservations.push({ id: doc.id, ...doc.data() });
        });
        console.log("Reservas obtenidas:", reservations.length);
        return reservations;
    } catch (e) {
        console.error("Error obteniendo reservas: ", e);
        throw e; // Rethrow to notify caller (UI) of failure
    }
}

/**
 * Guarda una nueva reserva en Firestore
 * @param {Object} reservationData Datos de la reserva
 * @returns {Promise<String>} ID de la nueva reserva
 */
export async function addReservation(reservationData) {
    console.log("Iniciando addReservation...", reservationData);
    try {
        const docRef = await withTimeout(
            addDoc(collection(db, COLLECTION_NAME), reservationData),
            10000,
            'Guardar reserva'
        );
        console.log("Reserva guardada con ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error guardando reserva: ", e);
        throw e;
    }
}

/**
 * Actualiza una reserva existente
 * @param {String} id ID de la reserva en Firestore
 * @param {Object} data Datos a actualizar
 */
export async function updateReservation(id, data) {
    try {
        const reservationRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(reservationRef, data);
        console.log("Reserva actualizada");
    } catch (e) {
        console.error("Error actualizando reserva: ", e);
        throw e;
    }
}

/**
 * Elimina una reserva
 * @param {String} id ID de la reserva en Firestore
 */
export async function deleteReservation(id) {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        console.log("Reserva eliminada");
    } catch (e) {
        console.error("Error eliminando reserva: ", e);
        throw e;
    }
}

// --- User Management ---
const USERS_COLLECTION = 'users';

/**
 * Get admin user profile by email
 * @param {string} email 
 * @returns {Promise<Object|null>} User data or null if not found
 */
export async function getAdminUser(email) {
    try {
        const docRef = doc(db, USERS_COLLECTION, email);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { email: docSnap.id, ...docSnap.data() };
        } else {
            return null;
        }
    } catch (e) {
        console.error("Error getting admin user:", e);
        return null;
    }
}

/**
 * Save or update admin user profile
 * @param {string} email 
 * @param {Object} data { allowedRooms: [], role: 'admin'|'superadmin' }
 */
export async function saveAdminUser(email, data) {
    try {
        await setDoc(doc(db, USERS_COLLECTION, email), data, { merge: true });
        console.log("Admin user saved");
    } catch (e) {
        console.error("Error saving admin user:", e);
        throw e;
    }
}

/**
 * Get all admin users
 * @returns {Promise<Array>} List of users
 */
export async function getAllAdminUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
        const users = [];
        querySnapshot.forEach((doc) => {
            users.push({ email: doc.id, ...doc.data() });
        });
        return users;
    } catch (e) {
        console.error("Error getting all admin users:", e);
        return [];
    }
}
