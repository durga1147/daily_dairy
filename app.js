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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
    
    const icon = type === 'success' ? 'fa-fountain-pen-nib' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3500); 
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
    if(!email || !password) return showToast('Please enter both identity and passphrase.', 'error');
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => document.getElementById('auth-error').innerText = error.message);
});

document.getElementById('signup-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return showToast('Please enter both identity and passphrase.', 'error');
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

// ---- Settings Logic: Menu Navigation ----

window.openSettingsMenu = async () => {
    try {
        const securityDoc = await getDoc(doc(db, "users", currentUser.uid, "settings", "security"));
        userSecurityData = securityDoc.exists() ? securityDoc.data() : null;
        showScreen('settings-menu-section');
    } catch (error) {
        console.error("Error loading settings: ", error);
        showToast('Failed to load settings.', 'error');
    }
};

window.handleSetPinClick = () => {
    if (userSecurityData && userSecurityData.pin) return showToast('PIN already set. Use Change PIN instead.', 'error');
    showScreen('set-pin-section');
};

window.handleChangePinClick = () => {
    if (!userSecurityData || !userSecurityData.pin) return showToast('No PIN set yet.', 'error');
    showScreen('change-pin-section');
};

// ---- Settings Logic: 3. NEW Forgot / Recover PIN Flow ----

let currentRecoveryMethod = null;

window.handleForgotPinClick = () => {
    if (!userSecurityData || !userSecurityData.pin) return showToast('No PIN set yet.', 'error');
    
    // Initialize the flow: Show choices, hide inputs
    currentRecoveryMethod = null;
    document.getElementById('forgot-title').innerText = 'Recover PIN';
    document.getElementById('recovery-choice-container').classList.remove('hidden');
    document.getElementById('recovery-input-container').classList.add('hidden');
    document.getElementById('reset-pin-fields').classList.add('hidden');
    document.getElementById('reset-action-footer').classList.add('hidden');

    // Set back button to go back to settings menu
    const backBtn = document.getElementById('forgot-back-btn');
    backBtn.onclick = () => showScreen('settings-menu-section');

    showScreen('forgot-pin-section');
};

window.selectRecoveryMethod = (method) => {
    currentRecoveryMethod = method;
    document.getElementById('forgot-title').innerText = 'Verification';
    
    // Hide choices, show input container
    document.getElementById('recovery-choice-container').classList.add('hidden');
    document.getElementById('recovery-input-container').classList.remove('hidden');

    // Show specific method fields
    const questionFields = document.getElementById('recover-question-fields');
    const keyFields = document.getElementById('recover-key-fields');
    if (method === 'question') {
        document.getElementById('recover-question-display').innerText = questionsMap[userSecurityData.securityQuestion];
        questionFields.classList.remove('hidden');
        keyFields.classList.add('hidden');
        document.getElementById('recover-answer').value = '';
    } else {
        questionFields.classList.add('hidden');
        keyFields.classList.remove('hidden');
        document.getElementById('recover-key-input').value = '';
    }

    // Update back button to go back to choice selection
    document.getElementById('forgot-back-btn').onclick = handleForgotPinClick;
};

document.getElementById('verify-recovery-btn').addEventListener('click', () => {
    let verified = false;
    if (currentRecoveryMethod === 'question') {
        const answer = document.getElementById('recover-answer').value.toLowerCase().trim();
        if (!answer) return showToast('Please enter your answer.', 'error');
        if (answer === userSecurityData.securityAnswer) verified = true;
    } else {
        const key = document.getElementById('recover-key-input').value.trim();
        if (!key) return showToast('Please enter recovery key.', 'error');
        if (key === userSecurityData.recoveryKey) verified = true;
    }

    if (verified) {
        // Success: Unlock PIN reset fields
        showToast('Identity verified! Set new PIN below.', 'success');
        document.getElementById('forgot-title').innerText = 'Reset PIN';
        document.getElementById('recovery-input-container').classList.add('hidden');
        document.getElementById('reset-pin-fields').classList.remove('hidden');
        document.getElementById('reset-action-footer').classList.remove('hidden');
        
        // Clear inputs
        document.getElementById('forgot-new-pin').value = '';
        document.getElementById('forgot-confirm-pin').value = '';
        
        // Disable back button during crucial reset phase
        document.getElementById('forgot-back-btn').onclick = () => showToast('Finish resetting PIN or close journal.', 'error');
    } else {
        showToast('Invalid answer or key. Try again.', 'error');
    }
});

document.getElementById('recover-pin-btn').addEventListener('click', async () => {
    const newPin = document.getElementById('forgot-new-pin').value;
    const confirmPin = document.getElementById('forgot-confirm-pin').value;

    if (!newPin || !confirmPin) return showToast('Please enter new PIN.', 'error');
    if (newPin !== confirmPin) return showToast('PINs do not match.', 'error');
    if (newPin.length < 4) return showToast('PIN must be 4 digits.', 'error');

    try {
        await setDoc(doc(db, "users", currentUser.uid, "settings", "security"), { pin: newPin }, { merge: true });
        userSecurityData.pin = newPin; // Update cache
        showToast('PIN successfully reset!', 'success');
        showScreen('settings-menu-section');
    } catch (error) {
        showToast('Failed to reset PIN.', 'error');
    }
});

// ---- Settings Logic: 1. Set New PIN ---- (No changes)

document.getElementById('generate-key-btn').addEventListener('click', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 8; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    document.getElementById('recovery-key').value = key;
});

