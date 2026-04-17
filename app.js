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

// Global State Variables
let currentUser = null;
let currentMode = ''; 
let currentEditId = ''; 
let userSecurityData = null;
let pendingAccessMode = '';
let currentCorrectPin = '';

const questionsMap = {
    'pet': "What was your first pet's name?",
    'school': "What was the name of your elementary school?",
    'city': "In what city were you born?",
    'friend': "What is your childhood best friend's name?"
};

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
    return today.toISOString().split('T')[0]; 
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

// ---- Settings Logic: Menu & Navigation ----

window.openSettingsMenu = async () => {
    try {
        const securityDoc = await getDoc(doc(db, "users", currentUser.uid, "settings", "security"));
        if (securityDoc.exists()) {
            userSecurityData = securityDoc.data();
        } else {
            userSecurityData = null;
        }
        showScreen('settings-menu-section');
    } catch (error) {
        console.error("Error loading settings: ", error);
        showToast('Failed to load settings.', 'error');
    }
};

window.handleSetPinClick = () => {
    if (userSecurityData && userSecurityData.pin) {
        showToast('Security PIN is already set. Use Change PIN instead.', 'error');
    } else {
        showScreen('set-pin-section');
    }
};

window.handleChangePinClick = () => {
    if (!userSecurityData || !userSecurityData.pin) {
        showToast('No PIN set yet. Please Set PIN first.', 'error');
    } else {
        document.getElementById('old-pin').value = '';
        document.getElementById('new-pin').value = '';
        document.getElementById('confirm-new-pin').value = '';
        showScreen('change-pin-section');
    }
};

window.handleForgotPinClick = () => {
    if (!userSecurityData || !userSecurityData.pin) {
        showToast('No PIN set yet. Please Set PIN first.', 'error');
    } else {
        document.getElementById('recover-question-display').innerText = questionsMap[userSecurityData.securityQuestion];
        document.getElementById('recover-answer').value = '';
        document.getElementById('recover-key-input').value = '';
        document.getElementById('forgot-new-pin').value = '';
        document.getElementById('forgot-confirm-pin').value = '';
        showScreen('forgot-pin-section');
    }
};

// ---- Settings Logic: 1. Set New PIN ----

document.getElementById('generate-key-btn').addEventListener('click', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 8; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('recovery-key').value = key;
});

document.getElementById('copy-key-btn').addEventListener('click', () => {
    const keyInput = document.getElementById('recovery-key');
    if (!keyInput.value) return showToast('Please generate a key first!', 'error');
    navigator.clipboard.writeText(keyInput.value).then(() => {
        showToast('Recovery key copied to clipboard!', 'success');
    }).catch(err => showToast('Failed to copy key.', 'error'));
});

document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const pin = document.getElementById('set-pin').value;
    const confirmPin = document.getElementById('confirm-pin').value;
    const question = document.getElementById('security-question').value;
    const answer = document.getElementById('security-answer').value;
    const recoveryKey = document.getElementById('recovery-key').value;

    if (!pin || !confirmPin || !question || !answer || !recoveryKey) return showToast('Please fill all fields.', 'error');
    if (pin !== confirmPin) return showToast('PINs do not match.', 'error');
    if (pin.length < 4) return showToast('PIN must be exactly 4 digits.', 'error');

    try {
        const newData = {
            pin: pin,
            securityQuestion: question,
            securityAnswer: answer.toLowerCase().trim(),
            recoveryKey: recoveryKey,
            updatedAt: new Date()
        };
        await setDoc(doc(db, "users", currentUser.uid, "settings", "security"), newData);
        userSecurityData = newData; 
        
        showToast('Security setup complete!', 'success');
        showScreen('settings-menu-section');
    } catch (error) {
        console.error("Error saving settings: ", error);
        showToast('Failed to save security settings.', 'error');
    }
});

// ---- Settings Logic: 2. Change PIN ----

