/**
 * VOTE.JS — Módulo de Votación Pública RL
 * Arquitectura: modular, limpia, desacoplada
 * Firebase Realtime Database + lógica de parejas
 */

import { initializeApp }        from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set }
                                 from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// ════════════════════════════════════════════════
// 0. FIREBASE — INICIALIZACIÓN
// ════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "AIzaSyCxd2sdNJZaQ0Rq_mF6Sn1wLQra4Eabp1U",
  authDomain:        "danzad-maldit0s.firebaseapp.com",
  databaseURL:       "https://danzad-maldit0s-default-rtdb.firebaseio.com",
  projectId:         "danzad-maldit0s",
  storageBucket:     "danzad-maldit0s.firebasestorage.app",
  messagingSenderId: "774607843671",
  appId:             "1:774607843671:web:ec64876ba81b6b50acce12"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ════════════════════════════════════════════════
// 1. CONSTANTES
// ════════════════════════════════════════════════

const PAIR_COLORS = {
  1: { name: 'rojo',    css: 'pair-1', hex: '#e03030' },
  2: { name: 'amarillo',css: 'pair-2', hex: '#d4aa20' },
  3: { name: 'verde',   css: 'pair-3', hex: '#2ea86b' },
  4: { name: 'azul',    css: 'pair-4', hex: '#2b7fd4' },
  5: { name: 'morado',  css: 'pair-5', hex: '#8b42d4' },
};

const TOTAL_PAIRS = 5;
const MEMBERS_PER_PAIR = 2;

// ════════════════════════════════════════════════
// 2. ESTADO DE LA APLICACIÓN
// ════════════════════════════════════════════════

/**
 * pairs[n] = array de IDs de participantes (máximo 2)
 * currentPair = número de pareja actualmente construyendo (1-5)
 * participants = objeto con datos de Firebase
 * votacionActiva = booleano desde Firebase
 */
const state = {
  currentPair:     1,
  pairs:           { 1: [], 2: [], 3: [], 4: [], 5: [] },
  participants:    {},
  votacionActiva:  false,
};

// ════════════════════════════════════════════════
// 3. NAVEGACIÓN DE PANTALLAS
// ════════════════════════════════════════════════

const screens = {
  menu:    document.getElementById('screen-menu'),
  waiting: document.getElementById('screen-waiting'),
  vote:    document.getElementById('screen-vote'),
  done:    document.getElementById('screen-done'),
};

/**
 * Muestra una pantalla y oculta las demás.
 * @param {'menu'|'waiting'|'vote'|'done'} name
 */
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}

// ════════════════════════════════════════════════
// 4. FIREBASE — ESCUCHA EN TIEMPO REAL
// ════════════════════════════════════════════════

/** Escucha el estado de votación activa */
function listenVotacionActiva() {
  const votacionRef = ref(db, 'control/votacionActiva');
  onValue(votacionRef, (snapshot) => {
    const isActive = snapshot.val() === true || snapshot.val() === 'true';
    state.votacionActiva = isActive;

    // Si estamos en sala de espera y se activa → pasar a votación
    if (isActive && screens.waiting.classList.contains('active')) {
      loadParticipantsAndVote();
    }
  });
}

/** Carga participantes desde Firebase y muestra pantalla de votación */
function listenParticipants() {
  const participantsRef = ref(db, 'participantes');
  onValue(participantsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      state.participants = data;
    }
  });
}

function loadParticipantsAndVote() {
  if (Object.keys(state.participants).length > 0) {
    showScreen('vote');
    renderParticipantsGrid();
  } else {
    // Esperar a que lleguen los participantes
    const participantsRef = ref(db, 'participantes');
    onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        state.participants = data;
        showScreen('vote');
        renderParticipantsGrid();
      }
    }, { onlyOnce: true });
  }
}

// ════════════════════════════════════════════════
// 5. RENDER — TARJETAS DE PARTICIPANTES
// ════════════════════════════════════════════════

/**
 * Renderiza el grid de tarjetas desde state.participants
 * Si no hay participantes en Firebase, usa datos de ejemplo.
 */
function renderParticipantsGrid() {
  const grid    = document.getElementById('participants-grid');
  const loading = document.getElementById('loading-participants');

  // Usar participantes de Firebase o fallback de ejemplo
  let participantsList = Object.values(state.participants);

  if (participantsList.length === 0) {
    participantsList = generateFallbackParticipants();
  }

  // Ordenar por número
  participantsList.sort((a, b) => (a.numero || 0) - (b.numero || 0));

  // Limpiar grid
  grid.innerHTML = '';

  participantsList.forEach((p, idx) => {
    const card = createParticipantCard(p, idx);
    grid.appendChild(card);
  });

  // Actualizar UI inicial
  updatePairsIndicator();
  updateSubmitButton();
}

