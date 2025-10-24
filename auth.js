// ============================
// AUTHENTIFICATION ET GESTION DES DONNÉES EN LIGNE
// ============================

window.appData = { teams: [], currentTeamId: null, lastFaultAction: null, lastPointAction: null };
let currentUser = null; // Stocke l'objet utilisateur Firebase si connecté, sinon null
let firestoreListener = null; // Référence à la fonction pour arrêter l'écouteur onSnapshot

/**
 * Initialise Firebase Auth et écoute les changements d'état de connexion.
 * Appelée lorsque l'événement 'firebaseReady' est reçu depuis index.html.
 */
function initializeApp() {
    console.log("Setting up auth state listener...");
    window.onAuthStateChanged(window.auth, (user) => {
        if (user) {
            // Un utilisateur s'est connecté (ou était déjà connecté)
            console.log("User is signed in:", user.uid, user.email);
            currentUser = user; // Stocke l'utilisateur courant globalement

            // Gérer la synchronisation des données APRÈS que le DOM soit prêt ET que les données locales soient chargées
            ensureDOMLoaded(() => handleUserLogin(user));

        } else {
            // L'utilisateur s'est déconnecté ou n'était pas connecté au démarrage
            console.log("User is signed out.");
            currentUser = null; // Réinitialise l'utilisateur courant
            if (firestoreListener) {
                console.log("Unsubscribing from Firestore listener.");
                firestoreListener(); // Arrête l'écoute des données en ligne
                firestoreListener = null;
            }
            // Mettre à jour l'interface pour afficher le bouton "Connexion / Inscription"
            updateAuthUI(null);

             // S'assurer que l'application utilise les données locales après déconnexion
             // Attendre que le DOM soit prêt pour manipuler les données et l'UI.
             ensureDOMLoaded(() => {
                 loadLocalData(); // Recharge explicitement les données locales
                 renderAllForCurrentTeam(); // Rafraîchit l'UI avec les données locales
             });
        }
    });
}

/**
 * Sauvegarde les données globales `appData`.
 * Systématiquement dans localStorage.
 * Dans Firestore si un utilisateur est connecté (`currentUser` n'est pas null).
 */
async function saveData() {
    // 1. Sauvegarde systématiquement en local (localStorage)
    try {
        localStorage.setItem('volleyAppData', JSON.stringify(appData));
        // console.log("Data saved locally.");
    } catch (e) {
        console.error("Error saving data to localStorage:", e);
    }

    // 2. Sauvegarde dans Firestore UNIQUEMENT si un utilisateur est connecté
    if (currentUser) {
        try {
            const userDocRef = window.doc(window.db, `users/${currentUser.uid}/appData`, 'data');
            await window.setDoc(userDocRef, JSON.parse(JSON.stringify(appData)));
            // console.log("Data saved to Firestore.");
        } catch (error) {
            console.error("Error saving data to Firestore:", error);
        }
    } else {
        // console.log("User not logged in, skipping Firestore save.");
    }
}

/**
 * Charge les données depuis localStorage.
 * Appelée au démarrage de l'application (via DOMContentLoaded) et après déconnexion.
 */
function loadLocalData() {
    console.log("Loading local data...");
    const savedData = localStorage.getItem('volleyAppData');
    if (savedData) {
        try {
            appData = JSON.parse(savedData);
            migrateDataStructure(); // Vérifie et met à jour la structure des données
            console.log("Data loaded from localStorage.");
        } catch (e) {
            console.error("Error parsing local data:", e);
            appData = { teams: [], currentTeamId: null, lastFaultAction: null, lastPointAction: null };
        }
    } else {
        appData = { teams: [], currentTeamId: null, lastFaultAction: null, lastPointAction: null };
        console.log("No local data found. Initializing new structure.");
    }
    // Assure que currentTeamId est valide ou null
    if (appData.currentTeamId && (!appData.teams || !appData.teams.find(t => t.id === appData.currentTeamId))) {
        appData.currentTeamId = appData.teams && appData.teams.length > 0 ? appData.teams[0].id : null;
    }
}

/**
 * Gère la logique de synchronisation des données lorsqu'un utilisateur se connecte.
 * Compare les données locales et celles de Firestore et propose une action à l'utilisateur si besoin.
 * @param {object} user - L'objet utilisateur Firebase.
 */
