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
            // Partie connexion (inchangée)
            console.log("User is signed in:", user.uid, user.email);
            currentUser = user;
            ensureDOMLoaded(() => handleUserLogin(user));

        } else {
           
            console.log("onAuthStateChanged detected sign out OR initial load as logged out.");
            currentUser = null;
            updateAuthUI(null);

            // Sécurité: re-vérifie si l'écouteur doit être détaché
            if (firestoreListener) {
                console.warn("onAuthStateChanged: Firestore listener was still active. Detaching now.");
                firestoreListener();
                firestoreListener = null;
            }

            // Charge et affiche les données locales
            console.log("onAuthStateChanged (logged out): ===> STEP 1: Calling loadLocalData().");
            loadLocalData(); // Met à jour window.appData
            // Log DANS loadLocalData va indiquer si des données ont été trouvées

            console.log("onAuthStateChanged (logged out): ===> STEP 2: Calling renderAllForCurrentTeam().");
            renderAllForCurrentTeam(); // Affiche l'interface basée sur window.appData
            console.log("onAuthStateChanged (logged out): ===> STEP 3: Render complete.");
           
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
 * Appelée au démarrage (si déconnecté) et après déconnexion.
 */
function loadLocalData() {
    console.log("loadLocalData: Attempting to load data from localStorage key 'volleyAppData'.");
    // Réinitialise d'abord pour être sûr
    window.appData = { teams: [], currentTeamId: null, lastFaultAction: null, lastPointAction: null };
    
    const savedData = localStorage.getItem('volleyAppData');
    
    if (savedData) {
        console.log("loadLocalData: Found data in localStorage. Attempting to parse...");
        // Loggue les premières centaines de caractères pour voir si ça ressemble aux données
        console.log("loadLocalData: Raw data starts with:", savedData.substring(0, 200)); 
        try {
            window.appData = JSON.parse(savedData);
            migrateDataStructure(); // Vérifie et met à jour la structure
            console.log("loadLocalData: SUCCESS - Data parsed and loaded into window.appData.");
            // Loggue le nombre d'équipes chargées
            console.log("loadLocalData: Number of teams loaded:", window.appData?.teams?.length || 0);
        } catch (e) {
            console.error("loadLocalData: ERROR parsing local data:", e);
            console.log("loadLocalData: Resetting window.appData due to parsing error.");
            window.appData = { teams: [], currentTeamId: null, lastFaultAction: null, lastPointAction: null };
        }
    } else {
        console.log("loadLocalData: No data found in localStorage. Initializing empty structure in window.appData.");
        window.appData = { teams: [], currentTeamId: null, lastFaultAction: null, lastPointAction: null };
    }
    // Assure que currentTeamId est valide (inchangé)
    if (window.appData.currentTeamId && (!window.appData.teams || !window.appData.teams.find(t => t.id === window.appData.currentTeamId))) {
        window.appData.currentTeamId = window.appData.teams && window.appData.teams.length > 0 ? window.appData.teams[0].id : null;
    }
    console.log("loadLocalData: Function finished. Current team ID:", window.appData.currentTeamId);
}


/**
 * Gère la logique de synchronisation des données lorsqu'un utilisateur se connecte.
 * PRIORITÉ AUX DONNÉES EN LIGNE en cas de conflit.
 * @param {object} user - L'objet utilisateur Firebase.
 */
async function handleUserLogin(user) {

    // 1. Tenter de récupérer le profil (Prénom/Nom ET statut admin)
    let profileData = null;
    let isAdmin = false; // Par défaut, non admin
    console.log(`handleUserLogin: Attempting to fetch profile for user ${user.uid}...`); // Log ajouté
    try {
        const profileDocRef = window.doc(window.db, `users/${user.uid}/profile`, 'data');
        const profileDocSnap = await window.getDoc(profileDocRef); // Attend que getDoc finisse

        // CE BLOC EST IMPORTANT
        if (profileDocSnap.exists()) { // Vérifie SI le document existe AVANT d'accéder aux données
            profileData = profileDocSnap.data(); // Récupère les données
            // Vérifie si le champ isAdmin existe et est Boolean true
            isAdmin = profileData.isAdmin === true;
            console.log(`handleUserLogin: User profile loaded. isAdmin status: ${isAdmin}`);
        } else {
             // S'exécute si le document profil n'existe pas
             console.log("handleUserLogin: User profile document does not exist.");
             // profileData reste null, isAdmin reste false
        }
        // FIN DU BLOC IMPORTANT

    } catch (profileError) {
        // S'exécute si getDoc échoue (ex: règles Firestore incorrectes, réseau...)
        console.warn("handleUserLogin: Could not fetch user profile:", profileError);
        // profileData reste null, isAdmin reste false
        // On loggue l'erreur mais on continue, l'UI affichera l'email et pas le bouton admin.
    }

    // 2. Mettre à jour l'interface avec les infos du profil ET le statut admin
    // Appelée MÊME SI la récupération du profil a échoué (avec isAdmin=false)
    updateAuthUI(user, profileData, isAdmin);

    // 3. Récupérer les données de l'application (appData)
    const appDataDocRef = window.doc(window.db, `users/${user.uid}/appData`, 'data');
    let remoteData = null;
    let remoteDataExists = false;
    let syncNeeded = false; // Gardé pour la clarté, même si non utilisé pour le rendu

    console.log("handleUserLogin: Attempting to fetch appData..."); // Log ajouté
    try {
        const docSnap = await window.getDoc(appDataDocRef);
        if (docSnap.exists()) {
            remoteData = docSnap.data();
            remoteDataExists = true;
            console.log("handleUserLogin: Remote appData found.");
        } else {
            console.log("handleUserLogin: No remote appData found.");
        }
    } catch (error) {
        console.error("handleUserLogin: FATAL Error fetching remote appData:", error);
        alert("Impossible de récupérer les données en ligne. L'application continue en mode local.");
        setupRealtimeListener(user);
        renderAllForCurrentTeam();
        return; // Stoppe ici si les données principales ne peuvent être lues
    }

    // Récupère les données locales actuelles (inchangé)
    const localDataString = localStorage.getItem('volleyAppData');
    const localDataExists = !!localDataString;

    // Logique de synchronisation (Priorité en ligne - inchangée)
    if (remoteDataExists) {
        if (localDataExists && localDataString !== JSON.stringify(remoteData)) {
             console.log("handleUserLogin: Conflict detected. Prioritizing remote data.");
             await pullDataFromFirestore(remoteData);
             // syncNeeded = true; // Non utilisé
        } else if (!localDataExists) {
             console.log("handleUserLogin: Remote data found, no local data. Pulling.");
             await pullDataFromFirestore(remoteData);
             // syncNeeded = true; // Non utilisé
        } else {
             console.log("handleUserLogin: Remote and local data identical. Using remote in memory.");
             window.appData = remoteData;
             migrateDataStructure();
        }
    } else if (localDataExists) {
        console.log("handleUserLogin: Local data found, no remote data. Pushing local.");
        await pushDataToFirestore();
    } else {
        console.log("handleUserLogin: No local or remote data. Pushing default structure.");
        await pushDataToFirestore();
    }

    // Lance l'écoute en temps réel (inchangé)
    setupRealtimeListener(user);

    // Appelle le rendu (inchangé)
    console.log("handleUserLogin: Rendering UI after login handling complete.");
    renderAllForCurrentTeam();
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
 * Met à jour la variable globale `window.appData` avec les données venues de Firestore.
 * NE DOIT PAS toucher à localStorage.
 * @param {object} remoteData - Les données récupérées de Firestore.
 */
async function pullDataFromFirestore(remoteData) {
    console.log("Pulling data from Firestore into memory (window.appData)...");
    window.appData = remoteData; // Remplace les données en mémoire
    migrateDataStructure(); // Applique les migrations si nécessaire sur les données tirées
    console.log("window.appData updated with Firestore data.");
   
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
        
        // --- NOUVELLE SÉCURITÉ ---
        // Si currentUser est null (l'utilisateur vient de se déconnecter),
        // on ignore TOUTE mise à jour venant de l'écouteur.
        if (!currentUser) {
            console.log("Snapshot received, but currentUser is null (logged out). IGNORING.");
            // Optionnel : on pourrait détacher l'écouteur ici aussi, mais c'est déjà fait dans onAuthStateChanged
            // if (firestoreListener) firestoreListener();
            // firestoreListener = null;
            return; 
        }
        // Vérifie aussi si l'UID a changé (sécurité supplémentaire)
        if (currentUser.uid !== user.uid) {
             console.log("Snapshot received for previous user. IGNORING.");
             return;
        }
        // --- FIN NOUVELLE SÉCURITÉ ---

        if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            // Utilise la comparaison globale window.appData
            if (JSON.stringify(window.appData) !== JSON.stringify(firestoreData)) {
                console.log("Realtime update received. Updating local state.");
                window.appData = JSON.parse(JSON.stringify(firestoreData)); // Met à jour la variable globale
                migrateDataStructure(); // Applique migrations si besoin
                localStorage.setItem('volleyAppData', JSON.stringify(window.appData)); // Met à jour le stockage local
                renderAllForCurrentTeam(); // Rafraîchit toute l'interface
            } else {
                 console.log("Realtime update received, but data is identical to current state. No UI update needed.");
            }
        } else {
             console.warn("Firestore document deleted externally. Resetting local data.");
             // Assure de mettre à jour la variable globale
             window.appData = { teams: [], currentTeamId: null, lastFaultAction: null, lastPointAction: null };
             localStorage.removeItem('volleyAppData');
             renderAllForCurrentTeam();
        }
    }, (error) => {
        console.error("Error in Firestore listener:", error);
        // Gérer l'erreur, par exemple détacher l'écouteur pour éviter des erreurs répétées
         if (firestoreListener) {
             console.log("Detaching listener due to error.");
             firestoreListener();
             firestoreListener = null;
         }
    });
}

