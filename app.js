import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: Replace with your Firebase Project Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzB2dzT4k1yK6nwi55JlaG4Pk20FQprTE",
  authDomain: "personal-diary-app-f9861.firebaseapp.com",
  projectId: "personal-diary-app-f9861",
  storageBucket: "personal-diary-app-f9861.firebasestorage.app",
  messagingSenderId: "12621920736",
  appId: "1:12621920736:web:e1d5eba84bf3b4bbab9385"
};

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
    
    // Aesthetic change: Font Awesome icon selection
    const icon = type === 'success' ? 'fa-fountain-pen-nib' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3500); // Slightly longer toast display
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
    // A more formal date string for the diary title
    return today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const getDBDateStr = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; 
};

// ---- Authentication Logic ----

document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return showToast('Please enter both identity and passphrase.', 'error');
    
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => {
            console.error(error);
            document.getElementById('auth-error').innerText = "Access denied. Verification failed.";
        });
});

document.getElementById('signup-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return showToast('Please enter both identity and passphrase.', 'error');

    createUserWithEmailAndPassword(auth, email, password)
        .catch(error => {
            console.error(error);
            document.getElementById('auth-error').innerText = "Registration blocked. Account already exists or details invalid.";
        });
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
    showToast('The journal is now sealed.', 'success');
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

// ---- Database Logic: Write ----

document.getElementById('save-btn').addEventListener('click', async () => {
    const content = document.getElementById('diary-content').value;
    
    if (!content.trim()) {
        return showModal('Hold, Scribe!', 'Your diary record is incomplete. You cannot seal an empty record.');
    }

    const dateStr = getDBDateStr();
    try {
        await setDoc(doc(db, "users", currentUser.uid, "diaries", dateStr), {
            content: content,
            timestamp: new Date()
        });
        
        showToast('Record officially sealed.', 'success');
        showScreen('dashboard-section');
    } catch (error) {
        console.error("Error saving: ", error);
        showToast('Failed to save record.', 'error');
    }
});

// ---- Database Logic: Fetch List (View/Edit) ----

window.loadEntries = async (mode) => {
    currentMode = mode;
    // Theming titles
    document.getElementById('list-title').innerText = mode === 'view' ? 'Record Archives' : 'Revise Archives';
    showScreen('list-section');
    
    const listEl = document.getElementById('entries-list');
    listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #857262; font-family:Walter Turncoat;">Consulting archives...</div>';

    const q = query(collection(db, "users", currentUser.uid, "diaries"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    
    listEl.innerHTML = '';
    if(snapshot.empty) {
        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #857262; font-family:Walter Turncoat;">The archive is currently empty. Start composing history!</div>';
        return;
    }

    snapshot.forEach(docSnap => {
        const li = document.createElement('li');
        li.className = 'stamp-effect'; // Apply stamp rotation on click
        li.innerHTML = `<span class="list-date"><i class="fas fa-bookmark"></i> ${docSnap.id}</span> 
                        <i class="fas fa-arrow-right" style="color: rgba(124, 79, 52, 0.4);"></i>`;
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
        document.getElementById('edit-date-title').innerText = dateId; // Keeping title cleaner
        document.getElementById('edit-content').value = content;
        showScreen('edit-detail-section');
    }
};

// ---- Database Logic: Update Entry ----

document.getElementById('update-btn').addEventListener('click', async () => {
    const updatedContent = document.getElementById('edit-content').value;
    
    if (!updatedContent.trim()) {
        return showModal('Hold, Scribe!', 'Your record is now blank. You must write history, or go back.');
    }

    try {
        await setDoc(doc(db, "users", currentUser.uid, "diaries", currentEditId), {
            content: updatedContent,
            timestamp: new Date()
        }, { merge: true });
        
        showToast('Record refined and resealed.', 'success');
        showScreen('dashboard-section');
    } catch (error) {
        console.error("Error updating: ", error);
        showToast('Failed to refine record.', 'error');
    }
});