async function handleUserLogin(user) {
    
    // 1. Tenter de récupérer le profil (Prénom/Nom) AVANT tout
    let profileData = null;
    try {
        const profileDocRef = window.doc(window.db, `users/${user.uid}/profile`, 'data');
        const profileDocSnap = await window.getDoc(profileDocRef);
        if (profileDocSnap.exists()) {
            profileData = profileDocSnap.data();
        }
    } catch (profileError) {
        console.warn("Could not fetch user profile:", profileError);
        // Ce n'est pas grave, on utilisera l'email comme fallback
    }

    // 2. Mettre à jour l'interface avec les infos du profil (ou l'email)
    updateAuthUI(user, profileData); 
   
    const userDocRef = window.doc(window.db, `users/${user.uid}/appData`, 'data');
    let remoteData = null;
    let remoteDataExists = false;
    let syncNeeded = false; // Flag pour savoir si un re-rendu est nécessaire

    // Tente de lire les données stockées en ligne
    try {
        const docSnap = await window.getDoc(userDocRef);
        if (docSnap.exists()) {
            remoteData = docSnap.data();
            remoteDataExists = true;
            console.log("Remote data found for user.");
        } else {
            console.log("No remote data found for user.");
        }
    } catch (error) {
        console.error("Error fetching remote data:", error);
        alert("Impossible de récupérer les données en ligne. L'application continue en mode local.");
        setupRealtimeListener(user); // Tente quand même de lancer l'écouteur
        return; // Stoppe la logique de synchronisation
    }

    // Récupère les données locales actuelles (déjà dans appData)
    const localDataString = localStorage.getItem('volleyAppData'); // Pour comparaison
    const localDataExists = !!localDataString;

    // --- Logique de synchronisation ---
    if (remoteDataExists && localDataExists) {
        // CAS 1 : Données locales ET en ligne existent
        if (localDataString !== JSON.stringify(remoteData)) {
            console.log("Conflict detected: Local and remote data differ.");
            if (confirm("Des données différentes existent en local et en ligne.\n\n- OK : Utiliser les données EN LIGNE (écrase le local).\n- Annuler : Utiliser les données LOCALES (écrase la sauvegarde en ligne).")) {
                await pullDataFromFirestore(remoteData); // Remplacer local par en ligne
                syncNeeded = true; // Indique qu'il faut rafraîchir l'UI
            } else {
                await pushDataToFirestore(); // Remplacer en ligne par local
                // Pas besoin de syncNeeded=true car les données en mémoire sont déjà les bonnes
            }
        } else {
            console.log("Local and remote data are identical.");
            // Assure que appData est bien la version correcte (au cas où remoteData a une structure plus récente)
            if (remoteData) { // Vérifie que remoteData n'est pas null
               appData = remoteData;
               migrateDataStructure(); // Applique les migrations locales si besoin
            }
        }
    } else if (localDataExists) {
        // CAS 2 : Données locales uniquement -> On les pousse en ligne
        console.log("Local data found, pushing to Firestore.");
        await pushDataToFirestore();
    } else if (remoteDataExists) {
        // CAS 3 : Données en ligne uniquement -> On les charge en local
        console.log("Remote data found, pulling to local.");
        await pullDataFromFirestore(remoteData);
        syncNeeded = true; // Indique qu'il faut rafraîchir l'UI
    } else {
        // CAS 4 : Aucune donnée nulle part -> On pousse la structure locale vide en ligne
        console.log("No local or remote data. Saving default structure online.");
        await pushDataToFirestore();
    }

    // Lance l'écoute en temps réel pour les futures modifications
    setupRealtimeListener(user);

    // Rafraîchit l'interface SEULEMENT si les données locales ont été modifiées par la synchro
    if (syncNeeded) {
        console.log("Rendering UI after data sync.");
        renderAllForCurrentTeam();
    }
}

/**
 * Sauvegarde les données locales actuelles (`appData`) dans Firestore.
 */
async function pushDataToFirestore() {
    if (!currentUser) return; // Sécurité
    console.log("Pushing local data to Firestore...");
    try {
        const userDocRef = window.doc(window.db, `users/${currentUser.uid}/appData`, 'data');
        await window.setDoc(userDocRef, JSON.parse(JSON.stringify(appData)));
        console.log("Push successful.");
    } catch (error) {
        console.error("Error pushing data to Firestore:", error);
    }
}

