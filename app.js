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
let currentMode = ''; 
let currentEditId = ''; 

// ---- UI Custom Popups & Toasts ----

window.showModal = (title, message) => {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    document.getElementById('custom-modal').classList.remove('hidden');
};

window.closeModal = () => {
    document.getElementById('custom-modal').classList.add('hidden');
};

window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error-toast' : ''}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
};

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
    return today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const getDBDateStr = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Used as Document ID (YYYY-MM-DD)
};

// ---- Authentication Logic ----

document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return showToast('Please enter both email and password.', 'error');
    
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => document.getElementById('auth-error').innerText = error.message);
});

document.getElementById('signup-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return showToast('Please enter both email and password.', 'error');

    createUserWithEmailAndPassword(auth, email, password)
        .catch(error => document.getElementById('auth-error').innerText = error.message);
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
    showToast('Signed out successfully.', 'success');
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showScreen('dashboard-section');
    } else {
        currentUser = null;
        showScreen('auth-section');
    }
});

// ---- Database Logic: Check Before Write ----

window.checkTodayEntry = async () => {
    const dateStr = getDBDateStr();
    const docRef = doc(db, "users", currentUser.uid, "diaries", dateStr);
    
    try {
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            // Block access and show toaster
            showToast('Entry for today already exists. Try editing the existing one.', 'error');
        } else {
            // Allow access to the write screen
            showScreen('write-section');
        }
    } catch (error) {
        console.error("Error checking entry: ", error);
        showToast('Failed to check database.', 'error');
    }
};

// ---- Database Logic: Write ----

document.getElementById('save-btn').addEventListener('click', async () => {
    const content = document.getElementById('diary-content').value;
    
    if (!content.trim()) {
        return showModal('Hold on!', 'Your diary entry is empty. Please write something before saving.');
    }

    const dateStr = getDBDateStr();
    try {
        await setDoc(doc(db, "users", currentUser.uid, "diaries", dateStr), {
            content: content,
            timestamp: new Date()
        });
        
        showToast('Entry Saved Successfully!', 'success');
        showScreen('dashboard-section');
    } catch (error) {
        console.error("Error saving: ", error);
        showToast('Failed to save entry.', 'error');
    }
});

// ---- Database Logic: Fetch List (View/Edit) ----

window.loadEntries = async (mode) => {
    currentMode = mode;
    document.getElementById('list-title').innerText = mode === 'view' ? 'Past Diaries' : 'Edit Records';
    showScreen('list-section');
    
    const listEl = document.getElementById('entries-list');
    listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #6B7280;">Loading entries...</div>';

    const q = query(collection(db, "users", currentUser.uid, "diaries"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    
    listEl.innerHTML = '';
    if(snapshot.empty) {
        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #6B7280;">No entries found. Start writing!</div>';
        return;
    }

    snapshot.forEach(docSnap => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="list-date"><i class="far fa-calendar"></i> ${docSnap.id}</span> 
                        <i class="fas fa-chevron-right" style="color: #D1D5DB;"></i>`;
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
    
    if (!updatedContent.trim()) {
        return showModal('Wait!', 'You cannot save an empty entry. Write something or go back.');
    }

    try {
        await setDoc(doc(db, "users", currentUser.uid, "diaries", currentEditId), {
            content: updatedContent,
            timestamp: new Date()
        }, { merge: true });
        
        showToast('Entry Updated Successfully!', 'success');
        showScreen('dashboard-section');
    } catch (error) {
        console.error("Error updating: ", error);
        showToast('Failed to update entry.', 'error');
    }
});

// ---- Theme Toggle Logic ----

const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = themeToggleBtn.querySelector('i');

// 1. Check browser storage to remember user preference on load
if (localStorage.getItem('diary-theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon.classList.replace('fa-moon', 'fa-sun');
}

// 2. Listen for clicks on the toggle button
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    
    if (document.body.classList.contains('dark-mode')) {
        // Switch to Dark
        localStorage.setItem('diary-theme', 'dark');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
        // Switch to Light
        localStorage.setItem('diary-theme', 'light');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
});
