import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyApxvApN5zT...eZM5cIE",
  authDomain: "study-buddy-4756f.firebaseapp.com",
  projectId: "study-buddy-4756f",
  storageBucket: "study-buddy-4756f.firebasestorage.app",
  messagingSenderId: "483254113576",
  appId: "1:483254113576:web:a9aec29fa0d9dd38702c1d"
};

const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let homeworks = [];
let currentMode = "explain";

const $ = (id) => document.getElementById(id);

function page(name) {
  document.querySelectorAll(".page").forEach(x => x.classList.add("hidden"));
  $(name).classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.page === name));
}
document.querySelectorAll(".tab").forEach(b => b.onclick = () => page(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => page(b.dataset.go));
$("theme").onclick = () => document.body.classList.toggle("dark");

$("authBtn").onclick = () => {
  if (currentUser) { auth.signOut(); } 
  else { signInWithPopup(auth, provider).catch(e => alert("Sign in failed: " + e.message)); }
};

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    $("authBtn").textContent = "Sign Out (" + user.displayName.split(" ")[0] + ")";
    initHomeworkSync(user.uid);
  } else {
    $("authBtn").textContent = "Sign In";
    homeworks = [];
    renderHomework();
  }
});

function initHomeworkSync(uid) {
  const q = query(collection(db, "homework"), where("userId", "==", uid));
  onSnapshot(q, (snapshot) => {
    homeworks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderHomework();
  });
}

function renderHomework() {
  const list = $("hwList");
  if (!list) return;
  list.innerHTML = "";
  if (!homeworks.length) {
    list.innerHTML = '<div class="panel">No homework yet. Add your first task above 👀</div>';
    $("today").textContent = "You're clear. W 🔥";
    return;
  }
  homeworks.forEach((h) => {
    const d = document.createElement("div");
    d.className = "task" + (h.done ? " done" : "");
    d.innerHTML = `<input type="checkbox" ${h.done ? "checked" : ""}><div><b>${h.subject || "School"}</b><br>${h.task}<br><small>${h.date || "No deadline"}</small></div><button class="x">✕</button>`;
    d.querySelector("input").onchange = () => updateDoc(doc(db, "homework", h.id), { done: !h.done });
    d.querySelector(".x").onclick = () => deleteDoc(doc(db, "homework", h.id));
    list.appendChild(d);
  });
  const unfinished = homeworks.filter(x => !x.done).length;
  $("today").textContent = unfinished ? `${unfinished} unfinished task${unfinished === 1 ? "" : "s"} on your list.` : "You're clear. W 🔥";
}

$("addHw").onclick = async () => {
  if (!currentUser) return alert("Please sign in with Google first.");
  let subject = $("hwSubject").value.trim();
  let task = $("hwTask").value.trim();
  let date = $("hwDate").value;
  if (!task) return;
  $("hwSubject").value = "";
  $("hwTask").value = "";
  await addDoc(collection(db, "homework"), { userId: currentUser.uid, subject, task, date, done: false, createdAt: Date.now() });
};

document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => {
  currentMode = b.dataset.mode;
  document.querySelectorAll("[data-mode]").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
});

const prompts = {
  explain: (t) => `Explain "${t}" at a Year 9 level step by step with a simple example, then give me 3 check questions.`,
  quiz: (t) => `Create a Year 9 exam-style quiz on "${t}". Mix difficulty. Provide answers at the end.`,
  cards: (t) => `Make concise active-recall flashcards for "${t}" including definitions, formulas, and common mistakes.`,
  exam: (t) => `Give me practice questions on "${t}" with a mark scheme.`
};

$("makePrompt").onclick = async () => {
  let topic = $("topic").value.trim();
  if (!topic) return;
  const out = $("studyOut");
  out.classList.remove("hidden");
  out.textContent = "Generating study material...";
  out.textContent = await requestAI(prompts[currentMode](topic));
};

$("ask").onclick = async () => {
  let text = $("chatInput").value.trim();
  if (!text) return;
  const out = $("chatOutput");
  out.classList.remove("hidden");
  out.textContent = "Thinking...";
  out.textContent = await requestAI(`You are StudyBuddy AI, a friendly personal school assistant. Explain clearly at a Year 9 level, show reasoning, and give a quick check question at the end.\n\nStudent asks: ${text}`);
};

async function requestAI(promptText) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.includes("YOUR_OPENAI")) {
    return "Please set your OPENAI_API_KEY in app.js.";
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: promptText }] })
    });
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (err) {
    return "Error connecting to AI: " + err.message;
  }
}

$("focus").onclick = () => {
  let end = Date.now() + 1500000;
  let w = window.open("", "StudyBuddyFocus", "width=420,height=300");
  w.document.write(`<title>StudyBuddy Focus</title><body style="font-family:system-ui;text-align:center;padding:45px"><h1>Focus Mode 🎯</h1><div id=t style="font-size:52px;font-weight:800">25:00</div><p>Phone down. Brain on.</p><script>let e=${end};setInterval(()=>{let x=Math.max(0,e-Date.now());t.textContent=Math.floor(x/60000)+":"+String(Math.floor(x/1000)%60).padStart(2,"0")},500)<\/script></body>`);
};
