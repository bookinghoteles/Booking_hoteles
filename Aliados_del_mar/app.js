// --- Datos del hotel ---
import { hotelData } from './services/hotel-data.js';

// --- Variables globales ---
const hero = document.getElementById('heroSlider');
const bookingPanel = document.getElementById('bookingPanel');
const bookingTitle = document.getElementById('bookingTitle');
const dateInInput = document.getElementById('dateIn');
const dateOutInput = document.getElementById('dateOut');
const totalPriceEl = document.getElementById('totalPrice');

const viewerModal = document.getElementById('viewerModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const viewerCarousel = document.getElementById('viewerCarousel');
const viewerInfo = document.getElementById('viewerInfo');
const viewerBookingPanel = document.getElementById('viewerBookingPanel');

let currentSlide = 0;
let activeBookingRoom = null;
let currentMediaIndex = 0;
let currentMediaList = [];
let currentRoomPrice = 0;

// --- Slider hero ---
function renderHeroSlider() {
  hero.innerHTML = hotelData.heroImages.map((img, i) =>
    `<div class="slide" style="background-image:url('${img}'); opacity:${i === 0 ? 1 : 0};"></div>`
  ).join('');
  startHeroSlider();
}

function startHeroSlider() {
  const slides = hero.querySelectorAll('.slide');
  if (slides.length <= 1) return; // No slider si solo hay 1 imagen
  setInterval(() => {
    slides[currentSlide].style.opacity = 0;
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].style.opacity = 1;
  }, 6000);
}

// --- Render amenities ---
function renderAmenities() {
  const grid = document.getElementById('amenitiesGrid');
  grid.innerHTML = hotelData.amenities.map(a => `
    <div class="amenity-item">
      <img src="${a.icon}" alt="${a.name}" />
      <span>${a.name}</span>
    </div>
  `).join('');
}

// --- Render habitaciones ---
function renderRooms() {
  const container = document.getElementById('roomsList');
  container.innerHTML = hotelData.rooms.map(r => {

    const priceFormatted = r.price.toLocaleString('es-CO');

    return `
      <article class="room-card">
        <img src="${r.image}" alt="${r.name}" style="cursor:pointer; border-radius: 8px;" onclick="openViewer('${hotelData.id}', '${r.id}')" />
        <div class="room-info">
          <h3>${r.name}</h3>
          <p>${r.description}</p>
          <div class="price">$${priceFormatted} / noche</div>
          <button onclick="openViewer('${hotelData.id}', '${r.id}')">Reservar</button>
        </div>
      </article>
    `;
  }).join('');
}


// --- Funciones para panel de reserva ---
function startBooking(hotelId, roomId) {
  activeBookingRoom = hotelData.rooms.find(r => r.id === roomId);
  bookingTitle.textContent = `Reservar: ${activeBookingRoom.name}`;
  dateInInput.value = '';
  dateOutInput.value = '';
  totalPriceEl.textContent = '$0';
  bookingPanel.classList.remove('hidden');

  const today = new Date().toISOString().slice(0, 10);
  dateInInput.min = today;
  dateOutInput.min = today;

  dateInInput.onchange = () => {
    dateOutInput.min = dateInInput.value; // Evitar salida antes de entrada
    updateTotal();
  };
  dateOutInput.onchange = updateTotal;
}

function updateTotal() {
  const inDate = dateInInput.value;
  const outDate = dateOutInput.value;
  if (!inDate || !outDate) {
    totalPriceEl.textContent = '$0';
    return;
  }
  const nights = calcNights(inDate, outDate);
  if (nights <= 0) {
    totalPriceEl.textContent = 'Selecciona fechas válidas';
    return;
  }
  totalPriceEl.textContent = '$' + (nights * activeBookingRoom.price);
}

function calcNights(inStr, outStr) {
  const a = new Date(inStr);
  const b = new Date(outStr);
  const diff = (b - a) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(diff));
}

function closePanel() {
  bookingPanel.classList.add('hidden');
  activeBookingRoom = null;
}