document.getElementById('copy-key-btn').addEventListener('click', () => {
    const keyInput = document.getElementById('recovery-key');
    if (!keyInput.value) return showToast('Generate a key first!', 'error');
    navigator.clipboard.writeText(keyInput.value).then(() => {
        showToast('Recovery key copied!', 'success');
    }).catch(err => showToast('Failed to copy key.', 'error'));
});

document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const pin = document.getElementById('set-pin').value;
    const confirmPin = document.getElementById('confirm-pin').value;
    const question = document.getElementById('security-question').value;
    const answer = document.getElementById('security-answer').value;
    const recoveryKey = document.getElementById('recovery-key').value;

    if (!pin || !confirmPin || !question || !answer || !recoveryKey) return showToast('Fill all fields.', 'error');
    if (pin !== confirmPin) return showToast('PINs do not match.', 'error');
    if (pin.length < 4) return showToast('PIN must be 4 digits.', 'error');

    try {
        const newData = { pin: pin, securityQuestion: question, securityAnswer: answer.toLowerCase().trim(), recoveryKey: recoveryKey, updatedAt: new Date() };
        await setDoc(doc(db, "users", currentUser.uid, "settings", "security"), newData);
        userSecurityData = newData; 
        showToast('Security setup complete!', 'success');
        showScreen('settings-menu-section');
    } catch (error) {
        showToast('Failed to save settings.', 'error');
    }
});

// ---- Settings Logic: 2. Change PIN ---- (No changes)

document.getElementById('update-pin-btn').addEventListener('click', async () => {
    const oldPin = document.getElementById('old-pin').value;
    const newPin = document.getElementById('new-pin').value;
    const confirmNewPin = document.getElementById('confirm-new-pin').value;

    if (!oldPin || !newPin || !confirmNewPin) return showToast('Fill all fields.', 'error');
    if (oldPin !== userSecurityData.pin) return showToast('Incorrect current PIN.', 'error');
    if (newPin !== confirmNewPin) return showToast('New PINs do not match.', 'error');
    if (newPin.length < 4) return showToast('PIN must be 4 digits.', 'error');

    try {
        await setDoc(doc(db, "users", currentUser.uid, "settings", "security"), { pin: newPin }, { merge: true });
        userSecurityData.pin = newPin; 
        showToast('PIN updated successfully!', 'success');
        showScreen('settings-menu-section');
    } catch (error) {
        showToast('Failed to update PIN.', 'error');
    }
});

// ---- Database Logic: Check Before Write / Write ---- (No changes)

