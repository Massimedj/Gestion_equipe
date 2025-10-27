// La liste ADMIN_UIDS est supprimée.

let currentAdminUser = null; 

document.addEventListener('firebaseReady', () => {
    console.log("Admin page: Firebase ready.");
    
    // Utilise async pour pouvoir lire Firestore
    window.onAuthStateChanged(window.auth, async (user) => { 
        const loadingDiv = document.getElementById('loading-or-error');
        const adminContentDiv = document.getElementById('admin-content');
        
        // Assure que le contenu est caché initialement
        loadingDiv.innerHTML = '<p>Chargement...</p>'; 
        loadingDiv.classList.remove('hidden');
        adminContentDiv.classList.add('hidden');

        if (user) {
            console.log("Admin page: User logged in:", user.uid, ". Checking admin status...");
            currentAdminUser = user; // Stocke l'utilisateur
            
            // --- NOUVELLE LOGIQUE : Vérification via Firestore ---
            try {
                // Récupère le document profil de l'utilisateur connecté
                const profileRef = window.doc(window.db, `users/${user.uid}/profile/data`);
                const profileSnap = await window.getDoc(profileRef);

                // Vérifie si le document existe ET si isAdmin est true
                if (profileSnap.exists() && profileSnap.data().isAdmin === true) {
                    console.log("Admin page: User is an ADMIN (isAdmin field is true).");
                    loadingDiv.classList.add('hidden');
                    adminContentDiv.classList.remove('hidden');
                    loadUserList(); // Charge la liste des utilisateurs
                } else {
                    console.warn("Admin page: User is NOT an admin (profile missing or isAdmin not true).");
                    loadingDiv.innerHTML = '<p class="text-red-600 font-bold">Accès refusé. Vous n\'êtes pas administrateur.</p>';
                    // adminContentDiv reste caché
                }
            } catch (error) {
                console.error("Admin page: Error checking admin status:", error);
                loadingDiv.innerHTML = `<p class="text-red-600 font-bold">Erreur lors de la vérification du statut administrateur : ${error.message}</p>`;
                // adminContentDiv reste caché
            }
            // --- FIN NOUVELLE LOGIQUE ---

        } else {
            console.log("Admin page: No user logged in.");
            currentAdminUser = null; // Réinitialise l'admin
            loadingDiv.innerHTML = '<p class="text-red-600 font-bold">Veuillez vous connecter en tant qu\'administrateur.</p>';
            // adminContentDiv reste caché
        }
    });
});

/** Charge et affiche la liste des utilisateurs */
async function loadUserList() {
    // Cible le div où la liste sera affichée
    const userListDiv = document.getElementById('user-list');
    // Affiche un message de chargement initial
    userListDiv.innerHTML = '<p>Chargement de la liste...</p>';

    try {
        // Définit la référence à la collection Firestore "users"
        const usersCollectionRef = window.collection(window.db, "users"); // Vérifiez bien le nom "users" ici
        console.log("Admin page: Querying collection 'users'..."); // Log avant la requête

        // Exécute la requête pour obtenir tous les documents de la collection
        const querySnapshot = await window.getDocs(usersCollectionRef);

        // Loggue le résultat de la requête (taille et si elle est vide)
        console.log(`Admin page: getDocs successful. Snapshot size: ${querySnapshot.size}, Is empty: ${querySnapshot.empty}`);

        // Vide le message de chargement
        userListDiv.innerHTML = '';

        // Si la requête ne retourne aucun document
        if (querySnapshot.empty) {
            userListDiv.innerHTML = '<p>Aucun utilisateur trouvé.</p>'; // Affiche le message "Aucun utilisateur"
            return; // Arrête la fonction ici
        }

        // Si des documents sont trouvés, boucle sur chacun d'eux
        querySnapshot.forEach(async (userDoc) => {
            const userId = userDoc.id; // Récupère l'ID du document (qui est l'UID de l'utilisateur)
            // Initialise des variables pour les informations utilisateur avec des valeurs par défaut
            let userEmail = `Utilisateur ${userId.substring(0, 6)}...`; // Fallback si le profil n'est pas trouvé
            let userFirstName = '';
            let userLastName = '';

            // Tente de récupérer le document profil associé à cet utilisateur
            try {
                const profileRef = window.doc(window.db, `users/${userId}/profile/data`); // Chemin vers le profil
                const profileSnap = await window.getDoc(profileRef); // Lecture du document profil
                if (profileSnap.exists()) { // Vérifie si le document profil existe
                    const profileData = profileSnap.data(); // Récupère les données du profil
                    userFirstName = profileData.firstname || ''; // Assigne le prénom (ou chaîne vide)
                    userLastName = profileData.lastname || ''; // Assigne le nom (ou chaîne vide)
                    // On pourrait aussi récupérer l'email ici si besoin, mais il est stocké dans Auth, pas Firestore par défaut
                }
            } catch (profileError) {
                // Loggue une alerte si la lecture du profil échoue pour cet utilisateur
                console.warn(`Could not fetch profile for user ${userId}:`, profileError);
            }

            // Crée un bouton pour cet utilisateur
            const userButton = document.createElement('button');
            userButton.className = 'block w-full text-left p-2 bg-white rounded shadow hover:bg-gray-100'; // Style du bouton
            // Définit le texte du bouton (Prénom Nom (UID))
            userButton.textContent = `${userFirstName} ${userLastName} (${userId})`;
            // Associe une action au clic : appeler showUserDetails avec l'ID et le nom de l'utilisateur
            userButton.onclick = () => showUserDetails(userId, `${userFirstName} ${userLastName}`);
            // Ajoute le bouton à la liste dans le HTML
            userListDiv.appendChild(userButton);
        });

    } catch (error) {
        // Gère les erreurs potentielles lors de la lecture de la collection 'users' (ex: permissions)
        console.error("Error loading user list:", error);
        userListDiv.innerHTML = '<p class="text-red-600">Erreur lors du chargement des utilisateurs. Vérifiez les règles Firestore.</p>'; // Affiche un message d'erreur
    }
}


