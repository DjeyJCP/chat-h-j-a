import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/**
 * Cloudinary (FREE, sin tarjeta):
 * - Crea cuenta
 * - Crea un "Upload preset" UNSIGNED
 * - Pega aquí CLOUD_NAME y UPLOAD_PRESET
 */
const CLOUDINARY_CLOUD_NAME = "dsavymd9i";
const CLOUDINARY_UPLOAD_PRESET = "chat-h-j-a";

// Firebase (tu proyecto)
const firebaseConfig = {
  apiKey: "AIzaSyD8YW1EU5M-2scCGMhXw22GV6mxu6kXV-c",
  authDomain: "chat-h-j-a.firebaseapp.com",
  projectId: "chat-h-j-a",
  storageBucket: "chat-h-j-a.firebasestorage.app",
  messagingSenderId: "25480520424",
  appId: "1:25480520424:web:c542b154cec33b4bfb9f5d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Auth anónima: no pide login, pero da un UID para poder borrar solo tus mensajes
let uid = null;
try {
  await signInAnonymously(auth);
  uid = auth.currentUser?.uid || null;
} catch (e) {
  console.error(e);
  alert("No se pudo iniciar sesión anónima. Sin esto no se puede borrar solo tus mensajes.");
}

const $messages = document.getElementById("messages");

function handleDeleteClick(e) {
  const btn = e.target?.closest?.("[data-del]");
  if (!btn) return;

  const id = btn.getAttribute("data-del");
  if (!id) return;

  if (!uid) {
    alert("No hay UID (auth anónima falló). Activa Authentication → Anónimo en Firebase.");
    return;
  }

  if (!confirm("¿Borrar este mensaje?")) return;

  btn.disabled = true;
  deleteDoc(doc(db, "messages", id)).catch((err) => {
    console.error(err);
    alert("No se pudo borrar. Revisa Firestore Rules (delete solo si uid coincide).");
    btn.disabled = false;
  });
}

// Delegación: los mensajes se renderizan dinámicamente
$messages.addEventListener("click", handleDeleteClick);

const $form = document.getElementById("sendForm");
const $input = document.getElementById("messageInput");
const $currentUser = document.getElementById("currentUser");
const $changeNameBtn = document.getElementById("changeNameBtn");

const $addMediaBtn = document.getElementById("addMediaBtn");
const $mediaInput = document.getElementById("mediaInput");
const $mediaChip = document.getElementById("mediaChip");
const $mediaChipText = document.getElementById("mediaChipText");
const $removeMediaBtn = document.getElementById("removeMediaBtn");
const $recordBtn = document.getElementById("recordBtn");
const $recordChip = document.getElementById("recordChip");
const $recordChipText = document.getElementById("recordChipText");
const $cancelRecordBtn = document.getElementById("cancelRecordBtn");
const $sendBtn = document.getElementById("sendBtn");
const $typingIndicator = document.getElementById("typingIndicator");

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

// Nombre: solo la primera vez
function getOrAskName(force = false) {
  let name = localStorage.getItem("chat_name");
  if (force || !name) {
    name = prompt("Tu nombre para el chat:")?.trim();
    if (!name) name = "Invitado";
    if (name.length > 40) name = name.slice(0, 40);
    localStorage.setItem("chat_name", name);
  }
  $currentUser.textContent = `Usuario: ${name}`;
  return name;
}

let userName = getOrAskName(false);

// Identificador local del navegador (para presencia/typing)
function getClientId() {
  let id = localStorage.getItem("chat_client_id");
  if (!id) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes).map(b => (b % 36).toString(36)).join("");
    localStorage.setItem("chat_client_id", id);
  }
  return id;
}
const clientId = getClientId();

$changeNameBtn.addEventListener("click", () => {
  userName = getOrAskName(true);
});

// Typing: al escribir en el input
$input.addEventListener("input", onUserInputActivity);
$input.addEventListener("focus", onUserInputActivity);
$input.addEventListener("blur", () => updateTyping(false));
window.addEventListener("beforeunload", () => {
  // intenta marcar como no escribiendo
  updateTyping(false);
});

// --- MEDIA (Cloudinary) ---
let pendingMedia = null; // { url, kind, contentType, publicId, bytes }

// --- TYPING (Firestore) ---
const typingRef = doc(db, "typing", (uid || clientId));
let typingTimer = null;
let isTypingLocal = false;