/**
 * Crea el elemento DOM de una tarjeta de participante.
 */
function createParticipantCard(participant, animDelay) {
  const card = document.createElement('div');
  card.className = 'participant-card';
  card.setAttribute('data-id', participant.id || participant.numero);
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `Participante ${participant.numero}: ${participant.nombre}`);
  card.style.animation = `card-appear 0.5s var(--ease-out) ${animDelay * 60}ms both`;

  card.innerHTML = `
    <div class="card-image-wrap">
      <img
        src="${participant.imagen || generateAvatarUrl(participant.nombre)}"
        alt="${participant.nombre}"
        loading="lazy"
        onerror="this.src='${generateAvatarUrl(participant.nombre)}'"
      />
      <div class="card-overlay"></div>
      <div class="card-num">#${String(participant.numero).padStart(2,'0')}</div>
      <div class="card-pair-badge" aria-hidden="true"></div>
    </div>
    <div class="card-info">
      <span class="card-name">${participant.nombre}</span>
    </div>
  `;

  card.addEventListener('click', () => handleCardClick(card, participant));

  return card;
}

/** Genera URL de avatar placeholder si no hay imagen */
function generateAvatarUrl(name) {
  const encoded = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${encoded}&background=1a1a1a&color=c8b08a&size=200&font-size=0.4&bold=true`;
}

/** Datos de ejemplo si Firebase no tiene participantes */
function generateFallbackParticipants() {
  const nombres = [
    'Ana Reyes', 'Camilo Torres', 'Sofia Díaz', 'Mateo Ruiz',
    'Valentina Cruz', 'Sebastián López', 'Isabella Mora', 'Daniel García',
    'Luciana Vargas', 'Alejandro Ríos'
  ];
  return nombres.map((nombre, i) => ({
    id:     `p${i + 1}`,
    numero: i + 1,
    nombre,
    imagen: '',
  }));
}

// ════════════════════════════════════════════════
// 6. LÓGICA DE SELECCIÓN DE PAREJAS
// ════════════════════════════════════════════════

/**
 * Maneja el clic en una tarjeta de participante.
 * Implementa la lógica completa de selección/deselección.
 */
function handleCardClick(card, participant) {
  const id = String(participant.id || participant.numero);

  // ¿Ya está asignado a una pareja completa?
  const assignedPair = getParticipantPair(id);

  if (assignedPair !== null) {
    // Está en una pareja → deseleccionar
    removeFromPair(id, assignedPair);
    return;
  }

  // ¿Está seleccionado (primera mitad de pareja pendiente)?
  if (isParticipantPending(id)) {
    cancelPendingSelection(id);
    return;
  }

  // ¿La pareja actual está completa y queremos seleccionar uno nuevo?
  const currentPairFull = state.pairs[state.currentPair].length >= MEMBERS_PER_PAIR;
  if (currentPairFull) {
    // Buscar si hay alguna pareja incompleta
    const incompletePair = findIncompletePair();
    if (incompletePair === null) return; // Todas completas — no hacer nada
    state.currentPair = incompletePair;
  }

  // Agregar a la pareja actual
  addToCurrentPair(id, card);
}

/** Retorna el número de pareja (1-5) al que pertenece un id, o null */
function getParticipantPair(id) {
  for (let p = 1; p <= TOTAL_PAIRS; p++) {
    if (state.pairs[p].includes(id)) return p;
  }
  return null;
}

/** ¿Está el participante seleccionado como primera mitad pendiente? */
function isParticipantPending(id) {
  const pairArr = state.pairs[state.currentPair];
  return pairArr.length === 1 && pairArr[0] === id;
}

/** Cancela selección de la primera mitad de una pareja */
function cancelPendingSelection(id) {
  state.pairs[state.currentPair] = [];
  updateCardVisual(id, 'none');
  updatePairsIndicator();
}

/** Elimina un participante de su pareja y recalcula estado */
function removeFromPair(id, pairNum) {
  state.pairs[pairNum] = state.pairs[pairNum].filter(x => x !== id);
  updateCardVisual(id, 'none');

  // Si la pareja queda en 1 miembro, el otro vuelve a "selected" (pendiente)
  const remaining = state.pairs[pairNum];
  if (remaining.length === 1) {
    updateCardVisual(remaining[0], 'selected', pairNum);
  }

  // Asegurarse de que currentPair apunta a una incompleta
  const incompletePair = findIncompletePair();
  if (incompletePair !== null) {
    state.currentPair = incompletePair;
  }

  updatePairsIndicator();
  updateSubmitButton();
}

/** Agrega un participante a la pareja actual */
function addToCurrentPair(id, card) {
  state.pairs[state.currentPair].push(id);
  const pairCount = state.pairs[state.currentPair].length;

  if (pairCount === 1) {
    // Primera selección: estado "selected" (pendiente)
    updateCardVisual(id, 'selected', state.currentPair);
  } else if (pairCount === MEMBERS_PER_PAIR) {
    // Segunda selección: pareja completa
    const [first, second] = state.pairs[state.currentPair];
    updateCardVisual(first, 'paired', state.currentPair);
    updateCardVisual(second, 'paired', state.currentPair);

    // Avanzar a la siguiente pareja incompleta
    const next = findNextIncompletePair(state.currentPair);
    if (next !== null) state.currentPair = next;
  }

  updatePairsIndicator();
  updateSubmitButton();
}

/** Encuentra la primera pareja incompleta (de 1 o 0 miembros) */
function findIncompletePair() {
  for (let p = 1; p <= TOTAL_PAIRS; p++) {
    if (state.pairs[p].length < MEMBERS_PER_PAIR) return p;
  }
  return null;
}

/** Encuentra la siguiente pareja incompleta después de `currentPair` */
function findNextIncompletePair(afterPair) {
  // Buscar desde afterPair+1 hacia adelante
  for (let p = afterPair + 1; p <= TOTAL_PAIRS; p++) {
    if (state.pairs[p].length < MEMBERS_PER_PAIR) return p;
  }
  // Si no hay, buscar desde 1
  for (let p = 1; p <= afterPair; p++) {
    if (state.pairs[p].length < MEMBERS_PER_PAIR) return p;
  }
  return null;
}

// ════════════════════════════════════════════════
// 7. ACTUALIZACIÓN VISUAL DE TARJETAS
// ════════════════════════════════════════════════

/**
 * Actualiza el estado visual de una tarjeta.
 * @param {string} id
 * @param {'none'|'selected'|'paired'} status
 * @param {number|null} pairNum
 */
function updateCardVisual(id, status, pairNum = null) {
  const card = document.querySelector(`.participant-card[data-id="${id}"]`);
  if (!card) return;

  const badge = card.querySelector('.card-pair-badge');

  // Limpiar todas las clases de estado
  card.classList.remove(
    'selected', 'paired', 'locked',
    'pair-1', 'pair-2', 'pair-3', 'pair-4', 'pair-5'
  );
  badge.textContent = '';
  badge.style.color = '';

  if (status === 'none') return;

  if (status === 'selected') {
    card.classList.add('selected');
    badge.textContent = pairNum || state.currentPair;
  }

  if (status === 'paired' && pairNum) {
    card.classList.add('paired', `pair-${pairNum}`);
    badge.textContent = pairNum;
    if (pairNum === 2) badge.style.color = '#0a0a0a';
  }
}

// ════════════════════════════════════════════════
// 8. INDICADOR DE PAREJAS
// ════════════════════════════════════════════════

function updatePairsIndicator() {
  for (let p = 1; p <= TOTAL_PAIRS; p++) {
    const pill  = document.querySelector(`.pair-pill[data-pair="${p}"]`);
    const count = document.getElementById(`count-${p}`);
    if (!pill || !count) continue;

    const members = state.pairs[p].length;
    count.textContent = `${members}/${MEMBERS_PER_PAIR}`;

    pill.classList.remove('active', 'complete');

    if (members === MEMBERS_PER_PAIR) {
      pill.classList.add('complete');
    } else if (p === state.currentPair) {
      pill.classList.add('active');
    }
  }
}

// ════════════════════════════════════════════════
// 9. BOTÓN REGISTRAR VOTO
// ════════════════════════════════════════════════

function updateSubmitButton() {
  const btn       = document.getElementById('btn-register');
  const progress  = document.getElementById('vote-progress-text');
  const allPaired = allPairsComplete();

  btn.disabled = !allPaired;

  if (allPaired) {
    progress.textContent = '¡Tus 5 parejas están listas!';
  } else {
    const remaining = TOTAL_PAIRS - countCompletePairs();
    progress.textContent = remaining === 1
      ? 'Falta 1 pareja por completar'
      : `Faltan ${remaining} parejas por completar`;
  }
}

function allPairsComplete() {
  return Object.values(state.pairs).every(arr => arr.length === MEMBERS_PER_PAIR);
}

function countCompletePairs() {
  return Object.values(state.pairs).filter(arr => arr.length === MEMBERS_PER_PAIR).length;
}

// ════════════════════════════════════════════════
// 10. MODAL DE CONFIRMACIÓN
// ════════════════════════════════════════════════

function openConfirmModal() {
  const modal   = document.getElementById('modal-confirm');
  const summary = document.getElementById('modal-pairs-summary');

  // Construir resumen de parejas
  summary.innerHTML = '';

  for (let p = 1; p <= TOTAL_PAIRS; p++) {
    const ids   = state.pairs[p];
    const names = ids.map(id => getParticipantName(id));
    const color = PAIR_COLORS[p];

    const row = document.createElement('div');
    row.className = 'summary-row';
    row.style.background = `${color.hex}18`;
    row.style.border     = `1px solid ${color.hex}40`;

    row.innerHTML = `
      <div class="summary-badge" style="background:${color.hex};${p===2?'color:#0a0a0a':''}">${p}</div>
      <span class="summary-names">${names.join(' + ')}</span>
    `;
    summary.appendChild(row);
  }

  modal.classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('modal-confirm').classList.remove('open');
}

function getParticipantName(id) {
  // Buscar en state.participants (de Firebase) o por ID
  const participants = Object.values(state.participants);
  const found = participants.find(p => String(p.id || p.numero) === String(id));
  return found ? found.nombre : `#${id}`;
}