/**
 * Met à jour l'interface utilisateur pour afficher l'état de connexion,
 * le nom de l'utilisateur (si disponible) et le bouton admin (si applicable).
 * @param {object|null} user - L'objet utilisateur Firebase ou null si déconnecté.
 * @param {object|null} profileData - Les données du profil Firestore (peut contenir 'firstname').
 * @param {boolean} isAdmin - Indique si l'utilisateur connecté est un administrateur.
 */
function updateAuthUI(user, profileData = null, isAdmin = false) { // Nouvelle signature
    // Récupère les éléments HTML nécessaires
    const loggedInDiv = document.getElementById('auth-logged-in');
    const loggedOutDiv = document.getElementById('auth-logged-out');
    const userEmailDisplay = document.getElementById('user-email-display');
    const greetingLabel = document.getElementById('auth-greeting-label');
    const adminButton = document.getElementById('admin-link-button'); // Récupère le bouton admin

    // Vérification que tous les éléments existent
    if (!loggedInDiv || !loggedOutDiv || !userEmailDisplay || !greetingLabel || !adminButton) {
        // Si les éléments ne sont pas encore prêts (chargement initial),
        // réessaie une fois que le DOM est complètement chargé.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => updateAuthUI(user, profileData, isAdmin), { once: true });
        } else {
            // Si le DOM est chargé mais les éléments manquent, loggue une erreur.
            console.warn("Auth UI elements (including admin button) not found.");
        }
        return; // Stoppe l'exécution si les éléments manquent
    }

    // Gère l'affichage si l'utilisateur est connecté
    if (user) {
        // Affiche la section "connecté", cache la section "déconnecté"
        loggedInDiv.classList.remove('hidden');
        loggedOutDiv.classList.add('hidden');

        // Affiche "Bonjour [Prénom]" si le prénom est disponible dans profileData,
        // sinon affiche l'email et le label "Connecté en tant que :".
        if (profileData && profileData.firstname) {
            userEmailDisplay.textContent = `Bonjour ${profileData.firstname}`;
            greetingLabel.classList.add('hidden'); // Cache "Connecté en tant que :"
        } else {
            userEmailDisplay.textContent = user.email;
            greetingLabel.classList.remove('hidden'); // Montre "Connecté en tant que :"
        }

        // Affiche ou cache le bouton "Administration" en fonction du statut isAdmin
        if (isAdmin) {
            adminButton.classList.remove('hidden'); // Montre le bouton si admin
        } else {
            adminButton.classList.add('hidden'); // Cache le bouton si non admin
        }

    } else {
        // Gère l'affichage si l'utilisateur est déconnecté
        loggedInDiv.classList.add('hidden');  // Cache la section "connecté"
        loggedOutDiv.classList.remove('hidden'); // Affiche la section "déconnecté"
        userEmailDisplay.textContent = ''; // Vide le champ du nom/email
        greetingLabel.classList.remove('hidden'); // Ré-affiche "Connecté en tant que :" (sera caché si besoin à la prochaine connexion)
        adminButton.classList.add('hidden'); // Cache toujours le bouton si déconnecté
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
        
        // 2. Créer le document parent users/{userId} AVEC des champs
        //    (Ceci est NÉCESSAIRE pour que la requête list() de l'admin le trouve)
        try {
            const userDocRef = window.doc(window.db, `users/${user.uid}`);
            await window.setDoc(userDocRef, {
                email: email, // Stocke l'email pour référence facile
                createdAt: new Date() // Ajoute une date de création
            });
        } catch (userDocError) {
             console.error("Error creating parent user document:", userDocError);
             // On continue même si cette étape échoue, mais l'admin ne verra pas l'utilisateur
        }


        // 3. Sauvegarder le profil (Prénom/Nom) dans un document séparé
        try {
            const profileDocRef = window.doc(window.db, `users/${user.uid}/profile`, 'data');
            await window.setDoc(profileDocRef, { 
                firstname: firstname, 
                lastname: lastname,
                isAdmin: false // Ajoute le champ isAdmin par défaut
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

/**
 * Gère la déconnexion de l'utilisateur :
 * 1. Détache l'écouteur Firestore IMMÉDIATEMENT.
 * 2. Déconnecte l'utilisateur.
 */
async function handleLogOut() {
    console.log("handleLogOut: Starting logout process...");

    // 1. Détacher l'écouteur Firestore AVANT TOUT
    if (firestoreListener) {
        console.log("handleLogOut: Detaching Firestore listener *before* sign out.");
        firestoreListener();
        firestoreListener = null;
    } else {
        console.log("handleLogOut: No active Firestore listener to detach.");
    }

    try {
        // 2. Déconnecter l'utilisateur
        console.log("handleLogOut: Calling signOut...");
        await window.signOut(window.auth);
        console.log("handleLogOut: Sign out successful. onAuthStateChanged will handle UI refresh.");
        // onAuthStateChanged va s'exécuter et gérer loadLocalData + renderAllForCurrentTeam.

    } catch (error) {
        console.error("Log out error during signOut:", error);
        alert("Erreur de déconnexion : " + error.message);
        // En cas d'erreur, on force quand même l'état déconnecté localement
        // et on laisse onAuthStateChanged tenter de nettoyer.
        currentUser = null;
        updateAuthUI(null);
        // On ne recharge PAS les données ici, on laisse onAuthStateChanged le faire.
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