async function updateTyping(typing) {
  // Best-effort: no bloquea el chat si falla
  try {
    isTypingLocal = typing;
    await setDoc(typingRef, {
      name: userName,
      isTyping: !!typing,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    // Silencioso
    console.warn("typing update failed", e);
  }
}

function scheduleStopTyping() {
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => updateTyping(false), 2000);
}

function onUserInputActivity() {
  if (!isTypingLocal) updateTyping(true);
  scheduleStopTyping();
}

function setMediaChipVisible(visible) {
  $mediaChip.style.display = visible ? "" : "none";
}

function setBusyUploading(isBusy, label = "") {
  $sendBtn.disabled = isBusy;
  $addMediaBtn.disabled = isBusy;
  $sendBtn.textContent = isBusy ? label : "Enviar";
}

function guessKind(contentType) {
  if (contentType?.startsWith("image/")) return "image";
  if (contentType?.startsWith("video/")) return "video";
  if (contentType?.startsWith("audio/")) return "audio";
  return "file";
}

function ensureCloudinaryConfigured() {
  if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME.startsWith("PON_")) return false;
  if (!CLOUDINARY_UPLOAD_PRESET || CLOUDINARY_UPLOAD_PRESET.startsWith("PON_")) return false;
  return true;
}

$addMediaBtn.addEventListener("click", () => {
  if (!ensureCloudinaryConfigured()) {
    alert("Falta configurar Cloudinary: pon CLOUD_NAME y UPLOAD_PRESET en app.js");
    return;
  }
  $mediaInput.value = "";
  $mediaInput.click();
});

$removeMediaBtn.addEventListener("click", () => {
  pendingMedia = null;
  setMediaChipVisible(false);
  $mediaChipText.textContent = "";
});

async function uploadToCloudinary(file) {
  const ct = file.type || "";
  const kind = guessKind(ct);
  if (kind !== "image" && kind !== "video" && kind !== "audio") {
    throw new Error("Solo se permiten fotos, vídeos o audios.");
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/auto/upload`;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(endpoint, { method: "POST", body: fd });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${res.status} ${txt}`);
  }
  const data = await res.json();

  // Preferimos secure_url
  const url = data.secure_url || data.url;
  return {
    url,
    kind,
    contentType: ct,
    publicId: data.public_id || "",
    bytes: data.bytes || file.size || 0,
  };
}

$mediaInput.addEventListener("change", async () => {
  const file = $mediaInput.files?.[0];
  if (!file) return;

  try {
    setBusyUploading(true, "Subiendo…");
    setMediaChipVisible(true);
    $mediaChipText.textContent = `Subiendo: ${file.name}`;

    const out = await uploadToCloudinary(file);
    pendingMedia = out;
    $mediaChipText.textContent = `Adjunto: ${file.name}`;
  } catch (e) {
    console.error(e);
    alert("No se pudo subir. Revisa tu preset UNSIGNED de Cloudinary y que permita subir archivos (auto) y formatos de imagen/vídeo/audio.");
    pendingMedia = null;
    setMediaChipVisible(false);
  } finally {
    setBusyUploading(false);
  }
});
// --- AUDIO (mantener pulsado para grabar) ---
let recorder = null;
let recStream = null;
let recChunks = [];
let recStartTs = 0;
let recTicker = null;
let recCanceled = false;

function setRecordChipVisible(visible) {
  $recordChip.style.display = visible ? "" : "none";
}

function stopRecordTicker() {
  if (recTicker) clearInterval(recTicker);
  recTicker = null;
}

function updateRecordChipTime() {
  const ms = Date.now() - recStartTs;
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  $recordChipText.textContent = `Grabando… ${mm}:${ss} (suelta para enviar)`;
}