// ════════════════════════════════════════════════
// 11. REGISTRO EN FIREBASE
// ════════════════════════════════════════════════

async function registrarVoto() {
  try {
    const votoData = buildVotePayload();
    const votosRef = ref(db, 'votos');
    await push(votosRef, votoData);
    closeConfirmModal();
    showScreen('done');
  } catch (err) {
    console.error('Error al registrar voto:', err);
    closeConfirmModal();
    alert('Hubo un error al registrar tu voto. Por favor inténtalo de nuevo.');
  }
}

/**
 * Construye el objeto de voto para Firebase.
 * Estructura limpia para uso en broadcast y admin.
 */
function buildVotePayload() {
  const pairesFormatted = {};

  for (let p = 1; p <= TOTAL_PAIRS; p++) {
    const ids   = state.pairs[p];
    const names = ids.map(id => getParticipantName(id));
    const color = PAIR_COLORS[p];

    pairesFormatted[`pareja_${p}`] = {
      numero:        p,
      color:         color.name,
      participantes: ids.map((id, idx) => ({
        id:     id,
        nombre: names[idx],
      })),
    };
  }

  return {
    timestamp:    Date.now(),
    fechaISO:     new Date().toISOString(),
    parejas:      pairesFormatted,
    totalParejas: TOTAL_PAIRS,
  };
}