function confirmBookingModal() {
  if (!activeBookingRoom) return alert('Selecciona una habitación primero');
  const inDate = dateInInput.value;
  const outDate = dateOutInput.value;
  if (!inDate || !outDate) return alert('Selecciona fechas de entrada y salida');
  const nights = calcNights(inDate, outDate);
  if (nights <= 0) return alert('Fechas inválidas o salida antes de entrada');

  if (!isRangeAvailable(inDate, outDate, activeBookingRoom.availableRanges)) {
    return alert('Lo sentimos, esas fechas no están disponibles.');
  }

  // Abre el formulario
  document.getElementById('bookingFormPopup').classList.add('active');

  // Desactiva panel reserva mientras form esté abierto
  bookingPanel.classList.add('hidden');
}

function isRangeAvailable(inD, outD, availableRanges) {
  const inDate = new Date(inD);
  const outDate = new Date(outD);
  for (let d = new Date(inDate); d < outDate; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const ok = availableRanges.some(r => iso >= r[0] && iso <= r[1]);
    if (!ok) return false;
  }
  return true;
}

// --- Modal viewer y carrusel ---
async function openViewer(hotelId, roomId) {
  const hotel = hotelData;
  const room = hotel.rooms.find(r => r.id === roomId);
  activeBookingRoom = room;
  currentRoomPrice = room.price;
  currentMediaList = room.media || [room.image];
  currentMediaIndex = 0;

  renderMedia();
  renderInfo(hotel, room);
  renderBookingPanel(hotel, room);

  viewerModal.classList.remove('modal-hidden');

  // Inicializar Flatpickr después de mostrar el modal
  await initFlatpickr(roomId);
}

async function initFlatpickr(roomId) {
  const dateInInput = document.getElementById('modalDateIn');
  const dateOutInput = document.getElementById('modalDateOut');

  // Placeholder texto mientras carga
  dateInInput.placeholder = "Cargando...";
  dateOutInput.placeholder = "Cargando...";
  dateInInput.disabled = true;
  dateOutInput.disabled = true;

  try {
    const allReservations = await getReservations();

    // Filtrar reservas de esta habitación y mapear fechas deshabilitadas
    // Flatpickr acepta: { from: "2025-01-01", to: "2025-01-10" }
    const disabledDates = allReservations
      .filter(r => r.roomId === roomId && (r.status === 'confirmed' || r.status === 'pending'))
      .map(r => ({
        from: r.checkIn,
        to: r.checkOut
      }));

    const today = new Date().toISOString().slice(0, 10);

    // Config común
    const commonConfig = {
      minDate: today,
      dateFormat: "Y-m-d",
      disable: disabledDates,
      locale: "es", // Requiere l10n/es.js
      disableMobile: "true" // Forzar flatpickr incluso en móvil para ver colores
    };

    // Init Date In
    flatpickr(dateInInput, {
      ...commonConfig,
      onChange: function (selectedDates, dateStr, instance) {
        // Al seleccionar entrada, actualizar minDate de salida
        if (dateStr) {
          dateOutPicker.set('minDate', dateStr);
          // Abrir el de salida automáticamente (opcional)
          // dateOutPicker.open();
          updateModalTotal();
        }
      }
    });

    // Init Date Out
    const dateOutPicker = flatpickr(dateOutInput, {
      ...commonConfig,
      onChange: function (selectedDates, dateStr, instance) {
        updateModalTotal();
      }
    });

  } catch (e) {
    console.error("Error cargando calendario", e);
  } finally {
    dateInInput.disabled = false;
    dateOutInput.disabled = false;
    dateInInput.placeholder = "Fecha entrada";
    dateOutInput.placeholder = "Fecha salida";
  }
}

function renderMedia() {
  viewerCarousel.innerHTML = '';
  const mediaUrl = currentMediaList[currentMediaIndex];
  let element;
  if (mediaUrl.match(/\.(mp4|webm)$/i)) {
    element = document.createElement('video');
    element.src = mediaUrl;
    element.controls = true;
  } else {
    element = document.createElement('img');
    element.src = mediaUrl;
    element.alt = 'Imagen de la habitación';
  }
  viewerCarousel.appendChild(element);
}

function renderInfo(hotel, room) {
  viewerInfo.innerHTML = `
    <h3>${room.name}</h3>
    <p>Hotel: <strong>${hotel.name}</strong></p>
    <p>Precio por noche: <strong>$${room.price}</strong></p>
    <p>${room.description}</p>
  `;
}