/**
 * Met à jour la variable globale `appData` et `localStorage` avec les données venues de Firestore.
 * @param {object} remoteData - Les données récupérées de Firestore.
 */
async function pullDataFromFirestore(remoteData) {
    console.log("Pulling data from Firestore...");
    appData = remoteData; // Remplace les données locales en mémoire
    migrateDataStructure(); // Applique les migrations si nécessaire sur les données tirées
    try {
        // Met à jour la copie locale dans localStorage
        localStorage.setItem('volleyAppData', JSON.stringify(appData));
        console.log("Local storage updated with Firestore data.");
    } catch (e) {
        console.error("Error updating localStorage after pull:", e);
    }
}

/**
 * Met en place l'écouteur Firestore pour les mises à jour en temps réel.
 * @param {object} user - L'objet utilisateur Firebase.
 */
function setupRealtimeListener(user) {
    if (firestoreListener) {
        console.log("Unsubscribing from previous listener.");
        firestoreListener();
    }
    const userDocRef = window.doc(window.db, `users/${user.uid}/appData`, 'data');
    console.log("Setting up Firestore real-time listener for user:", user.uid);
    firestoreListener = window.onSnapshot(userDocRef, (docSnap) => {
        if (!currentUser || currentUser.uid !== user.uid) {
            console.log("Snapshot received but user changed or logged out. Ignoring.");
            if (firestoreListener) firestoreListener();
            firestoreListener = null;
            return;
        }

        if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            if (JSON.stringify(appData) !== JSON.stringify(firestoreData)) {
                console.log("Realtime update received. Updating local state.");
                appData = JSON.parse(JSON.stringify(firestoreData));
                migrateDataStructure();
                localStorage.setItem('volleyAppData', JSON.stringify(appData));
                renderAllForCurrentTeam(); // Rafraîchit toute l'interface
            }
        } else {
             console.warn("Firestore document deleted externally. Resetting local data.");
             appData = { teams: [], currentTeamId: null, lastFaultAction: null, lastPointAction: null };
             localStorage.removeItem('volleyAppData');
             renderAllForCurrentTeam();
        }
    }, (error) => {
        console.error("Error in Firestore listener:", error);
    });
}

/**
 * Met à jour l'interface utilisateur pour afficher l'état de connexion.
 * @param {object|null} user - L'objet utilisateur Firebase ou null si déconnecté.
 */
function updateAuthUI(user, profileData = null) { // Signature modifiée
    const loggedInDiv = document.getElementById('auth-logged-in');
    const loggedOutDiv = document.getElementById('auth-logged-out');
    const userEmailDisplay = document.getElementById('user-email-display');
    const greetingLabel = document.getElementById('auth-greeting-label'); // Récupération du label

    if (!loggedInDiv || !loggedOutDiv || !userEmailDisplay || !greetingLabel) {
        // Tenter de le faire plus tard si le DOM n'est pas prêt
        if (document.readyState === 'loading') {
            // On doit wrapper l'appel pour inclure profileData
            document.addEventListener('DOMContentLoaded', () => updateAuthUI(user, profileData), { once: true });
        } else {
            console.warn("Auth UI elements not found.");
        }
        return;
    }

    if (user) {
        loggedInDiv.classList.remove('hidden');
        loggedOutDiv.classList.add('hidden');

        // NOUVELLE LOGIQUE D'AFFICHAGE
        if (profileData && profileData.firstname) {
            // Cas 1: On a le prénom
            userEmailDisplay.textContent = `Bonjour ${profileData.firstname}`;
            greetingLabel.classList.add('hidden'); // Cache "Connecté en tant que :"
        } else {
            // Cas 2: Fallback sur l'email (vieux comptes)
            userEmailDisplay.textContent = user.email;
            greetingLabel.classList.remove('hidden'); // Montre "Connecté en tant que :"
        }

    } else {
        // Cas déconnecté (inchangé)
        loggedInDiv.classList.add('hidden');
        loggedOutDiv.classList.remove('hidden');
        userEmailDisplay.textContent = '';
        greetingLabel.classList.remove('hidden'); // Ré-affiche le label pour la prochaine connexion
    }
}

