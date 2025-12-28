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

// Config ya puesta (tu proyecto)
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

function escapeHtml(str) {
  return str
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

// Pide el nombre solo la primera vez; luego se guarda en localStorage
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

function renderMessage(doc) {
  const data = doc.data();
  const name = escapeHtml(String(data.name ?? "Invitado"));
  const text = escapeHtml(String(data.text ?? ""));
  const when = formatDate(data.createdAt);

  const el = document.createElement("div");
  el.className = "msg";
  el.innerHTML = `
    <div class="meta">
      <span><strong>${name}</strong></span>
      <span>${escapeHtml(when)}</span>
    </div>
    <div class="text">${text}</div>
  `;
  return el;
}

function scrollToBottom() {
  $messages.scrollTop = $messages.scrollHeight;
}

// Realtime listener: últimos 500 mensajes (sube/baja si quieres)
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
  if (!clean) return;

  $input.value = "";
  $input.focus();

  try {
    await addDoc(msgsRef, {
      name: userName,
      text: clean,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    alert("Error enviando. Si el mensaje es enorme, Firestore tiene límite por documento.");
    console.error(err);
  }
});
