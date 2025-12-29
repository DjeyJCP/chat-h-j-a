import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot
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

const $messages = document.getElementById("messages");
const $form = document.getElementById("sendForm");
const $input = document.getElementById("messageInput");
const $currentUser = document.getElementById("currentUser");
const $changeNameBtn = document.getElementById("changeNameBtn");

const $addMediaBtn = document.getElementById("addMediaBtn");
const $mediaInput = document.getElementById("mediaInput");
const $mediaChip = document.getElementById("mediaChip");
const $mediaChipText = document.getElementById("mediaChipText");
const $removeMediaBtn = document.getElementById("removeMediaBtn");
const $sendBtn = document.getElementById("sendBtn");

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

$changeNameBtn.addEventListener("click", () => {
  userName = getOrAskName(true);
});

// --- MEDIA (Cloudinary) ---
let pendingMedia = null; // { url, kind, contentType, publicId, bytes }

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
  if (kind !== "image" && kind !== "video") {
    throw new Error("Solo se permiten fotos o vídeos.");
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
    alert("No se pudo subir. Revisa tu preset UNSIGNED de Cloudinary y que permita image/video.");
    pendingMedia = null;
    setMediaChipVisible(false);
  } finally {
    setBusyUploading(false);
  }
});

// --- RENDER ---
function renderMessage(doc) {
  const data = doc.data();
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
    } else {
      mediaHtml = `<div class="media"><a href="${escapeHtml(mediaUrl)}" target="_blank" rel="noreferrer">Abrir archivo</a></div>`;
    }
  }

  el.innerHTML = `
    <div class="meta">
      <span><strong>${name}</strong></span>
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

// Realtime listener: últimos 500 mensajes
const msgsRef = collection(db, "messages");
const q = query(msgsRef, orderBy("createdAt", "asc"), limit(500));

onSnapshot(q, (snapshot) => {
  $messages.innerHTML = "";
  snapshot.forEach((doc) => {
    $messages.appendChild(renderMessage(doc));
  });
  scrollToBottom();
});

$form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const clean = ($input.value ?? "").toString().trim();
  if (!clean && !pendingMedia) return;

  $input.value = "";
  $input.focus();

  const payload = {
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