function renderBookingPanel(hotel, room) {
  viewerBookingPanel.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px">Reserva: ${hotel.name}</div>
    <div style="font-size:13px;color:#666;margin-bottom:6px">${room.name} — $${room.price}/noche</div>
    <label>Entrada</label>
    <input id="modalDateIn" type="text" placeholder="Seleccionar fecha" />
    <label>Salida</label>
    <input id="modalDateOut" type="text" placeholder="Seleccionar fecha" />
    <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:13px;color:#333">Total estimado</div>
      <div id="modalTotalPrice" style="font-weight:800">$0</div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn secondary" onclick="checkAvailabilityModal(false)">Ver disponibilidad</button>
      <button class="btn" onclick="reservarDesdeModal()">Quiero reservar</button>
    </div>
  `;

  // Listeners nativos ya no son necesarios porque Flatpickr maneja onChange,
  // pero mantenemos la funcion updateModalTotal global para usarla dentro de flatpickr callbacks.
  // El código de render original añadía listeners aquí, pero ahora initFlatpickr lo hace.
}

window.updateModalTotal = function () {
  const inInput = document.getElementById('modalDateIn');
  const outInput = document.getElementById('modalDateOut');
  const inDate = inInput.value;
  const outDate = outInput.value;

  if (!inDate || !outDate) {
    document.getElementById('modalTotalPrice').innerText = '$0';
    return;
  }

  // calcNights usa strings YYYY-MM-DD, flatpickr los devuelve así
  const nights = calcNights(inDate, outDate);
  if (nights <= 0) {
    document.getElementById('modalTotalPrice').innerText = 'Fechas inválidas';
    return;
  }

  // activeBookingRoom es global
  if (activeBookingRoom) {
    document.getElementById('modalTotalPrice').innerText = '$' + (nights * activeBookingRoom.price);
  }
}

// --- Eventos del modal ---
modalCloseBtn.addEventListener('click', () => {
  viewerModal.classList.add('modal-hidden');
});

document.getElementById('prevMediaBtn').addEventListener('click', () => {
  currentMediaIndex = (currentMediaIndex - 1 + currentMediaList.length) % currentMediaList.length;
  renderMedia();
});

document.getElementById('nextMediaBtn').addEventListener('click', () => {
  currentMediaIndex = (currentMediaIndex + 1) % currentMediaList.length;
  renderMedia();
});

// --- Comprobar disponibilidad y pago ---
function checkAvailabilityModal(goToPay) {
  const inDate = document.getElementById('modalDateIn').value;
  const outDate = document.getElementById('modalDateOut').value;
  if (!inDate || !outDate) {
    alert('Selecciona fecha de entrada y salida.');
    return;
  }
  const nights = calcNights(inDate, outDate);
  if (nights <= 0) {
    alert('Fechas inválidas o salida antes de la entrada.');
    return;
  }
  alert(`Simulación pago: ${nights} noches por $${nights * currentRoomPrice}`);
  if (goToPay) {
    viewerModal.classList.add('modal-hidden');
  }
}

// --- Mostrar y cerrar formulario reserva ---
document.getElementById('closeBookingForm').addEventListener('click', () => {
  document.getElementById('bookingFormPopup').classList.remove('active');
  bookingPanel.classList.remove('hidden');
});

// --- Enviar formulario reserva ---
import { getReservations, addReservation } from './services/db.js';

// --- Datos del hotel ---
// (No changes to hotelData...)

// ... (Keep existing variable declarations) ...

// --- Eventos del modal ---
// (Keep existing event listeners)

// --- Enviar formulario reserva ---
document.getElementById('bookingForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const submitBtn = this.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerText;

  submitBtn.disabled = true;
  submitBtn.innerText = "Enviando...";

  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  // Añadir habitación y fechas
  data.roomId = activeBookingRoom.id;
  data.room = activeBookingRoom.name;
  data.checkIn = document.getElementById('modalDateIn').value;
  data.checkOut = document.getElementById('modalDateOut').value;
  // Default status for new reservations
  data.status = 'pending';

  console.log('Datos a enviar:', data);

  try {
    // Obtener reservas actuales desde Firebase
    const allReservations = await getReservations();

    // Validar que no se solapen las fechas antes de guardar
    if (!isDateRangeAvailable(data.roomId, data.checkIn, data.checkOut, allReservations)) {
      alert('Error: esas fechas ya están reservadas.');
      return;
    }

    // Guardar reserva en Firebase
    await addReservation(data);

    // Enviar backup a Google Sheets
    try {
      await fetch("https://script.google.com/macros/s/AKfycbwaiFm_CAY9p86XgkH_hzCYVvX5axGVszI1QNRRUXxOaYzwq6Ta9nsY1rp1C-I8pq66/exec", {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(data).toString()
      });
    } catch (sheetErr) {
      console.error("Error enviando a Sheets:", sheetErr);
    }

    // Mostrar mensaje de gracias con botón de WhatsApp
    const popupContent = document.querySelector('#bookingFormPopup .popup-content');

    // Formatear mensaje para WhatsApp
    const whatsappNumber = "573012063248";
    const message = `Hola, he hecho una reserva para ${data.room} los días ${data.checkIn} al ${data.checkOut}`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    popupContent.innerHTML = `
        <h3>Gracias por tu reserva</h3>
        <p>Hemos recibido tus datos correctamente. Para finalizar, confirma el estado vía WhatsApp.</p>
        <a href="${whatsappUrl}" target="_blank" class="btn" style="display:inline-block; text-decoration:none; margin-top:15px; background:#25D366; color:white; padding: 10px 20px; border-radius: 4px;">
          Sigue el estado de tu reserva
        </a>
    `;

    // No agregamos listener de 'click' para recargar porque el usuario irá a WhatsApp.
    // Si regresa, el modal sigue ahí. Podríamos agregar un timeout o botón cerrar secundario,
    // pero la instrucción es redireccionar.

  } catch (err) {
    alert(`Hubo un error guardando tu reserva: ${err.message}`);
    console.error(err);
  } finally {
    if (submitBtn) { // Check if element still exists (it might be gone if innerHTML replaced)
      submitBtn.disabled = false;
      submitBtn.innerText = originalBtnText;
    }
  }
});

// Expose functions to window for HTML onclick attributes
window.openViewer = openViewer;
window.checkAvailabilityModal = checkAvailabilityModal;
window.reservarDesdeModal = reservarDesdeModal;

async function reservarDesdeModal() {
  const inDate = document.getElementById('modalDateIn').value;
  const outDate = document.getElementById('modalDateOut').value;
  const btn = document.querySelector('button[onclick="reservarDesdeModal()"]');

  if (!inDate || !outDate) {
    alert('Selecciona fecha de entrada y salida.');
    return;
  }

  const nights = calcNights(inDate, outDate);
  if (nights <= 0) {
    alert('Fechas inválidas o salida antes de la entrada.');
    return;
  }

  // UI Feedback
  const originalText = btn.innerText;
  btn.innerText = "Verificando...";
  btn.disabled = true;

  try {
    // Fetch reservations async AFTER validation
    const allReservations = await getReservations();

    if (!isDateRangeAvailable(activeBookingRoom.id, inDate, outDate, allReservations)) {
      alert('Lo sentimos, esas fechas ya están reservadas.');
      return;
    }

    // Abre el formulario de reserva
    document.getElementById('bookingFormPopup').classList.add('active');
    viewerModal.classList.add('modal-hidden');
  } catch (error) {
    console.error(error);
    alert('Error verificando disponibilidad.');
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function isDateRangeAvailable(roomId, checkIn, checkOut, allReservations) {
  const newStart = new Date(checkIn);
  const newEnd = new Date(checkOut);

  for (const reservation of allReservations) {
    if (reservation.roomId === roomId) {
      const existingStart = new Date(reservation.checkIn);
      const existingEnd = new Date(reservation.checkOut);

      // Si hay solapamiento, retorna false
      if (newStart < existingEnd && newEnd > existingStart) {
        return false;
      }
    }
  }

  return true; // No hay conflictos
}


// --- Inicialización ---
renderHeroSlider();
renderAmenities();
renderRooms();