// ════════════════════════════════════════════════
// 12. RESET DE ESTADO
// ════════════════════════════════════════════════

function resetVoteState() {
  state.currentPair = 1;
  state.pairs = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  // Limpiar visuales de tarjetas
  document.querySelectorAll('.participant-card').forEach(card => {
    const id = card.getAttribute('data-id');
    card.classList.remove(
      'selected', 'paired', 'locked',
      'pair-1', 'pair-2', 'pair-3', 'pair-4', 'pair-5'
    );
    const badge = card.querySelector('.card-pair-badge');
    if (badge) badge.textContent = '';
  });

  updatePairsIndicator();
  updateSubmitButton();
}

// ════════════════════════════════════════════════
// 13. EVENTOS DE INTERFAZ
// ════════════════════════════════════════════════

function bindUIEvents() {
  // Menú → Sala de espera
  document.getElementById('btn-enter').addEventListener('click', () => {
    showScreen('waiting');
    // Si ya está activa la votación, ir directo
    if (state.votacionActiva) {
      loadParticipantsAndVote();
    }
  });

  // Volver al menú desde espera
  document.getElementById('btn-back-from-wait').addEventListener('click', () => {
    showScreen('menu');
  });

  // Volver al menú desde votación
  document.getElementById('btn-back-from-vote').addEventListener('click', () => {
    resetVoteState();
    showScreen('menu');
  });

  // Abrir modal de confirmación
  document.getElementById('btn-register').addEventListener('click', () => {
    if (allPairsComplete()) openConfirmModal();
  });

  // Modal: No
  document.getElementById('modal-no').addEventListener('click', closeConfirmModal);

  // Modal: Sí
  document.getElementById('modal-yes').addEventListener('click', () => {
    registrarVoto();
  });

  // Cerrar modal al hacer clic en overlay
  document.getElementById('modal-confirm').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-confirm')) {
      closeConfirmModal();
    }
  });
}

// ════════════════════════════════════════════════
// 14. INICIALIZACIÓN
// ════════════════════════════════════════════════

function init() {
  bindUIEvents();
  listenVotacionActiva();
  listenParticipants();
  showScreen('menu');
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