let isLoginMode = true; // Pour basculer entre Connexion et Inscription dans la modale

/** Ouvre la modale d'authentification (en mode connexion par défaut). */
function openAuthModal() {
    isLoginMode = false; // Sera inversé par toggleAuthMode pour démarrer en mode Connexion
    toggleAuthMode(); // Configure l'affichage et les actions initiales
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    if(emailInput) emailInput.value = '';
    if(passwordInput) passwordInput.value = '';
    document.getElementById('authModal').classList.remove('hidden');
}

/** Bascule l'affichage et les actions de la modale entre Connexion et Inscription. */
function toggleAuthMode() {
    isLoginMode = !isLoginMode; // Inverse le mode actuel
    const title = document.getElementById('auth-title');
    const actionButton = document.getElementById('auth-action-button');
    const toggleLink = document.getElementById('auth-toggle-link');
    
    // Récupération des nouveaux éléments
    const signupFields = document.getElementById('signup-fields');
    const forgotPasswordLink = document.getElementById('forgot-password-link');

    if (isLoginMode) {
        title.textContent = "Connexion";
        actionButton.textContent = "Se connecter";
        actionButton.onclick = handleLogIn;
        toggleLink.textContent = "Pas encore de compte ? S'inscrire";
        
        // Cacher les champs d'inscription, montrer le mot de passe oublié
        if(signupFields) signupFields.classList.add('hidden');
        if(forgotPasswordLink) forgotPasswordLink.classList.remove('hidden');
    } else {
        title.textContent = "Inscription";
        actionButton.textContent = "Créer un compte";
        actionButton.onclick = handleSignUp;
        toggleLink.textContent = "Déjà un compte ? Se connecter";
        
        // Montrer les champs d'inscription, cacher le mot de passe oublié
        if(signupFields) signupFields.classList.remove('hidden');
        if(forgotPasswordLink) forgotPasswordLink.classList.add('hidden');
    }
}

/** Gère la tentative d'inscription (création de compte). */
async function handleSignUp() {
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const firstnameInput = document.getElementById('auth-firstname'); // AJOUT
    const lastnameInput = document.getElementById('auth-lastname');   // AJOUT

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const firstname = firstnameInput.value.trim(); // AJOUT
    const lastname = lastnameInput.value.trim();   // AJOUT

    // Validation des nouveaux champs
    if (!firstname || !lastname) {
        alert("Veuillez entrer votre prénom et votre nom.");
        return;
    }
    if (!email || !password) { 
        alert("Veuillez entrer un email et un mot de passe."); 
        return; 
    }

    try {
        // 1. Créer l'utilisateur
        const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, password);
        const user = userCredential.user;
        
        // 2. Sauvegarder le profil (Prénom/Nom) dans un document séparé
        try {
            const profileDocRef = window.doc(window.db, `users/${user.uid}/profile`, 'data');
            await window.setDoc(profileDocRef, { 
                firstname: firstname, 
                lastname: lastname 
            });
            console.log("User profile created in Firestore.");
        } catch (profileError) {
            console.error("Error creating user profile in Firestore:", profileError);
            // L'utilisateur est créé, mais le profil a échoué.
            // On peut continuer, l'accueil affichera l'email.
        }

        // Le onAuthStateChanged va détecter le nouvel utilisateur et déclencher handleUserLogin
        closeModal('authModal');
    } catch (error) {
        console.error("Sign up error:", error);
        alert("Erreur d'inscription : " + mapFirebaseAuthError(error));
    }
}

/** Gère la tentative de connexion. */
async function handleLogIn() {
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) { alert("Veuillez entrer un email et un mot de passe."); return; }

    try {
        await window.signInWithEmailAndPassword(window.auth, email, password);
        // Le onAuthStateChanged va détecter le nouvel utilisateur et déclencher handleUserLogin
        closeModal('authModal');
    } catch (error) {
        console.error("Log in error:", error);
        alert("Erreur de connexion : " + mapFirebaseAuthError(error));
    }
}