async function startRecording() {
  if (!ensureCloudinaryConfigured()) {
    alert("Falta configurar Cloudinary: pon CLOUD_NAME y UPLOAD_PRESET en app.js");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Tu navegador no soporta grabación de audio.");
    return;
  }
  if (recorder && recorder.state === "recording") return;

  recCanceled = false;
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    alert("No has dado permiso de micrófono.");
    return;
  }

  recChunks = [];
  recStartTs = Date.now();
  setRecordChipVisible(true);
  updateRecordChipTime();
  stopRecordTicker();
  recTicker = setInterval(updateRecordChipTime, 250);

  // Selección de mimeType compatible
  let mimeType = "";
  if (window.MediaRecorder?.isTypeSupported?.("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
  else if (window.MediaRecorder?.isTypeSupported?.("audio/webm")) mimeType = "audio/webm";
  else if (window.MediaRecorder?.isTypeSupported?.("audio/ogg;codecs=opus")) mimeType = "audio/ogg;codecs=opus";

  recorder = new MediaRecorder(recStream, mimeType ? { mimeType } : undefined);
  recorder.addEventListener("dataavailable", (ev) => {
    if (ev.data && ev.data.size > 0) recChunks.push(ev.data);
  });

  recorder.start(250);
  onUserInputActivity(); // marca typing por si acaso
}

async function stopRecordingAndSend() {
  if (!recorder || recorder.state !== "recording") return;

  stopRecordTicker();
  $recordChipText.textContent = recCanceled ? "Cancelado" : "Procesando audio…";

  const stopPromise = new Promise((resolve) => {
    recorder.addEventListener("stop", resolve, { once: true });
  });
  recorder.stop();
  await stopPromise;

  // Corta el stream
  try { recStream?.getTracks()?.forEach(t => t.stop()); } catch {}
  recStream = null;

  if (recCanceled) {
    setRecordChipVisible(false);
    $recordChipText.textContent = "";
    return;
  }

  const blob = new Blob(recChunks, { type: recorder.mimeType || "audio/webm" });
  const contentType = blob.type || "audio/webm";
  const kind = "audio";

  // Subir a Cloudinary y enviar mensaje
  try {
    setBusyUploading(true, "Subiendo…");
    $recordChipText.textContent = "Subiendo audio…";

    const fileLike = new File([blob], `audio_${Date.now()}.webm`, { type: contentType });
    const out = await uploadToCloudinary(fileLike);

    const payload = {
      uid: uid || "",
      name: userName,
      text: "",
      createdAt: serverTimestamp(),
      mediaUrl: out.url,
      mediaKind: kind,
      mediaContentType: contentType,
      mediaPublicId: out.publicId || "",
      mediaBytes: Number(out.bytes || blob.size || 0),
    };

    await addDoc(msgsRef, payload);
  } catch (e) {
    console.error(e);
    alert("No se pudo enviar el audio. Revisa Cloudinary preset y Firestore Rules.");
  } finally {
    setBusyUploading(false);
    setRecordChipVisible(false);
    $recordChipText.textContent = "";
  }
}

function cancelRecording() {
  recCanceled = true;
  if (recorder && recorder.state === "recording") {
    stopRecordingAndSend();
  } else {
    setRecordChipVisible(false);
    $recordChipText.textContent = "";
  }
}

$cancelRecordBtn.addEventListener("click", cancelRecording);

// Mantener pulsado (mouse/touch) para grabar
let holding = false;

function onHoldStart(ev) {
  ev.preventDefault();
  holding = true;
  startRecording();
}
function onHoldEnd(ev) {
  ev.preventDefault();
  if (!holding) return;
  holding = false;
  updateTyping(false);
  stopRecordingAndSend();
}

$recordBtn.addEventListener("pointerdown", onHoldStart);
$recordBtn.addEventListener("pointerup", onHoldEnd);
$recordBtn.addEventListener("pointercancel", onHoldEnd);
$recordBtn.addEventListener("pointerleave", (ev) => {
  // si suelta fuera, igualmente se envía al soltar; aquí solo evitamos quedarnos colgados
});



// --- RENDER ---
function renderMessage(doc) {
  const data = doc.data();
  const msgUid = String(data.uid ?? "");
  const name = escapeHtml(data.name ?? "Invitado");
  const when = formatDate(data.createdAt);

  const textRaw = (data.text ?? "").toString();
  const hasText = textRaw.trim().length > 0;
  const text = escapeHtml(textRaw);

  const mediaUrl = data.mediaUrl ? String(data.mediaUrl) : "";
  const mediaKind = data.mediaKind ? String(data.mediaKind) : "";
  const mediaType = data.mediaContentType ? String(data.mediaContentType) : "";

  const el = document.createElement("div");
  el.className = "msg";

  let mediaHtml = "";
  if (mediaUrl) {
    if (mediaKind === "image" || mediaType.startsWith("image/")) {
      mediaHtml = `<div class="media"><img src="${escapeHtml(mediaUrl)}" alt="imagen"/></div>`;
    } else if (mediaKind === "video" || mediaType.startsWith("video/")) {
      mediaHtml = `<div class="media"><video src="${escapeHtml(mediaUrl)}" controls playsinline></video></div>`;
    } else if (mediaKind === "audio" || mediaType.startsWith("audio/")) {
      mediaHtml = `<div class="media"><audio src="${escapeHtml(mediaUrl)}" controls></audio></div>`;
    } else {
      mediaHtml = `<div class="media"><a href="${escapeHtml(mediaUrl)}" target="_blank" rel="noreferrer">Abrir archivo</a></div>`;
    }
  }

  el.innerHTML = `
    <div class="meta">
      <span class="metaLeft">
        <strong>${name}</strong>
        ${msgUid && uid && msgUid === uid ? `<button class="delBtn" data-del="${escapeHtml(doc.id)}" type="button">Borrar</button>` : ``}
      </span>
      <span>${escapeHtml(when)}</span>
    </div>
    ${hasText ? `<div class="text">${text}</div>` : ""}
    ${mediaHtml}
  `;
  return el;
}

function scrollToBottom() {
  $messages.scrollTop = $messages.scrollHeight;
}


function renderTypingIndicator(names) {
  const uniq = Array.from(new Set(names)).filter(n => n && n !== userName);
  if (uniq.length === 0) {
    $typingIndicator.style.display = "none";
    $typingIndicator.textContent = "";
    return;
  }
  if (uniq.length === 1) {
    $typingIndicator.innerHTML = `<em>${escapeHtml(uniq[0])}</em> está escribiendo…`;
  } else if (uniq.length === 2) {
    $typingIndicator.innerHTML = `<em>${escapeHtml(uniq[0])}</em> y <em>${escapeHtml(uniq[1])}</em> están escribiendo…`;
  } else {
    $typingIndicator.textContent = `${uniq.length} personas están escribiendo…`;
  }
  $typingIndicator.style.display = "";
}

// Escucha presencia de typing (últimos cambios)
const typingCol = collection(db, "typing");
const typingQ = query(typingCol, orderBy("updatedAt", "desc"), limit(25));
onSnapshot(typingQ, (snapshot) => {
  const now = Date.now();
  const active = [];
  snapshot.forEach((d) => {
    const v = d.data() || {};
    const ts = v.updatedAt?.toDate ? v.updatedAt.toDate().getTime() : 0;
    const fresh = ts && (now - ts) < 10000; // 10s
    if (v.isTyping === true && fresh) active.push(String(v.name || "Invitado"));
  });
  renderTypingIndicator(active);
});

// Realtime listener: últimos 500 mensajes
const msgsRef = collection(db, "messages");
const q = query(msgsRef, orderBy("createdAt", "asc"), limit(500));

// Render estable: NO reconstruye todo, aplica cambios incrementales para evitar saltos.
const msgEls = new Map(); // id -> element

function insertAt(container, el, index) {
  const children = container.children;
  if (index >= children.length) container.appendChild(el);
  else container.insertBefore(el, children[index]);
}

function atBottomNow() {
  return ($messages.scrollTop + $messages.clientHeight) >= ($messages.scrollHeight - 10);
}

onSnapshot(q, (snapshot) => {
  const wasAtBottom = atBottomNow();

  snapshot.docChanges().forEach((change) => {
    const id = change.doc.id;

    if (change.type === "added") {
      const el = renderMessage(change.doc);
      msgEls.set(id, el);
      insertAt($messages, el, change.newIndex);
      return;
    }

    if (change.type === "modified") {
      const oldEl = msgEls.get(id);
      const newEl = renderMessage(change.doc);
      msgEls.set(id, newEl);

      if (oldEl && oldEl.parentNode) {
        // Mantén posición visual (reemplaza nodo)
        oldEl.replaceWith(newEl);
      } else {
        insertAt($messages, newEl, change.newIndex);
      }
      return;
    }

    if (change.type === "removed") {
      const oldEl = msgEls.get(id);
      if (oldEl && oldEl.parentNode) oldEl.remove();
      msgEls.delete(id);
      return;
    }
  });

  // Si estabas abajo, te quedas abajo. Si no, no tocamos scrollTop.
  if (wasAtBottom) scrollToBottom();
});

  // Si estabas abajo, baja. Si no, conserva la posición relativa.
  if (atBottom) {
    scrollToBottom();
  } else {
    const newScrollHeight = $messages.scrollHeight;
    const delta = newScrollHeight - prevScrollHeight;
    $messages.scrollTop = prevScrollTop + delta;
  }
});

$form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const clean = ($input.value ?? "").toString().trim();
  if (!clean && !pendingMedia) return;

  $input.value = "";
  $input.focus();

  const payload = {
    uid: uid || "",
    name: userName,
    text: clean,
    createdAt: serverTimestamp(),
  };

  if (pendingMedia) {
    payload.mediaUrl = pendingMedia.url;
    payload.mediaKind = pendingMedia.kind;
    payload.mediaContentType = pendingMedia.contentType || "";
    payload.mediaPublicId = pendingMedia.publicId || "";
    payload.mediaBytes = Number(pendingMedia.bytes || 0);
  }

  try {
    await addDoc(msgsRef, payload);

    pendingMedia = null;
    setMediaChipVisible(false);
    $mediaChipText.textContent = "";
  } catch (err) {
    alert("Error enviando. Revisa Firestore Rules.");
    console.error(err);
  }
});
