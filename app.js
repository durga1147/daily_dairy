import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: Replace with your Firebase Project Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzB2dzT4k1yK6nwi55JlaG4Pk20FQprTE",
  authDomain: "personal-diary-app-f9861.firebaseapp.com",
  projectId: "personal-diary-app-f9861",
  storageBucket: "personal-diary-app-f9861.firebasestorage.app",
  messagingSenderId: "12621920736",
  appId: "1:12621920736:web:e1d5eba84bf3b4bbab9385"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentMode = ''; // 'view' or 'edit'
let currentEditId = ''; // Holds the date ID being edited

// ---- UI Navigation Logic ----
window.showScreen = (screenId) => {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    
    if (screenId === 'write-section') {
        document.getElementById('current-date').innerText = getTodayDate();
        document.getElementById('diary-content').value = ''; 
    }
};

const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
};

// ---- Authentication Logic ----
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => document.getElementById('auth-error').innerText = error.message);
});

document.getElementById('signup-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    createUserWithEmailAndPassword(auth, email, password)
        .catch(error => document.getElementById('auth-error').innerText = error.message);
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showScreen('dashboard-section');
    } else {
        currentUser = null;
        showScreen('auth-section');
    }
});

// ---- Database Logic: Write ----
document.getElementById('save-btn').addEventListener('click', async () => {
    const content = document.getElementById('diary-content').value;
    if (!content.trim()) return alert('Diary is empty!');

    const dateStr = getTodayDate();
    try {
        await setDoc(doc(db, "users", currentUser.uid, "diaries", dateStr), {
            content: content,
            timestamp: new Date()
        });
        alert('Entry Saved!');
        showScreen('dashboard-section');
    } catch (error) {
        console.error("Error saving: ", error);
    }
});

// ---- Database Logic: Fetch List (View/Edit) ----
window.loadEntries = async (mode) => {
    currentMode = mode;
    document.getElementById('list-title').innerText = mode === 'view' ? 'View Past Diaries' : 'Edit Past Diaries';
    showScreen('list-section');
    
    const listEl = document.getElementById('entries-list');
    listEl.innerHTML = 'Loading...';

    const q = query(collection(db, "users", currentUser.uid, "diaries"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    
    listEl.innerHTML = '';
    if(snapshot.empty) {
        listEl.innerHTML = '<li>No entries found.</li>';
        return;
    }

    snapshot.forEach(docSnap => {
        const li = document.createElement('li');
        li.innerHTML = `<span><i class="far fa-calendar-alt"></i> ${docSnap.id}</span> 
                        <i class="fas fa-chevron-right"></i>`;
        li.onclick = () => openEntry(docSnap.id, docSnap.data().content);
        listEl.appendChild(li);
    });
};

// ---- Database Logic: Open Single Entry ----
const openEntry = (dateId, content) => {
    if (currentMode === 'view') {
        document.getElementById('view-date-title').innerText = dateId;
        document.getElementById('view-content').innerText = content;
        showScreen('view-detail-section');
    } else {
        currentEditId = dateId;
        document.getElementById('edit-date-title').innerText = `Editing: ${dateId}`;
        document.getElementById('edit-content').value = content;
        showScreen('edit-detail-section');
    }
};

// ---- Database Logic: Update Entry ----
document.getElementById('update-btn').addEventListener('click', async () => {
    const updatedContent = document.getElementById('edit-content').value;
    try {
        await setDoc(doc(db, "users", currentUser.uid, "diaries", currentEditId), {
            content: updatedContent,
            timestamp: new Date() // Update timestamp to reflect latest edit
        }, { merge: true });
        
        alert('Entry Updated!');
        showScreen('dashboard-section');
    } catch (error) {
        console.error("Error updating: ", error);
    }
});