window.checkTodayEntry = async () => {
    const dateStr = getDBDateStr();
    const docRef = doc(db, "users", currentUser.uid, "diaries", dateStr);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) showToast('Entry exists. Try editing.', 'error');
        else showScreen('write-section');
    } catch (error) {
        showToast('Failed to check database.', 'error');
    }
};

document.getElementById('save-btn').addEventListener('click', async () => {
    const content = document.getElementById('diary-content').value;
    if (!content.trim()) return showModal('Hold on!', 'Entry is empty.');
    const dateStr = getDBDateStr();
    try {
        await setDoc(doc(db, "users", currentUser.uid, "diaries", dateStr), { content: content, timestamp: new Date() });
        showToast('Entry Saved!', 'success');
        showScreen('dashboard-section');
    } catch (error) {
        showToast('Failed to save.', 'error');
    }
});

// ---- Database Logic: Access Control / View / Edit / Update ---- (No changes)

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
        showToast('Verification failed.', 'error');
    }
};

window.closePinPrompt = () => {
    document.getElementById('pin-prompt-modal').classList.add('hidden');
    document.getElementById('unlock-pin-input').value = '';
};

document.getElementById('verify-pin-btn').addEventListener('click', () => {
    if (document.getElementById('unlock-pin-input').value === currentCorrectPin) {
        closePinPrompt();
        window.loadEntries(pendingAccessMode);
    } else {
        showToast('Incorrect PIN.', 'error');
        document.getElementById('unlock-pin-input').value = '';
    }
});

window.loadEntries = async (mode) => {
    currentMode = mode;
    document.getElementById('list-title').innerText = mode === 'view' ? 'Archives' : 'Edit Records';
    showScreen('list-section');
    const listEl = document.getElementById('entries-list');
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#6B7280;">Consulting archives...</div>';
    try {
        const q = query(collection(db, "users", currentUser.uid, "diaries"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        listEl.innerHTML = '';
        if(snapshot.empty) listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#6B7280;">No records found.</div>';
        snapshot.forEach(docSnap => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="list-date"><i class="far fa-calendar"></i> ${docSnap.id}</span> 
                            <i class="fas fa-chevron-right" style="color: #D1D5DB;"></i>`;
            li.onclick = () => openEntry(docSnap.id, docSnap.data().content);
            listEl.appendChild(li);
        });
    } catch (error) {
        showToast('Failed to load archives.', 'error');
    }
};

const openEntry = (dateId, content) => {
    if (currentMode === 'view') {
        document.getElementById('view-date-title').innerText = dateId;
        document.getElementById('view-content').innerText = content;
        showScreen('view-detail-section');
    } else {
        currentEditId = dateId;
        document.getElementById('edit-date-title').innerText = `Refining: ${dateId}`;
        document.getElementById('edit-content').value = content;
        showScreen('edit-detail-section');
    }
};

document.getElementById('update-btn').addEventListener('click', async () => {
    const updatedContent = document.getElementById('edit-content').value;
    if (!updatedContent.trim()) return showModal('Wait!', 'Record is blank.');
    try {
        await setDoc(doc(db, "users", currentUser.uid, "diaries", currentEditId), { content: updatedContent, timestamp: new Date() }, { merge: true });
        showToast('Record refined!', 'success');
        showScreen('dashboard-section');
    } catch (error) {
        showToast('Failed to update.', 'error');
    }
});

// ---- Theme Toggle Logic ---- (No changes)

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

// ---- Diary Font Logic ----

const loadSavedFont = () => {
    const savedFont = localStorage.getItem('diary-handwriting') || 'default';
    document.body.setAttribute('data-diary-font', savedFont);
    
    // Highlight the active font card
    document.querySelectorAll('.font-card').forEach(card => {
        card.classList.remove('active-font');
        if(card.getAttribute('data-font') === savedFont) {
            card.classList.add('active-font');
        }
    });
};

// Expose the function to the HTML buttons
window.applyFont = (fontName) => {
    localStorage.setItem('diary-handwriting', fontName);
    loadSavedFont();
    showToast('Diary handwriting updated!', 'success');
};

// Initialize font on app load
loadSavedFont();