/** Affiche les détails et les données d'un utilisateur sélectionné */
async function showUserDetails(userId, userName) {
    const userDetailsDiv = document.getElementById('user-details');
    const userDataTreeDiv = document.getElementById('user-data-tree');
    const selectedUserSpan = document.getElementById('selected-user-email');
    
    // Récupère les IDs pour les deux vues
    const editingUserIdInput = document.getElementById('editing-user-id');
    
    // Vue "Affichage" (Spans)
    const profileDisplayFirstName = document.getElementById('profile-display-firstname');
    const profileDisplayLastName = document.getElementById('profile-display-lastname');
    const profileDisplayEmail = document.getElementById('profile-display-email');
    
    // Vue "Édition" (Inputs)
    const profileEditFirstName = document.getElementById('profile-edit-firstname');
    const profileEditLastName = document.getElementById('profile-edit-lastname');
    const profileEditEmail = document.getElementById('profile-edit-email');

    // Met à jour le titre et affiche la section
    selectedUserSpan.textContent = `${userName} (ID: ${userId})`;
    userDetailsDiv.classList.remove('hidden');
    userDataTreeDiv.innerHTML = '<p>Chargement des données...</p>';
    
    // Stocke l'ID pour le bouton "Enregistrer"
    if(editingUserIdInput) editingUserIdInput.value = userId;

    // Réinitialise la vue en mode "Affichage" (non-édition)
    toggleProfileEdit(false); 

    // Réinitialise les champs des deux vues
    if(profileDisplayFirstName) profileDisplayFirstName.textContent = 'Chargement...';
    if(profileDisplayLastName) profileDisplayLastName.textContent = '';
    if(profileDisplayEmail) profileDisplayEmail.textContent = 'Chargement...';
    if(profileEditFirstName) profileEditFirstName.value = '';
    if(profileEditLastName) profileEditLastName.value = '';
    if(profileEditEmail) profileEditEmail.value = '';

    try {
        // 1. Charger le document parent (pour l'email)
        const userDocRef = window.doc(window.db, `users/${userId}`);
        const userDocSnap = await window.getDoc(userDocRef);
        const email = userDocSnap.exists() && userDocSnap.data().email ? userDocSnap.data().email : 'Email non trouvé';
        
        if(profileDisplayEmail) profileDisplayEmail.textContent = email;
        if(profileEditEmail) profileEditEmail.value = email;

        // 2. Charger le profil (pour Prénom/Nom)
        const profileRef = window.doc(window.db, `users/${userId}/profile/data`);
        const profileSnap = await window.getDoc(profileRef);
        let firstname = 'Profil non trouvé';
        let lastname = '';
        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            firstname = profileData.firstname || 'Non défini';
            lastname = profileData.lastname || 'Non défini';
        }
        
        if(profileDisplayFirstName) profileDisplayFirstName.textContent = firstname;
        if(profileDisplayLastName) profileDisplayLastName.textContent = lastname;
        if(profileEditFirstName) profileEditFirstName.value = firstname;
        if(profileEditLastName) profileEditLastName.value = lastname;
        
        // 3. Charger les données de l'application (appData)
        const appDataRef = window.doc(window.db, `users/${userId}/appData/data`);
        const appDataSnap = await window.getDoc(appDataRef);

        if (appDataSnap.exists()) {
            // ... (Le reste de votre fonction pour afficher l'arborescence des données est inchangé)
            const appData = appDataSnap.data();
            userDataTreeDiv.innerHTML = ''; 

            const userNode = document.createElement('div');
            userNode.innerHTML = `<strong>Utilisateur:</strong> ${userName}`;
            userDataTreeDiv.appendChild(userNode);

            if (appData.teams && appData.teams.length > 0) {
                appData.teams.forEach(team => {
                    const teamNode = document.createElement('div');
                    teamNode.className = 'ml-4';
                    teamNode.innerHTML = `<strong>Équipe:</strong> ${team.name} (${team.season || 'N/A'}) - ${team.players?.length || 0} joueur(s), ${team.matches?.length || 0} match(s)`;
                    userDataTreeDiv.appendChild(teamNode);

                    if (team.players && team.players.length > 0) {
                        const playersNode = document.createElement('div');
                        playersNode.className = 'ml-8';
                        playersNode.innerHTML = `<strong>Effectif:</strong>`;
                        team.players.forEach(player => {
                            const playerNode = document.createElement('div');
                            playerNode.className = 'ml-12';
                            playerNode.textContent = `- #${player.jerseyNumber || '?'} ${player.name}`;
                            playersNode.appendChild(playerNode);
                        });
                        userDataTreeDiv.appendChild(playersNode);
                    }
                    
                     if (team.matches && team.matches.length > 0) {
                        const matchesNode = document.createElement('div');
                        matchesNode.className = 'ml-8';
                        matchesNode.innerHTML = `<strong>Matchs:</strong>`;
                         team.matches.forEach(match => {
                             const matchNode = document.createElement('div');
                             matchNode.className = 'ml-12';
                             matchNode.textContent = `- ${new Date(match.date.replace(/-/g, '/')).toLocaleDateString('fr-FR')} vs ${match.opponent}`;
                             matchesNode.appendChild(matchNode);
                         });
                         userDataTreeDiv.appendChild(matchesNode);
                     }
                });
            } else {
                userDataTreeDiv.innerHTML += '<p class="ml-4">Aucune équipe.</p>';
            }
        } else {
            userDataTreeDiv.innerHTML = '<p>Aucune donnée d\'application trouvée pour cet utilisateur.</p>';
        }

    } catch (error) {
        console.error(`Error loading details for user ${userId}:`, error);
        userDataTreeDiv.innerHTML = '<p class="text-red-600">Erreur lors du chargement des détails.</p>';
        if(profileDisplayFirstName) profileDisplayFirstName.textContent = 'Erreur';
        if(profileDisplayEmail) profileDisplayEmail.textContent = 'Erreur';
    }
}