/** Gère la déconnexion de l'utilisateur. */
async function handleLogOut() {
    if (confirm("Voulez-vous vous déconnecter ? Les données locales seront conservées mais ne seront plus synchronisées avec votre compte en ligne.")) {
        try {
            await window.signOut(window.auth);
            // Le onAuthStateChanged va détecter la déconnexion et s'occuper du reste
        } catch (error) {
            console.error("Log out error:", error);
            alert("Erreur de déconnexion : " + error.message);
        }
    }
}

/**
 * Gère la demande de réinitialisation de mot de passe.
 */
async function handlePasswordReset() {
    const emailInput = document.getElementById('auth-email');
    const email = emailInput.value.trim();

    if (!email) {
        alert("Veuillez saisir votre adresse email dans le champ 'Email' pour réinitialiser votre mot de passe.");
        return;
    }

    try {
        await window.sendPasswordResetEmail(window.auth, email);
        alert("Un email de réinitialisation de mot de passe a été envoyé à votre adresse. Veuillez vérifier votre boîte de réception (et vos spams).");
        closeModal('authModal');
    } catch (error) {
        console.error("Password reset error:", error);
        alert("Erreur lors de l'envoi de l'email : " + mapFirebaseAuthError(error));
    }
}

/**
 * Fonction utilitaire pour traduire les codes d'erreur Firebase Auth en messages plus clairs.
 */
function mapFirebaseAuthError(error) {
    switch (error.code) {
        case 'auth/invalid-email': return "L'adresse email n'est pas valide.";
        case 'auth/user-disabled': return "Ce compte utilisateur a été désactivé.";
        case 'auth/user-not-found': return "Aucun compte trouvé pour cet email.";
        case 'auth/wrong-password': return "Mot de passe incorrect.";
        case 'auth/email-already-in-use': return "Cette adresse email est déjà utilisée par un autre compte.";
        case 'auth/weak-password': return "Le mot de passe est trop faible (minimum 6 caractères).";
        case 'auth/operation-not-allowed': return "La connexion par email/mot de passe n'est pas activée.";
        case 'auth/network-request-failed': return "Erreur réseau. Vérifiez votre connexion internet.";
        default: return error.message;
    }
}

/**
 * Fonction utilitaire pour s'assurer que le DOM est chargé avant d'exécuter une fonction.
 * @param {Function} callback - La fonction à exécuter.
 */
function ensureDOMLoaded(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
        callback();
    }
}

// La fonction migrateDataStructure reste nécessaire car appelée par loadLocalData et pullDataFromFirestore
function migrateDataStructure() {
    if (!appData) appData = { teams: [], currentTeamId: null, lastFaultAction: null, lastPointAction: null };
    appData.teams = appData.teams || [];
    appData.currentTeamId = appData.currentTeamId || null;
    appData.lastFaultAction = appData.lastFaultAction || null;
    appData.lastPointAction = appData.lastPointAction || null;

    appData.teams.forEach(team => {
        team.players = team.players || [];
        team.matches = team.matches || [];
        team.courtPositions = team.courtPositions || {};
        if (typeof team.season === 'undefined') team.season = '';

        team.matches.forEach(match => {
            if (!match.score) match.score = { myTeam: '', opponent: '', sets: Array(5).fill(null).map(() => ({ myTeam: '', opponent: '' })) };
            if (!match.score.sets || !Array.isArray(match.score.sets) || match.score.sets.length !== 5) {
                const validSets = Array.isArray(match.score.sets) ? match.score.sets : [];
                match.score.sets = Array(5).fill(null).map((_, i) => validSets[i] || { myTeam: '', opponent: '' });
            }
             match.score.sets = match.score.sets.map(s => (s && typeof s === 'object' ? s : { myTeam: '', opponent: '' })); // Ensure sets are objects

            if (typeof match.forfeitStatus === 'undefined') match.forfeitStatus = 'none';
            if (typeof match.detailMode === 'undefined') match.detailMode = true;
            match.present = match.present || [];
            match.played = match.played || [];
            match.substitutions = match.substitutions || {};
            match.faults = match.faults || {};
            match.points = match.points || {};
        });
    });
    if (appData.currentTeamId && (!appData.teams || !appData.teams.find(t => t.id === appData.currentTeamId))) {
        appData.currentTeamId = appData.teams && appData.teams.length > 0 ? appData.teams[0].id : null;
    }
}

