import { db, auth } from '../firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getReservations, updateReservation, deleteReservation, getAdminUser, saveAdminUser, getAllAdminUsers } from '../services/db.js';
import { hotelData } from '../services/hotel-data.js';

let currentUserProfile = null; // Stores { email, role, allowedRooms }


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
// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in
    console.log("Admin logged in:", user.email);

    // Fetch Admin Profile
    currentUserProfile = await getAdminUser(user.email);
    console.log("Admin Profile:", currentUserProfile);

    // Default to Super Admin access if no profile exists (Legacy support)
    // Or strictly enforce: if (!currentUserProfile) { alert("No access"); signOut(auth); return; }
    // For now, we allow access but checking logic in loadAdminReservations handles it.

    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');

    // Show Manage Users button if Super Admin or if no profile (First setup assumption)
    const canManageUsers = !currentUserProfile || currentUserProfile.role === 'superadmin';
    const manageBtn = document.getElementById('manageUsersBtn');
    if (manageBtn) {
      if (canManageUsers) {
        manageBtn.classList.remove('hidden');
        initUserManagementUI(); // Initialize listeners if not already
      } else {
        manageBtn.classList.add('hidden');
      }
    }

    // Load dashboard data
    loadAdminReservations();
  } else {
    // User is signed out
    currentUserProfile = null;
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

    // FILTRADO DE PERMISOS
    let filteredReservations = allReservations;

    if (currentUserProfile) {
      if (currentUserProfile.role !== 'superadmin') {
        const allowed = currentUserProfile.allowedRooms || [];
        filteredReservations = allReservations.filter(r => allowed.includes(r.roomId));
      }
    }
    // If no profile, we show ALL (backward compatibility) or nothing?
    // Let's safe default to Showing ALL for now so we don't break existing admins.

    if (filteredReservations.length > 0) {
      console.log(`Showing ${filteredReservations.length} of ${allReservations.length} reservations`);
      let htmlContent = '<h3>Reservas Recibidas</h3>';

      // Invertir orden
      const reversedReservations = [...filteredReservations].reverse();

      reversedReservations.forEach((reservation, index) => {
        if (!reservation.status) reservation.status = 'pending';

        const reservationId = reservation.id;
        const reservationNumber = filteredReservations.length - index; // Adjusted number
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
      container.innerHTML = '<h3>No tienes reservas visibles asignadas.</h3>';
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

// ==========================================
//    USER MANAGEMENT LOGIC
// ==========================================

let uiInitialized = false;

function initUserManagementUI() {
  if (uiInitialized) return;
  uiInitialized = true;

  const manageBtn = document.getElementById('manageUsersBtn');
  const usersPanel = document.getElementById('usersPanel');
  const saveUserBtn = document.getElementById('saveUserBtn');
  const cancelUserEditBtn = document.getElementById('cancelUserEditBtn');
  const adminEmailInput = document.getElementById('adminEmail');
  const adminRoleSelect = document.getElementById('adminRole');

  // Toggle Panel
  manageBtn.addEventListener('click', () => {
    usersPanel.classList.toggle('hidden');
    if (!usersPanel.classList.contains('hidden')) {
      renderUsersList();
      renderRoomsCheckboxes();
    }
  });

  // Save User
  saveUserBtn.addEventListener('click', async () => {
    const email = adminEmailInput.value.trim();
    const role = adminRoleSelect.value;

    if (!email) {
      alert("Por favor ingresa un correo.");
      return;
    }

    const allowedRooms = [];
    document.querySelectorAll('#roomsCheckboxes input[type="checkbox"]:checked').forEach(cb => {
      allowedRooms.push(cb.value);
    });

    // Save
    try {
      saveUserBtn.innerText = "Guardando...";
      await saveAdminUser(email, {
        role: role,
        allowedRooms: allowedRooms
      });
      alert("Usuario guardado exitosamente.");
      resetUserForm();
      renderUsersList();
    } catch (e) {
      alert("Error guardando usuario: " + e.message);
    } finally {
      saveUserBtn.innerText = "Guardar Usuario";
    }
  });

  // Cancel Edit
  cancelUserEditBtn.addEventListener('click', () => {
    resetUserForm();
  });
}

function resetUserForm() {
  document.getElementById('adminEmail').value = '';
  document.getElementById('adminRole').value = 'admin';
  document.querySelectorAll('#roomsCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
}

async function renderUsersList() {
  const listContainer = document.getElementById('usersList');
  listContainer.innerHTML = "Cargando usuarios...";

  const users = await getAllAdminUsers();

  if (users.length === 0) {
    listContainer.innerHTML = "<p>No hay usuarios configurados.</p>";
    return;
  }

  let html = '<table style="width:100%; border-collapse:collapse; margin-top:10px;">';
  html += '<tr style="background:#f1f1f1; text-align:left;"><th>Email</th><th>Rol</th><th>Habitaciones</th><th>Acciones</th></tr>';

  users.forEach(u => {
    const allowedCount = u.allowedRooms ? u.allowedRooms.length : 0;
    const totalRooms = hotelData.rooms.length;
    const roomsText = u.role === 'superadmin' ? 'Todas (S.Admin)' : `${allowedCount} / ${totalRooms}`;

    html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:8px;">${u.email}</td>
                <td style="padding:8px;">${u.role}</td>
                <td style="padding:8px;">${roomsText}</td>
                <td style="padding:8px;">
                    <button class="edit-user-btn" data-email="${u.email}" style="cursor:pointer; padding:4px 8px;">Editar</button>
                </td>
            </tr>
        `;
  });
  html += '</table>';

  listContainer.innerHTML = html;

  // Attach Edit Listeners
  listContainer.querySelectorAll('.edit-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      const user = users.find(u => u.email === email);
      loadUserToForm(user);
    });
  });
}

function renderRoomsCheckboxes() {
  const container = document.getElementById('roomsCheckboxes');
  if (container.children.length > 0) return; // Already rendered

  let html = '';
  hotelData.rooms.forEach(room => {
    html += `
            <label style="font-size:14px; display:flex; align-items:center; gap:5px;">
                <input type="checkbox" value="${room.id}">
                ${room.name}
            </label>
        `;
  });
  container.innerHTML = html;
}

function loadUserToForm(user) {
  document.getElementById('adminEmail').value = user.email;
  document.getElementById('adminRole').value = user.role || 'admin';

  // Check boxes
  const checkboxes = document.querySelectorAll('#roomsCheckboxes input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = user.allowedRooms && user.allowedRooms.includes(cb.value);
  });

  // Scroll to form
  document.querySelector('.add-user-form').scrollIntoView({ behavior: 'smooth' });
}