/** Enregistre les modifications du profil de l'utilisateur sélectionné */
async function saveProfileChanges() {
    const userId = document.getElementById('editing-user-id').value;
    if (!userId) {
        alert("Erreur : Aucun utilisateur n'est sélectionné.");
        return;
    }

    // Récupère les nouvelles valeurs depuis les champs d'édition
    const newFirstName = document.getElementById('profile-edit-firstname').value.trim();
    const newLastName = document.getElementById('profile-edit-lastname').value.trim();
    const newEmail = document.getElementById('profile-edit-email').value.trim();
    
    if (!newFirstName || !newLastName) {
        alert("Le prénom et le nom ne peuvent pas être vides.");
        return;
    }

    if (!confirm("Êtes-vous sûr de vouloir modifier ce profil ?")) {
        return;
    }

    try {
        // 1. Mettre à jour le document parent (pour l'email)
        const userDocRef = window.doc(window.db, `users/${userId}`);
        await window.updateDoc(userDocRef, {
            email: newEmail
        });

        // 2. Mettre à jour le document profil (pour Prénom/Nom)
        const profileRef = window.doc(window.db, `users/${userId}/profile/data`);
        await window.updateDoc(profileRef, {
            firstname: newFirstName,
            lastname: newLastName
        });

        alert("Profil mis à jour avec succès !");

        // 3. Rafraîchir la liste des utilisateurs (pour le nom)
        await loadUserList(); 
        
        // 4. Rafraîchir le titre des détails
        const selectedUserSpan = document.getElementById('selected-user-email');
        if(selectedUserSpan) {
            selectedUserSpan.textContent = `${newFirstName} ${newLastName} (ID: ${userId})`;
        }

        // 5. Mettre à jour les spans de la vue "Affichage"
        const profileDisplayFirstName = document.getElementById('profile-display-firstname');
        const profileDisplayLastName = document.getElementById('profile-display-lastname');
        const profileDisplayEmail = document.getElementById('profile-display-email');
        
        if(profileDisplayFirstName) profileDisplayFirstName.textContent = newFirstName;
        if(profileDisplayLastName) profileDisplayLastName.textContent = newLastName;
        if(profileDisplayEmail) profileDisplayEmail.textContent = newEmail;

        // 6. Rebasculer en mode "Affichage"
        toggleProfileEdit(false);

    } catch (error) {
        console.error("Erreur lors de la mise à jour du profil:", error);
        alert("Erreur : " + error.message);
    }
}

/** Affiche ou cache le formulaire d'édition du profil */
function toggleProfileEdit(showEdit) {
    const displayView = document.getElementById('profile-display-view');
    const editView = document.getElementById('profile-edit-view');
    const editButton = document.getElementById('profile-edit-button');

    if (showEdit) {
        // Affiche le formulaire d'édition
        displayView.classList.add('hidden');
        editButton.classList.add('hidden');
        editView.classList.remove('hidden');
    } else {
        // Affiche la vue "lecture seule"
        displayView.classList.remove('hidden');
        editButton.classList.remove('hidden');
        editView.classList.add('hidden');
    }
}