document.getElementById('update-pin-btn').addEventListener('click', async () => {
    const oldPin = document.getElementById('old-pin').value;
    const newPin = document.getElementById('new-pin').value;
    const confirmNewPin = document.getElementById('confirm-new-pin').value;

    if (!oldPin || !newPin || !confirmNewPin) return showToast('Please fill all fields.', 'error');
    if (oldPin !== userSecurityData.pin) return showToast('Incorrect current PIN.', 'error');
    if (newPin !== confirmNewPin) return showToast('New PINs do not match.', 'error');
    if (newPin.length < 4) return showToast('New PIN must be 4 digits.', 'error');

    try {
        await setDoc(doc(db, "users", currentUser.uid, "settings", "security"), { pin: newPin }, { merge: true });
        userSecurityData.pin = newPin; 
        showToast('PIN successfully updated!', 'success');
        showScreen('settings-menu-section');
    } catch (error) {
        showToast('Failed to update PIN.', 'error');
    }
});

// ---- Settings Logic: 3. Forgot / Recover PIN ----

document.getElementById('recovery-method-select').addEventListener('change', (e) => {
    if (e.target.value === 'question') {
        document.getElementById('recover-question-container').classList.remove('hidden');
        document.getElementById('recover-key-container').classList.add('hidden');
    } else {
        document.getElementById('recover-question-container').classList.add('hidden');
        document.getElementById('recover-key-container').classList.remove('hidden');
    }
});

document.getElementById('recover-pin-btn').addEventListener('click', async () => {
    const method = document.getElementById('recovery-method-select').value;
    const newPin = document.getElementById('forgot-new-pin').value;
    const confirmPin = document.getElementById('forgot-confirm-pin').value;

    if (!newPin || !confirmPin) return showToast('Please enter a new PIN.', 'error');
    if (newPin !== confirmPin) return showToast('New PINs do not match.', 'error');
    if (newPin.length < 4) return showToast('New PIN must be 4 digits.', 'error');

    if (method === 'question') {
        const answer = document.getElementById('recover-answer').value.toLowerCase().trim();
        if (answer !== userSecurityData.securityAnswer) return showToast('Incorrect security answer.', 'error');
    } else {
        const key = document.getElementById('recover-key-input').value.trim();
        if (key !== userSecurityData.recoveryKey) return showToast('Invalid Recovery Key.', 'error');
    }

    try {
        await setDoc(doc(db, "users", currentUser.uid, "settings", "security"), { pin: newPin }, { merge: true });
        userSecurityData.pin = newPin; 
        showToast('PIN successfully recovered and reset!', 'success');
        showScreen('settings-menu-section');
    } catch (error) {
        showToast('Failed to reset PIN.', 'error');
    }
});

// ---- Database Logic: Check Before Write ----

window.checkTodayEntry = async () => {
    const dateStr = getDBDateStr();
    const docRef = doc(db, "users", currentUser.uid, "diaries", dateStr);
    
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            showToast('Entry for today already exists. Try editing the existing one.', 'error');
        } else {
            showScreen('write-section');
        }
    } catch (error) {
        console.error("Error checking entry: ", error);
        showToast('Failed to check database.', 'error');
    }
};

// ---- Database Logic: PIN Access Control ----

window.attemptAccess = async (mode) => {
    try {
        const securityDoc = await getDoc(doc(db, "users", currentUser.uid, "settings", "security"));
        
        if (securityDoc.exists() && securityDoc.data().pin) {
            pendingAccessMode = mode;
            currentCorrectPin = securityDoc.data().pin;
            document.getElementById('unlock-pin-input').value = '';
            document.getElementById('pin-prompt-modal').classList.remove('hidden');
        } else {
            window.loadEntries(mode);
        }
    } catch (error) {
        console.error("Error checking security: ", error);
        showToast('Failed to verify access.', 'error');
    }
};

window.closePinPrompt = () => {
    document.getElementById('pin-prompt-modal').classList.add('hidden');
    document.getElementById('unlock-pin-input').value = '';
};

document.getElementById('verify-pin-btn').addEventListener('click', () => {
    const enteredPin = document.getElementById('unlock-pin-input').value;
    if (enteredPin === currentCorrectPin) {
        closePinPrompt();
        window.loadEntries(pendingAccessMode);
    } else {
        showToast('Incorrect PIN.', 'error');
        document.getElementById('unlock-pin-input').value = '';
    }
});

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

if (localStorage.getItem('diary-theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon.classList.replace('fa-moon', 'fa-sun');
}

themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('diary-theme', 'dark');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
        localStorage.setItem('diary-theme', 'light');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
});
