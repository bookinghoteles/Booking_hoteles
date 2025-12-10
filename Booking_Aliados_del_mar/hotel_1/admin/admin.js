import { db, auth } from '../firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getReservations, updateReservation, deleteReservation } from '../services/db.js';

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

// --- Password Recovery Handler ---
if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    // Get email from the input field
    const email = emailInput.value.trim();

    if (!email) {
      alert("Por favor, escribe tu correo en el campo 'Usuario' para saber a dónde enviar el reset.");
      emailInput.focus();
      return;
    }

    if (!confirm(`¿Enviar correo de recuperación a ${email}?`)) return;

    try {
      await sendPasswordResetEmail(auth, email);
      alert(`¡Listo! Hemos enviado un correo a ${email} para restablecer tu contraseña. Revisa tu bandeja de entrada.`);
    } catch (error) {
      console.error("Recovery Error:", error);
      if (error.code === 'auth/user-not-found') {
        alert("No encontramos ningún administrador con ese correo.");
      } else {
        alert("Hubo un error enviando el correo. Intenta de nuevo.");
      }
    }
  });
}

// --- Auth State Listener ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    console.log("Admin logged in:", user.email);
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');

    // Load dashboard data
    loadAdminReservations();
  } else {
    // User is signed out
    console.log("Admin logged out");
    dashboardSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
  }
});

// --- Login Handler ---
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const email = emailInput.value;
  const pass = passwordInput.value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // UI updates automatically via onAuthStateChanged
  } catch (error) {
    console.error("Login Error:", error);
    loginError.textContent = "Error: Usuario o contraseña incorrectos.";
    loginError.style.display = 'block';
  }
});

// --- Logout Handler ---
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  });
}

// ==========================================
//    EXISTING DASHBOARD LOGIC (Preserved)
// ==========================================

async function loadAdminReservations() {
  const container = document.getElementById('adminReservationInfo');
  container.innerHTML = 'Cargando reservas...';

  try {
    const allReservations = await getReservations();

    if (allReservations.length > 0) {
      let htmlContent = '<h3>Todas las reservas recibidas</h3>';

      // Invertir orden
      const reversedReservations = [...allReservations].reverse();

      reversedReservations.forEach((reservation, index) => {
        if (!reservation.status) reservation.status = 'pending';

        const reservationId = reservation.id;
        const reservationNumber = allReservations.length - index;
        const isConfirmed = reservation.status === 'confirmed';
        const isPending = reservation.status === 'pending';

        // Campos editables
        const editableFields = [
          { key: 'name', label: 'Nombre', type: 'text' },
          { key: 'age', label: 'Edad', type: 'number', min: 1 },
          { key: 'people', label: 'Cantidad de personas', type: 'number', min: 1 },
          { key: 'email', label: 'Correo', type: 'email' },
          { key: 'phone', label: 'Teléfono', type: 'tel' },
          { key: 'document', label: 'Documento', type: 'text' }
        ];

        let fieldsHtml = '';
        fieldsHtml += `<p><strong>Entrada:</strong> <span class="display-value">${reservation.checkIn}</span></p>`;
        fieldsHtml += `<p><strong>Salida:</strong> <span class="display-value">${reservation.checkOut}</span></p>`;

        editableFields.forEach(field => {
          fieldsHtml += `
            <p><strong>${field.label}:</strong> 
              <span class="display-value" data-field="${field.key}">${reservation[field.key] || ''}</span>
              <input 
                type="${field.type}" 
                class="edit-input hidden" 
                data-field="${field.key}" 
                value="${reservation[field.key] || ''}" 
                ${field.min ? 'min="' + field.min + '"' : ''} 
              />
            </p>
          `;
        });

        htmlContent += `
          <div class="reservation-card" data-id="${reservationId}">
            <h4>Reserva #${reservationNumber} (${reservation.room})</h4>
            
            <div class="status-controls">
              <label for="status-${reservationId}">Estado:</label>
              <select id="status-${reservationId}" class="status-select" data-id="${reservationId}">
                <option value="pending" ${isPending ? 'selected' : ''}>Reserva pendiente de confirmar</option>
                <option value="confirmed" ${isConfirmed ? 'selected' : ''}>Reserva confirmada</option>
              </select>
            </div>
            
            <div class="reservation-data">
              ${fieldsHtml}
            </div>
            
            <div class="card-actions">
              <button class="edit-btn" data-id="${reservationId}">Editar información</button>
              <button class="save-btn hidden" data-id="${reservationId}">Guardar cambios</button>
              <button class="delete-btn" data-id="${reservationId}">Eliminar reserva</button>
            </div>
          </div>
        `;
      });

      container.innerHTML = htmlContent;
      attachEventListeners();

    } else {
      container.innerHTML = '<h3>No hay reservas aún.</h3>';
    }
  } catch (error) {
    console.error(error);
    container.innerHTML = '<h3>Error cargando reservas.</h3>';
  }
}

function attachEventListeners() {
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', handleStatusChange);
  });
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', handleDeleteReservation);
  });
  document.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', handleEditToggle);
  });
  document.querySelectorAll('.save-btn').forEach(button => {
    button.addEventListener('click', handleSaveChanges);
  });
}

function handleEditToggle(event) {
  const card = event.target.closest('.reservation-card');
  card.classList.toggle('editing');
  const isEditing = card.classList.contains('editing');

  card.querySelectorAll('.display-value').forEach(span => {
    const isDate = span.closest('p').textContent.includes('Entrada:') || span.closest('p').textContent.includes('Salida:');
    if (!isDate) span.classList.toggle('hidden', isEditing);
  });

  card.querySelectorAll('.edit-input').forEach(input => {
    input.classList.toggle('hidden', !isEditing);
  });

  card.querySelector('.edit-btn').classList.toggle('hidden', isEditing);
  card.querySelector('.save-btn').classList.toggle('hidden', !isEditing);
  card.querySelector('.delete-btn').disabled = isEditing;
  card.querySelector('.status-select').disabled = isEditing;
}

async function handleSaveChanges(event) {
  const reservationId = event.target.dataset.id;
  const card = event.target.closest('.reservation-card');
  let isValid = true;
  const newData = {};

  card.querySelectorAll('.edit-input:not(.hidden)').forEach(input => {
    const field = input.dataset.field;
    const value = input.value.trim();
    if (value === '') {
      isValid = false;
      alert(`El campo ${field} no puede estar vacío.`);
      input.focus();
      return;
    }
    newData[field] = value;
  });

  if (!isValid) return;

  try {
    await updateReservation(reservationId, newData);
    alert('Información de la reserva actualizada exitosamente.');
    loadAdminReservations();
  } catch (e) {
    alert("Error actualizando la reserva.");
    console.error(e);
  }
}

async function handleStatusChange(event) {
  const reservationId = event.target.dataset.id;
  const newStatus = event.target.value;
  try {
    await updateReservation(reservationId, { status: newStatus });
    alert(`Reserva actualizada a: ${newStatus === 'confirmed' ? 'Confirmada' : 'Pendiente'}`);
  } catch (e) {
    alert("Error actualizando estado.");
    console.error(e);
  }
}

async function handleDeleteReservation(event) {
  const reservationId = event.target.dataset.id;
  if (!confirm('¿Estás seguro de que quieres eliminar esta reserva? Esta acción no se puede deshacer.')) return;

  try {
    await deleteReservation(reservationId);
    alert('Reserva eliminada exitosamente.');
    loadAdminReservations();
  } catch (e) {
    alert("Error eliminando reserva.");
    console.error(e);
  }
}
