// ============================
// CONSTANTES ET ÉTAT GLOBAL
// ============================
const POSITIONS = ['Passeur', 'Central', 'R\u00e9ceptionneur-Attaquant', 'Pointu', 'Lib\u00e9ro'];
const SETS = ['set1', 'set2', 'set3', 'set4', 'set5'];

// Structure de données principale, chargée depuis localStorage au démarrage

let currentSet = 'set1';
// 'currentUser' est défini et géré dans auth.js
// let firestoreListener = null; // Géré dans auth.js

// ============================
// INITIALISATION (Simplifiée)
// ============================

// Attend que le HTML soit chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded. Initializing UI listeners and Auth.");
    
    setupEventListeners(); 
    populatePositionSelects();
    
    // L'appel initial à requestWakeLock() a été supprimé.
    
    if (typeof initializeApp === 'function') {
        initializeApp(); 
    } else {
        console.error("Erreur critique: auth.js n'a pas été chargé ou initializeApp() n'est pas définie.");
        alert("Erreur de chargement de l'application (auth.js).");
    }
});


/**
 * Attache les écouteurs d'événements principaux aux éléments de l'interface.
 */
function setupEventListeners() {
    console.log("Setting up UI listeners.");
    const teamSelector = document.getElementById('teamSelector');
    if (teamSelector) {
        teamSelector.addEventListener('change', (e) => {
            const teamSelected = !!e.target.value;
            const teamActions = document.getElementById('teamActions');
            if(teamActions) teamActions.classList.toggle('hidden', !teamSelected);
            // Utilise la fonction switchTeam (qui appelle saveData dans auth.js)
            switchTeam(parseInt(e.target.value));
        });
    }

    const matchSelector = document.getElementById('matchSelector');
    if (matchSelector) {
        matchSelector.addEventListener('change', (e) => {
            const matchId = e.target.value;
            const matchSelected = !!matchId;
            // Sauvegarde le choix du match en local uniquement (pas besoin de synchro pour ça)
            localStorage.setItem(`lastSelectedMatch_${appData.currentTeamId}`, matchId);
            const matchActions = document.getElementById('matchActions');
            const matchHint = document.getElementById('match-hint');
            const selectedMatchContent = document.getElementById('selectedMatchContent');
            if(matchActions) matchActions.classList.toggle('hidden', !matchSelected);
            if(matchHint) matchHint.classList.toggle('hidden', matchSelected);
            if(selectedMatchContent) selectedMatchContent.classList.toggle('hidden', !matchSelected);
            selectSet('set1'); // Revient au set 1
            renderAttendanceForSelectedMatch(); // Affiche la feuille de match, etc.
            renderLiveTrackingView(); // Met à jour l'onglet Suivi Match
        });
    }


}

// ============================
// GESTION DES ONGLETS & MODALES
// ============================

/**
 * Affiche l'onglet principal demandé et met à jour le contenu associé.
 * @param {string} tabName - L'identifiant de l'onglet ('roster', 'matches', 'stats', 'live', 'results').
 */
function showMainTab(tabName) {
    // Sauvegarde l'onglet actif dans le localStorage pour le restaurer au prochain chargement
    localStorage.setItem('lastActiveTab', tabName); 

    // Cache toutes les vues principales
    document.getElementById('main-view-roster')?.classList.add('hidden');
    document.getElementById('main-view-matches')?.classList.add('hidden');
    document.getElementById('main-view-stats')?.classList.add('hidden');
    document.getElementById('main-view-live')?.classList.add('hidden');
    document.getElementById('main-view-results')?.classList.add('hidden');
	document.getElementById('main-view-trainings')?.classList.add('hidden');

    // Met à jour le style des boutons d'onglet (retire le style actif de tous)
    const tabs = ['roster', 'matches', 'stats', 'live', 'results'];
    tabs.push('trainings');
	tabs.forEach(t => {
        const tabButton = document.getElementById(`main-tab-${t}`);
        if (tabButton) {
            // Classes pour un onglet inactif
            tabButton.classList.remove('border-indigo-500', 'text-indigo-600');
            tabButton.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        }
    });

    // Affiche la vue correspondant à l'onglet cliqué
    const view = document.getElementById(`main-view-${tabName}`);
    // Met en évidence le bouton de l'onglet cliqué
    const button = document.getElementById(`main-tab-${tabName}`);
    if(view) {
        view.classList.remove('hidden');
    }
    if(button) {
        // Classes pour l'onglet actif
        button.classList.add('border-indigo-500', 'text-indigo-600');
        button.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    }

    // Rafraîchit les données spécifiques à l'onglet qui vient d'être affiché
    if (tabName === 'stats') {
        // L'onglet Stats n'affiche plus que les stats joueurs       
		statsMatchIds = null;
        statsSetNames = null;
		renderPlayerStats(); 
    }
	if (tabName === 'trainings') {
        renderTrainingList();
    }
    if (tabName === 'live') {
        // Met à jour l'affichage du suivi en direct
        renderLiveTrackingView();
    }
    if (tabName === 'results') {
        // Met à jour la liste des matchs (calendrier)
        renderResults();       
        // Met à jour le tableau des résultats de l'équipe
        renderTeamStats();    
		const rankingButton = document.getElementById('ranking-link-button');
        const currentTeam = getCurrentTeam();
        
        if (rankingButton && currentTeam && currentTeam.rankingUrl) {
            // Assure que l'URL est valide (ajoute https:// si besoin)
            let url = currentTeam.rankingUrl;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            rankingButton.href = url;
            rankingButton.classList.remove('hidden');
        } else if (rankingButton) {
            rankingButton.classList.add('hidden');
        }
    }
    // Pour l'onglet Matchs (gestion de la feuille de match, composition...)
    if (tabName === 'matches') {
        // S'assure que la liste déroulante des matchs est à jour
        renderMatchSelector(); 
        // Si un match est sélectionné dans la liste, rafraîchit son affichage
        if (document.getElementById('matchSelector').value) {
            renderAttendanceForSelectedMatch(); 
        }
    }
    // Pour l'onglet Effectif
    if (tabName === 'roster') {
        renderPlayerList();
    }
    
    // Demande le verrou si on va sur l'onglet 'Suivi', le libère sinon
    if (tabName === 'live') {
        console.log("Onglet 'Suivi' activé, demande du Screen Wake Lock.");
        requestWakeLock(); // Demande le verrouillage
    } else {
        console.log(`Onglet '${tabName}' activé, libération du Screen Wake Lock (s'il était actif).`);
        releaseWakeLock(); // Libère le verrouillage
    }
   
} 



/**
 * Sélectionne un set, affiche les données correspondantes et
 * reporte la composition du set PRÉCÉDENT (N-1) s'il y a lieu.
 * @param {string} setName - Le nom du set (ex: 'set1', 'set2'...).
 */
async function selectSet(setName) {
    // --- DÉBUT DE LA CORRECTION (Logique N-1) ---
    
    const newSetIndex = SETS.indexOf(setName);
    const previousSetIndex = newSetIndex - 1;

    // Condition 1: S'assurer qu'on n'est pas sur le Set 1 (index 0)
    if (previousSetIndex >= 0) {
        const currentTeam = getCurrentTeam();
        const matchIdInput = document.getElementById('matchSelector');
        
        if (currentTeam && matchIdInput && matchIdInput.value) {
            const matchId = parseInt(matchIdInput.value);
            const previousSetName = SETS[previousSetIndex]; // Le set N-1

            // S'assurer que la structure de données existe
            if (!currentTeam.courtPositions) currentTeam.courtPositions = {};
            if (!currentTeam.courtPositions[matchId]) currentTeam.courtPositions[matchId] = {};
            
            const matchPositions = currentTeam.courtPositions[matchId];

            // Condition 2: Le set actuel (celui sur lequel on a cliqué) est vide
            const isNewSetEmpty = !matchPositions[setName] || Object.keys(matchPositions[setName]).length === 0;
            
            // Condition 3: Le set N-1 (précédent) est rempli
            const previousSetPositions = matchPositions[previousSetName];
            const isPreviousSetFilled = previousSetPositions && Object.keys(previousSetPositions).length > 0;

            // Si le set N-1 est rempli ET que le set N est vide, on copie
            if (isNewSetEmpty && isPreviousSetFilled) {
                console.log(`Report de la composition du ${previousSetName} vers ${setName}.`);
                
                // On fait une copie profonde (deep copy)
                matchPositions[setName] = JSON.parse(JSON.stringify(previousSetPositions));
                
                await saveData(); // On sauvegarde les données copiées
            }
        }
    }
    // --- FIN DE LA CORRECTION ---

    // Le reste de la fonction est inchangé
    currentSet = setName;
    if (window.appData) { // Ajout d'une vérification de sécurité
        window.appData.lastEvalAction = null;
    }
    
    renderSetSelector(); // Met à jour l'apparence des boutons de set
    renderCourt(); // Met à jour l'affichage du terrain (maintenant avec les données copiées)
    renderSubstitutions(); // Met à jour l'affichage des remplacements
    renderLiveTrackingView(); // Met à jour l'onglet Suivi
}


// Fonctions simples pour ouvrir les modales
function openAddPlayerModal() { document.getElementById('addPlayerModal')?.classList.remove('hidden'); }
function openAddMatchModal() { document.getElementById('addMatchModal')?.classList.remove('hidden'); }
function openAddTeamModal() {
    const nameInput = document.getElementById('newTeamName');
    const seasonInput = document.getElementById('newTeamSeason');
    if (nameInput) nameInput.value = '';
    if (seasonInput) {
        const currentYear = new Date().getFullYear();
        seasonInput.value = `${currentYear}/${currentYear + 1}`;
    }
    document.getElementById('addTeamModal')?.classList.remove('hidden');
}
function openEditTeamModal() {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const nameInput = document.getElementById('editTeamName');
    const seasonInput = document.getElementById('editTeamSeason');
    const urlInput = document.getElementById('editTeamRankingUrl'); // <-- AJOUT

    if (nameInput) nameInput.value = currentTeam.name;
    if (seasonInput) seasonInput.value = currentTeam.season || '';
    if (urlInput) urlInput.value = currentTeam.rankingUrl || ''; // <-- AJOUT

    document.getElementById('editTeamModal')?.classList.remove('hidden');
}
// Fonction générique pour fermer n'importe quelle modale
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.add('hidden');
 }
// Ouvre la modale d'information de l'onglet Suivi Match
function openInfoLiveModal() { document.getElementById('infoLiveModal')?.classList.remove('hidden'); }

/** Cache ou affiche la liste des joueurs dans la feuille de match. */
function toggleAttendanceList() {
    const list = document.getElementById('attendanceList');
    const icon = document.getElementById('attendance-toggle-icon');
    if(list) list.classList.toggle('hidden');
    // Fait tourner l'icône flèche
    if(icon) icon.classList.toggle('-rotate-180');
}

// ============================
// LOGIQUE DE L'APPLICATION (RENDERING, ETC.)
// ============================

/**
 * Fonction principale qui rafraîchit toute l'interface utilisateur en fonction de l'équipe sélectionnée.
 * Appelée après le chargement des données, le changement d'équipe, ou une mise à jour temps réel.
 */
function renderAllForCurrentTeam() {
    console.log("Rendering UI for current team:", appData.currentTeamId);
	
	console.log("renderAllForCurrentTeam: Starting render. Checking window.appData state:");
    // Loggue le nombre d'équipes DANS appData AU MOMENT où le rendu commence
    console.log("renderAllForCurrentTeam: window.appData.teams contains:", window.appData?.teams?.length || 0, "team(s)");
    console.log("renderAllForCurrentTeam: window.appData.currentTeamId is:", window.appData?.currentTeamId);
    // --- FIN AJOUT LOG ---
    const teamExists = !!getCurrentTeam(); // Vérifie si une équipe est sélectionnée
    const teamContent = document.getElementById('team-content'); // La section principale de l'appli
    const teamActions = document.getElementById('teamActions'); // Boutons Modifier/Supprimer équipe

    // Affiche ou cache la section principale et les actions d'équipe
    if (teamContent) teamContent.classList.toggle('hidden', !teamExists);
    if (teamActions) teamActions.classList.toggle('hidden', !teamExists);

    if (teamExists) {
        
        // C'EST L'APPEL MANQUANT. Il doit être ici pour
        // remplir la liste déroulante au démarrage.
        //
        renderTeamSelector(); 
        
        // Si une équipe existe, affiche ses informations
        renderPlayerList(); // Liste des joueurs
        renderMatchSelector(); // Liste déroulante des matchs
        renderSetSelector(); // Boutons Set 1, Set 2...
        
        // Restaure le dernier onglet actif ou va sur 'Effectif' par défaut
        const lastTab = localStorage.getItem('lastActiveTab') || 'roster';
        showMainTab(lastTab); // Affiche le bon onglet

        // Restaure le dernier match sélectionné pour cette équipe
        const savedMatchId = localStorage.getItem(`lastSelectedMatch_${appData.currentTeamId}`);
        const selector = document.getElementById('matchSelector');

        if (savedMatchId && selector && selector.querySelector(`option[value="${savedMatchId}"]`)) {
             console.log(`Restoring selected match: ${savedMatchId}`);
            selector.value = savedMatchId;
            // Déclenche l'événement 'change' pour que l'UI se mette à jour complètement
            // Utilise setTimeout pour s'assurer que tous les listeners sont prêts
            setTimeout(() => {
                console.log("Dispatching change event for match selector after timeout.");
                selector.dispatchEvent(new Event('change')); 
            }, 0);
        } else {
             // Si l'ID sauvegardé n'est pas valide ou n'existe pas
             if (savedMatchId) {
                 console.log(`Saved match ID ${savedMatchId} not found in selector, clearing.`);
                 localStorage.removeItem(`lastSelectedMatch_${appData.currentTeamId}`);
             } else {
                 // console.log("No saved match ID found."); // Log optionnel
             }
             // Assure que l'UI reflète l'absence de sélection
             if (selector) selector.value = ''; // Affiche le placeholder "-- Sélectionnez un match --"
             document.getElementById('matchActions')?.classList.add('hidden');
             document.getElementById('match-hint')?.classList.remove('hidden');
             document.getElementById('selectedMatchContent')?.classList.add('hidden');
        }
    } else {
        // S'il n'y a pas d'équipe sélectionnée (ou aucune équipe), vide l'interface
         const selector = document.getElementById('matchSelector');
         
         // S'assure que le sélecteur d'équipe est aussi réinitialisé
         renderTeamSelector(); 
                  
         if(selector) selector.innerHTML = '<option value="">-- Sélectionnez un match --</option>';
         document.getElementById('selectedMatchContent')?.classList.add('hidden');
         document.getElementById('matchActions')?.classList.add('hidden');
         document.getElementById('match-hint')?.classList.remove('hidden');
         // Vide les autres listes potentiellement remplies
         document.getElementById('playerList').innerHTML = '';
         document.getElementById('results-list-table').innerHTML = '';
         document.getElementById('statsTableBody').innerHTML = '';
         document.getElementById('teamStatsRow').innerHTML = '';
         document.getElementById('live-court-layout').innerHTML = '';
         document.getElementById('set-faults-summary').innerHTML = ''; // Le div du résumé
         // S'assure que l'onglet par défaut (ou le dernier visité) est affiché mais vide
         const lastTab = localStorage.getItem('lastActiveTab') || 'roster';
         showMainTab(lastTab);
    }
}


/** Remplit les listes déroulantes de postes dans les modales Ajouter/Modifier joueur. */
function populatePositionSelects() {
    const selects = [
        document.getElementById('addPlayerModal')?.querySelector('#newPlayerMainPosition'),
        document.getElementById('addPlayerModal')?.querySelector('#newPlayerSecondaryPosition'),
        document.getElementById('editPlayerModal')?.querySelector('#editPlayerMainPosition'),
        document.getElementById('editPlayerModal')?.querySelector('#editPlayerSecondaryPosition'),
    ].filter(Boolean); // Exclut les éléments non trouvés

    selects.forEach(select => {
        select.innerHTML = ''; // Vide les options précédentes
        // Ajoute une option "Aucun" pour le poste secondaire
        if (select.id.includes('Secondary')) {
            select.innerHTML += `<option value="">Aucun</option>`;
        }
        // Ajoute tous les postes définis dans la constante POSITIONS
        POSITIONS.forEach(pos => {
            select.innerHTML += `<option value="${pos}">${pos}</option>`;
        });
    });
}

// ============================
// GESTION D'ÉQUIPE
// ============================

/**
 * Retourne l'objet de l'équipe actuellement sélectionnée
 * en se basant sur window.appData.
 * @returns {object | null} L'objet équipe ou null.
 */
function getCurrentTeam() {
    // La vérification !currentUser a été SUPPRIMÉE d'ici.

    // Logs existants
    console.log("getCurrentTeam: Checking window.appData:", window.appData?.teams?.length || 0, "teams, currentId:", window.appData?.currentTeamId);

    // Vérifications sur appData
    if (!window.appData || !window.appData.teams || window.appData.currentTeamId === null) {
        console.log("getCurrentTeam: appData is invalid or no team selected. Returning null.");
        return null;
    }

    // Recherche de l'équipe
    const team = window.appData.teams.find(t => t.id === window.appData.currentTeamId);
    if (!team) {
        console.log("getCurrentTeam: currentTeamId not found in appData.teams. Returning null.");
    }
    return team || null; // Retourne l'équipe trouvée ou null
}

/** Ajoute une nouvelle équipe à la liste et la sélectionne. */
async function addTeam() {
	const teamNameInput = document.getElementById('newTeamName');
    const teamSeasonInput = document.getElementById('newTeamSeason');
    const teamRankingUrlInput = document.getElementById('newTeamRankingUrl');

    const teamName = teamNameInput.value.trim();
    const teamSeason = teamSeasonInput.value.trim();
    const teamRankingUrl = teamRankingUrlInput.value.trim();

    if (!teamName) {
        alert("Veuillez entrer un nom d'équipe.");
        return;
    }

    // Crée le nouvel objet équipe
    const newTeam = {
        id: Date.now(),
        name: teamName,
        season: teamSeason,
        rankingUrl: teamRankingUrl,
        players: [],
        matches: [],
        courtPositions: {},
		trainings: []
		
    };

    if (!appData.teams) appData.teams = []; // Initialise le tableau s'il n'existe pas
    appData.teams.push(newTeam);
    appData.currentTeamId = newTeam.id; // Sélectionne la nouvelle équipe

    await saveData(); // Sauvegarde les données (local + Firestore via auth.js)
    renderTeamSelector(); // Met à jour la liste déroulante
    renderAllForCurrentTeam(); // Rafraîchit toute l'interface
    closeModal('addTeamModal'); // Ferme la fenêtre modale
    // Vide les champs du formulaire (optionnel)
    teamNameInput.value = '';
    teamSeasonInput.value = '';
	teamRankingUrlInput.value = '';
}

/** Sauvegarde les modifications apportées au nom/saison de l'équipe actuelle. */
async function saveTeamChanges() {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;

    const editTeamNameInput = document.getElementById('editTeamName');
    const editTeamSeasonInput = document.getElementById('editTeamSeason');
    const editUrlInput = document.getElementById('editTeamRankingUrl'); 

    const newName = editTeamNameInput.value.trim();
    const newSeason = editTeamSeasonInput.value.trim();
    const newRankingUrl = editUrlInput.value.trim(); 

    if (!newName) {
         alert("Le nom de l'équipe ne peut pas être vide.");
         return;
    }

    currentTeam.name = newName;
    currentTeam.season = newSeason;
    currentTeam.rankingUrl = newRankingUrl; 

    await saveData(); 
    renderTeamSelector();
    renderPlayerList();
    closeModal('editTeamModal');
}

/** Supprime l'équipe actuellement sélectionnée après confirmation. */
async function deleteCurrentTeam() {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;

    // Demande confirmation à l'utilisateur
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'équipe "${currentTeam.name}" (${currentTeam.season || 'sans saison'}) ?\n\nATTENTION : Cette action est irréversible et supprimera tous les joueurs, matchs et statistiques associés à cette équipe.`)) {
        // Supprime l'équipe du tableau `appData.teams`
        appData.teams = appData.teams.filter(t => t.id !== currentTeam.id);

        // Sélectionne la première équipe restante, ou null s'il n'y en a plus
        appData.currentTeamId = appData.teams.length > 0 ? appData.teams[0].id : null;

        // Nettoie les préférences locales associées à l'équipe supprimée
        localStorage.removeItem(`lastSelectedMatch_${currentTeam.id}`);
        // Potentiellement d'autres clés localStorage si vous en ajoutez

        await saveData(); // Sauvegarde la nouvelle liste d'équipes
        renderTeamSelector(); // Met à jour la liste déroulante
        renderAllForCurrentTeam(); // Rafraîchit l'interface (qui sera vide ou affichera une autre équipe)
    }
}

/**
 * Change l'équipe active dans l'application.
 * @param {number} teamId - L'ID de l'équipe à sélectionner.
 */
async function switchTeam(teamId) {
    // Vérifie si l'ID est valide et différent de l'actuel
    const numericTeamId = parseInt(teamId); // Assure que c'est un nombre
    if (isNaN(numericTeamId) || appData.currentTeamId === numericTeamId) {
         if (isNaN(numericTeamId)) console.warn("switchTeam called with invalid ID:", teamId);
         return; // Ne fait rien si l'ID est invalide ou si c'est déjà l'équipe active
    }

    console.log("Switching to team ID:", numericTeamId);
    appData.currentTeamId = numericTeamId; // Met à jour l'ID de l'équipe active

    await saveData(); // Sauvegarde ce changement (important pour la persistance)
    renderTeamSelector(); // S'assure que la liste déroulante reflète la sélection
    renderAllForCurrentTeam(); // Rafraîchit toute l'interface pour la nouvelle équipe
}

/** Met à jour la liste déroulante de sélection d'équipe. */
function renderTeamSelector() {
    const selector = document.getElementById('teamSelector');
    const selectorButton = document.getElementById('teamSelectButton'); // Le bouton visible
    if (!selector || !selectorButton) return; 

    const targetTeamId = appData.currentTeamId; 
    selector.innerHTML = ''; 

    if (!appData || !appData.teams || appData.teams.length === 0) {
        selector.innerHTML = '<option value="">Créez une équipe pour commencer</option>';
        selectorButton.textContent = 'Créez une équipe pour commencer'; // Met à jour le bouton
        selector.disabled = true;
        selectorButton.disabled = true; 
        if (appData) appData.currentTeamId = null;
    } else {
        selector.disabled = false;
        selectorButton.disabled = false;
        
        const sortedTeams = [...appData.teams]; 
        sortedTeams.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        let selectedTeamName = 'Erreur'; // Fallback
        
        sortedTeams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            const teamText = team.name + (team.season ? ` (${team.season})` : '');
            option.textContent = teamText;
            selector.appendChild(option);
        });

        if (targetTeamId && selector.querySelector(`option[value="${targetTeamId}"]`)) {
            selector.value = targetTeamId;
        } else if (sortedTeams.length > 0) { 
            const firstTeamId = sortedTeams[0].id;
            selector.value = firstTeamId;
            if (appData.currentTeamId !== firstTeamId) {
                appData.currentTeamId = firstTeamId;
                 saveData(); 
            }
        } else {
             selector.value = '';
             if (appData) appData.currentTeamId = null;
        }
        
        // Met à jour le texte du bouton avec l'option sélectionnée
        const selectedOption = selector.options[selector.selectedIndex];
        if (selectedOption) {
            selectorButton.textContent = selectedOption.textContent;
        } else {
            selectorButton.textContent = 'Aucune équipe';
        }
    }
}

// ============================
// GESTION DES JOUEURS
// ============================
async function addPlayer() {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const modal = document.getElementById('addPlayerModal');
    const nameInput = modal.querySelector('#newPlayerName');
    const licenseInput = modal.querySelector('#newLicenseNumber');
    const jerseyInput = modal.querySelector('#newJerseyNumber');
    const genderInput = modal.querySelector('input[name="gender"]:checked');
    const mainPosSelect = modal.querySelector('#newPlayerMainPosition');
    const secPosSelect = modal.querySelector('#newPlayerSecondaryPosition');

    const name = nameInput.value.trim();
    const licenseNumber = licenseInput.value.trim();
    const jerseyNumber = jerseyInput.value.trim();
    const gender = genderInput.value;
    const mainPosition = mainPosSelect.value;
    const secondaryPosition = secPosSelect.value;

    if (!name) { alert('Le nom du joueur est requis.'); return; }

    if (currentTeam.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        alert('Un joueur avec ce nom existe déjà.'); return;
    }
    if (jerseyNumber && currentTeam.players.some(p => p.jerseyNumber === jerseyNumber)) {
        alert('Ce numéro de maillot est déjà pris.'); return;
    }

    currentTeam.players.push({
        id: Date.now(), // Simple unique ID
        name, licenseNumber, jerseyNumber, gender, mainPosition, secondaryPosition
    });

    await saveData();
    renderPlayerList();
    closeModal('addPlayerModal');

    // Reset form
    nameInput.value = '';
    licenseInput.value = '';
    jerseyInput.value = '';
    modal.querySelector('input[name="gender"][value="H"]').checked = true; // Default gender
    mainPosSelect.value = POSITIONS[0]; // Default position
    secPosSelect.value = '';
}

function openEditPlayerModal(playerId) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const player = currentTeam.players.find(p => p.id === playerId);
    if (!player) return;

    const modal = document.getElementById('editPlayerModal');
    modal.querySelector('#editPlayerId').value = player.id;
    modal.querySelector('#editPlayerName').value = player.name;
    modal.querySelector('#editLicenseNumber').value = player.licenseNumber || '';
    modal.querySelector('#editJerseyNumber').value = player.jerseyNumber || '';
    modal.querySelector(`input[name="editGender"][value="${player.gender}"]`).checked = true;
    modal.querySelector('#editPlayerMainPosition').value = player.mainPosition || POSITIONS[0];
    modal.querySelector('#editPlayerSecondaryPosition').value = player.secondaryPosition || '';
    modal.classList.remove('hidden');
}

async function savePlayerChanges() {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const modal = document.getElementById('editPlayerModal');
    const playerId = parseInt(modal.querySelector('#editPlayerId').value);
    const newName = modal.querySelector('#editPlayerName').value.trim();
    const newLicense = modal.querySelector('#editLicenseNumber').value.trim();
    const newJersey = modal.querySelector('#editJerseyNumber').value.trim();
    const newGender = modal.querySelector('input[name="editGender"]:checked').value;
    const newMainPos = modal.querySelector('#editPlayerMainPosition').value;
    const newSecPos = modal.querySelector('#editPlayerSecondaryPosition').value;

    const playerIndex = currentTeam.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    if (!newName) { alert('Le nom du joueur ne peut pas être vide.'); return; }

    // Check for duplicate name (excluding the player being edited)
    if (currentTeam.players.some(p => p.id !== playerId && p.name.toLowerCase() === newName.toLowerCase())) {
        alert('Un autre joueur a déjà ce nom.'); return;
    }
     // Check for duplicate jersey number (excluding the player being edited)
    if (newJersey && currentTeam.players.some(p => p.id !== playerId && p.jerseyNumber === newJersey)) {
        alert('Ce numéro de maillot est déjà pris par un autre joueur.'); return;
    }

    // Update player data
    currentTeam.players[playerIndex] = {
        ...currentTeam.players[playerIndex], // Keep existing ID and other properties
        name: newName,
        licenseNumber: newLicense,
        jerseyNumber: newJersey,
        gender: newGender,
        mainPosition: newMainPos,
        secondaryPosition: newSecPos
    };

    await saveData();
    renderPlayerList();
    renderAttendanceForSelectedMatch(); // Update attendance list if open
    closeModal('editPlayerModal');
}

// Version complète de la suppression de joueur
async function deletePlayer(playerId) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const playerToDelete = currentTeam.players.find(p => p.id === playerId);
    if (!playerToDelete) return;

    if (confirm(`Voulez-vous vraiment supprimer ${playerToDelete.name} ? Il sera retiré de l'effectif et de tous les matchs.`)) {
        // 1. Supprime le joueur de la liste principale
        currentTeam.players = currentTeam.players.filter(p => p.id !== playerId);

        // 2. Nettoie les données du joueur dans tous les matchs
        if (currentTeam.matches) {
            currentTeam.matches.forEach(match => {
                match.present = match.present?.filter(id => id !== playerId);
                match.played = match.played?.filter(id => id !== playerId);
                if (match.captainId === playerId) {
                    match.captainId = null;
                }
                // Supprime des compositions de terrain
                if (currentTeam.courtPositions?.[match.id]) {
                    SETS.forEach(setKey => {
                        if (currentTeam.courtPositions[match.id][setKey]) {
                            const setPositions = currentTeam.courtPositions[match.id][setKey];
                            for (const pos in setPositions) {
                                if (setPositions[pos] === playerId) {
                                    delete setPositions[pos];
                                }
                            }
                        }
                    });
                }
                // Supprime des remplacements
                if (match.substitutions) {
                    SETS.forEach(setKey => {
                        if (match.substitutions[setKey]) {
                            match.substitutions[setKey] = match.substitutions[setKey].filter(sub => sub.in !== playerId && sub.out !== playerId);
                        }
                    });
                }
                // Supprime des fautes
                if (match.faults) {
                    SETS.forEach(setKey => {
                        if (match.faults[setKey]?.[playerId]) {
                            delete match.faults[setKey][playerId];
                        }
                    });
                }
                // Supprime des points
                if (match.points) {
                    SETS.forEach(setKey => {
                        if (match.points[setKey]?.[playerId]) {
                            delete match.points[setKey][playerId];
                        }
                    });
                }
                // Supprime des évaluations
                if (match.evals) {
                    SETS.forEach(setKey => {
                        if (match.evals[setKey]?.[playerId]) {
                            delete match.evals[setKey][playerId];
                        }
                    });
                }
                recalculatePlayedStatus(match.id);
            });
        }
        await saveData();
        renderPlayerList();
        renderAttendanceForSelectedMatch();
        renderStats();
        renderCourt();
    }
}


async function deleteAllPlayers() {
    const currentTeam = getCurrentTeam();
    if (!currentTeam || currentTeam.players.length === 0) return;
    if (confirm("Êtes-vous sûr de vouloir supprimer TOUS les joueurs ? Cette action est irréversible et les retirera de tous les matchs.")) {
        currentTeam.players = [];
        if (currentTeam.matches) {
            currentTeam.matches.forEach(match => {
                match.present = [];
                match.played = [];
                match.captainId = null;
                match.substitutions = {};
                match.faults = {};
                match.points = {};
                match.evals = {};
            });
        }
        currentTeam.courtPositions = {};
        await saveData();
        renderPlayerList();
        renderAttendanceForSelectedMatch();
        renderStats();
        renderCourt();
    }
}

function renderPlayerList() {
    const currentTeam = getCurrentTeam();
    const playerListDiv = document.getElementById('playerList');
    const deleteAllBtn = document.getElementById('deleteAllPlayersBtn');
	const countBadge = document.getElementById('roster-count-badge');

    if (!currentTeam || !playerListDiv) return;
	
	if (countBadge) countBadge.textContent = currentTeam.players.length;
	const rosterTitle = document.getElementById('roster-title');
	if (rosterTitle) rosterTitle.textContent = `Effectif de l'équipe ${currentTeam.name || ''}`.trim();

    deleteAllBtn.classList.toggle('hidden', currentTeam.players.length === 0);
    playerListDiv.innerHTML = currentTeam.players.length ? '' : '<p class="text-gray-500">Aucun joueur dans l\'effectif.</p>';

    // Trie les joueurs par numéro de maillot, puis par nom
    const sortedPlayers = [...currentTeam.players].sort((a, b) => {
        const numA = parseInt(a.jerseyNumber);
        const numB = parseInt(b.jerseyNumber);
        const aIsNum = !isNaN(numA);
        const bIsNum = !isNaN(numB);

        if (aIsNum && bIsNum) return numA - numB;
        if (aIsNum) return -1;
        if (bIsNum) return 1;
        return a.name.localeCompare(b.name);
    });


    sortedPlayers.forEach(player => {
        const playerDiv = document.createElement('div');
        const genderClass = player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100';
        playerDiv.className = `flex flex-col sm:flex-row sm:justify-between sm:items-center ${genderClass} p-3 rounded-lg`;
        let positionsText = `P1: ${player.mainPosition || 'N/A'}`;
        if (player.secondaryPosition) {
            positionsText += `, P2: ${player.secondaryPosition}`;
        }
        playerDiv.innerHTML = `
            <div class="flex items-center gap-4 w-full">
                <span class="jersey-badge flex-shrink-0">${player.jerseyNumber || '-'}</span>
                <div class="min-w-0">
                    <p class="font-bold text-lg">${player.name}</p>
                    <p class="text-sm text-gray-600">Licence: ${player.licenseNumber || 'N/A'}</p>
                </div>
            </div>
            <div class="flex flex-col sm:flex-row items-end sm:items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                 <div class="text-left sm:text-right w-full sm:w-auto">
                    <p class="text-sm font-medium text-gray-700">${positionsText}</p>
                 </div>
                <div class="flex gap-2 self-end sm:self-center flex-shrink-0">
                    <button onclick="openEditPlayerModal(${player.id})" class="bg-yellow-500 text-white text-xs font-semibold py-1 px-2 rounded-lg hover:bg-yellow-600">Modifier</button>
                    <button onclick="deletePlayer(${player.id})" class="bg-red-500 text-white text-xs font-semibold py-1 px-2 rounded-lg hover:bg-red-600">X</button>
                </div>
            </div>
        `;
        playerListDiv.appendChild(playerDiv);
    });
}

// ============================
// GESTION DES MATCHS
// ============================
async function createMatch() {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return;
    const date = document.getElementById('matchDate').value;
    const opponent = document.getElementById('opponentName').value.trim();
    const location = document.querySelector('input[name="matchLocation"]:checked').value;
    if (date && opponent) {
        // Récupère tous les IDs des joueurs de l'équipe
        const allPlayerIds = currentTeam.players ? currentTeam.players.map(p => p.id) : [];
        
        // Initialise "present" avec tous les joueurs
        const newMatch = { id: Date.now(), date, opponent, location, present: allPlayerIds, played: [], captainId: null, score: { myTeam: '', opponent: '', sets: Array(5).fill(null).map(() => ({ myTeam: '', opponent: '' })) }, substitutions: {}, faults: {}, points: {}, detailMode: true, forfeitStatus: 'none' };
      
        if (!currentTeam.matches) currentTeam.matches = [];
        currentTeam.matches.push(newMatch); await saveData();
        renderMatchSelector(); const selector = document.getElementById('matchSelector'); selector.value = newMatch.id; selector.dispatchEvent(new Event('change')); closeModal('addMatchModal');
        document.getElementById('matchDate').value = ''; document.getElementById('opponentName').value = ''; document.querySelector('input[name="matchLocation"][value="domicile"]').checked = true;
    } else { alert('Veuillez sélectionner une date et un adversaire.'); }
}

/**
 * Ouvre la modale de modification pour le match actuellement sélectionné
 * et pré-remplit les champs avec les données du match.
 */
function openEditMatchModal() {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;

    const matchIdInput = document.getElementById('matchSelector');
    if (!matchIdInput || !matchIdInput.value) {
        alert("Veuillez d'abord sélectionner un match.");
        return;
    }

    const matchId = parseInt(matchIdInput.value);
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) {
        alert("Erreur : Impossible de trouver le match sélectionné.");
        return;
    }

    const modal = document.getElementById('editMatchModal');
    if (!modal) return; // Sécurité

    // Pré-remplir les champs de la modale
    modal.querySelector('#editMatchId').value = match.id;
    modal.querySelector('#editMatchDate').value = match.date;
    modal.querySelector('#editOpponentName').value = match.opponent;
    
    // Gérer les boutons radio pour le lieu
    const locationRadio = modal.querySelector(`input[name="editMatchLocation"][value="${match.location}"]`);
    if (locationRadio) {
        locationRadio.checked = true;
    }

    // Afficher la modale
    modal.classList.remove('hidden');
}

async function saveMatchChanges() {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return;
    const modal = document.getElementById('editMatchModal'); const matchId = parseInt(modal.querySelector('#editMatchId').value); const match = currentTeam.matches.find(m => m.id === matchId); if (!match) return;
    const newDate = modal.querySelector('#editMatchDate').value; const newOpponent = modal.querySelector('#editOpponentName').value.trim(); const newLocation = modal.querySelector('input[name="editMatchLocation"]:checked').value;
    if (!newDate || !newOpponent) { alert('Veuillez renseigner la date et le nom de l\'adversaire.'); return; }
    match.date = newDate; match.opponent = newOpponent; match.location = newLocation;
    await saveData(); renderMatchSelector(); const selector = document.getElementById('matchSelector'); if (selector.value != matchId) { selector.value = matchId; selector.dispatchEvent(new Event('change')); } else { renderAttendanceForSelectedMatch(); renderLiveTrackingView(); } closeModal('editMatchModal');
}

async function deleteSelectedMatch() {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return; const matchId = parseInt(document.getElementById('matchSelector').value); const matchToDelete = currentTeam.matches.find(m => m.id === matchId); if (!matchToDelete) return;
    if (confirm(`Voulez-vous vraiment supprimer le match contre ${matchToDelete.opponent} du ${new Date(matchToDelete.date.replace(/-/g, '/')).toLocaleDateString('fr-FR')} ?`)) {
        currentTeam.matches = currentTeam.matches.filter(m => m.id !== matchId); if (currentTeam.courtPositions && currentTeam.courtPositions[matchId]) delete currentTeam.courtPositions[matchId]; localStorage.removeItem(`lastSelectedMatch_${appData.currentTeamId}`); await saveData(); renderMatchSelector();
        document.getElementById('matchSelector').value = ''; document.getElementById('matchActions').classList.add('hidden'); document.getElementById('match-hint').classList.remove('hidden'); document.getElementById('selectedMatchContent').classList.add('hidden'); renderLiveTrackingView();
    }
}

// ============================
// IMPORT DES RENCONTRES DEPUIS LA FFVB
// ============================
let ffvbCalendar = []; // [{ code, date (AAAA-MM-JJ), time, home, away }]
// Le site FFVB refuse la lecture directe par le navigateur : on passe par notre fonction Firebase (dossier functions/).
const FFVB_RELAYS = [
    u => 'https://europe-west1-assistant-coach-volley.cloudfunctions.net/ffvbCalendar?url=' + encodeURIComponent(u)
];

function openImportFfvbModal() {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return;
    closeModal('addMatchModal');
    document.getElementById('ffvbUrl').value = currentTeam.rankingUrl || '';
    document.getElementById('ffvbStatus').textContent = '';
    document.getElementById('ffvbStep2').classList.add('hidden');
    document.getElementById('ffvbFileInput').value = '';
    ffvbCalendar = [];
    document.getElementById('importFfvbModal').classList.remove('hidden');
}

function setFfvbStatus(text, isError) {
    const el = document.getElementById('ffvbStatus');
    el.textContent = text; el.className = 'text-sm mt-2 ' + (isError ? 'text-red-600' : 'text-gray-600');
}

// Lit la page HTML du calendrier FFVB (une ligne = un match)
function parseFfvbHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const byCode = new Map();
    doc.querySelectorAll('tr').forEach(tr => {
        const c = [...tr.children].filter(e => e.tagName === 'TD').map(td => td.textContent.trim());
        const d = /^(\d\d)\/(\d\d)\/(\d\d)$/.exec(c[1] || '');
        if (c.length < 6 || !d || !/^[A-Z0-9]+$/.test(c[0]) || !c[3] || !c[5]) return;
        byCode.set(c[0], { code: c[0], date: `20${d[3]}-${d[2]}-${d[1]}`, time: c[2], home: c[3], away: c[5] });
    });
    return [...byCode.values()];
}

// Lit le fichier CSV d'export du calendrier FFVB
function parseFfvbCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const h = (lines.shift() || '').split(';').map(s => s.trim());
    const i = n => h.indexOf(n);
    if ([i('Match'), i('Date'), i('EQA_nom'), i('EQB_nom')].some(x => x < 0)) return [];
    return lines.map(l => l.split(';')).filter(c => /^\d{4}-\d\d-\d\d$/.test(c[i('Date')] || ''))
        .map(c => ({ code: c[i('Match')], date: c[i('Date')], time: c[i('Heure')] || '', home: c[i('EQA_nom')].trim(), away: c[i('EQB_nom')].trim() }));
}

async function fetchFfvbCalendar() {
    let url = document.getElementById('ffvbUrl').value.trim();
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    if (!/^https:\/\/(www\.)?ffvbbeach\.org\//.test(url)) { setFfvbStatus("L'adresse doit être un calendrier du site ffvbbeach.org.", true); return; }
    setFfvbStatus('Récupération du calendrier…', false);
    for (const relay of FFVB_RELAYS) {
        try {
            const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
            const res = await fetch(relay(url), { signal: ctrl.signal }); clearTimeout(timer);
            if (!res.ok) continue;
            const list = parseFfvbHtml(new TextDecoder('windows-1252').decode(await res.arrayBuffer()));
            if (list.length) { showFfvbTeamStep(list); return; }
        } catch (e) { /* on essaie le relais suivant */ }
    }
    setFfvbStatus("Impossible de récupérer le calendrier automatiquement (service relais indisponible ou aucun match trouvé). Réessayez plus tard, ou importez le fichier CSV d'export de la FFVB (bouton ci-dessous).", true);
}

async function loadFfvbCsvFile(input) {
    const file = input.files[0]; if (!file) return;
    const list = parseFfvbCsv(new TextDecoder('windows-1252').decode(await file.arrayBuffer()));
    if (!list.length) { setFfvbStatus("Fichier non reconnu : utilisez le fichier CSV exporté depuis le calendrier FFVB (icône Excel).", true); return; }
    showFfvbTeamStep(list);
}

// Étape 2 : l'utilisateur choisit son équipe parmi celles du calendrier
function showFfvbTeamStep(list) {
    const currentTeam = getCurrentTeam();
    ffvbCalendar = list;
    const teams = [...new Set(list.flatMap(m => [m.home, m.away]))].sort((a, b) => a.localeCompare(b, 'fr'));
    const select = document.getElementById('ffvbTeamSelect');
    select.innerHTML = '<option value="">— Choisissez votre équipe —</option>' + teams.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const guess = teams.find(t => t === currentTeam.ffvbTeamName) || teams.find(t => norm(currentTeam.name) && norm(t) === norm(currentTeam.name));
    if (guess) select.value = guess;
    setFfvbStatus(`${list.length} rencontres trouvées dans le calendrier.`, false);
    document.getElementById('ffvbStep2').classList.remove('hidden');
    renderFfvbMatchList();
}

function ffvbOpponentMatches(m, team) { return m.home === team ? { opponent: m.away, location: 'domicile' } : { opponent: m.home, location: 'exterieur' }; }

function renderFfvbMatchList() {
    const currentTeam = getCurrentTeam(); const team = document.getElementById('ffvbTeamSelect').value;
    const box = document.getElementById('ffvbMatchList'); const btn = document.getElementById('ffvbImportButton');
    if (!team) { box.innerHTML = ''; btn.disabled = true; return; }
    const existing = currentTeam.matches || [];
    const mine = ffvbCalendar.filter(m => m.home === team || m.away === team).sort((a, b) => a.date.localeCompare(b.date));
    box.innerHTML = mine.map(m => {
        const o = ffvbOpponentMatches(m, team);
        const already = existing.some(e => e.ffvbCode === m.code || (e.date === m.date && (e.opponent || '').toLowerCase() === o.opponent.toLowerCase()));
        const label = `${new Date(m.date.replace(/-/g, '/')).toLocaleDateString('fr-FR')}${m.time ? ' ' + m.time : ''} — vs ${o.opponent} (${o.location === 'domicile' ? 'Dom.' : 'Ext.'})`;
        return `<label class="flex items-center gap-2 p-2 rounded ${already ? 'text-gray-400' : 'hover:bg-gray-50'}"><input type="checkbox" value="${escapeHtml(m.code)}" ${already ? 'disabled' : 'checked'} onchange="updateFfvbImportButton()"><span>${escapeHtml(label)}${already ? ' (déjà ajoutée)' : ''}</span></label>`;
    }).join('') || '<p class="text-sm text-gray-500 p-2">Aucune rencontre pour cette équipe.</p>';
    updateFfvbImportButton();
}

function updateFfvbImportButton() {
    document.getElementById('ffvbImportButton').disabled = !document.querySelectorAll('#ffvbMatchList input:checked').length;
}

async function importFfvbMatches() {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return;
    const team = document.getElementById('ffvbTeamSelect').value; if (!team) return;
    const codes = new Set([...document.querySelectorAll('#ffvbMatchList input:checked')].map(i => i.value));
    const allPlayerIds = currentTeam.players ? currentTeam.players.map(p => p.id) : [];
    if (!currentTeam.matches) currentTeam.matches = [];
    let n = 0;
    ffvbCalendar.filter(m => codes.has(m.code)).forEach((m, idx) => {
        const o = ffvbOpponentMatches(m, team);
        currentTeam.matches.push({ id: Date.now() + idx, ffvbCode: m.code, date: m.date, opponent: o.opponent, location: o.location, present: [...allPlayerIds], played: [], captainId: null, score: { myTeam: '', opponent: '', sets: Array(5).fill(null).map(() => ({ myTeam: '', opponent: '' })) }, substitutions: {}, faults: {}, points: {}, detailMode: true, forfeitStatus: 'none' });
        n++;
    });
    currentTeam.ffvbTeamName = team;
    await saveData(); renderMatchSelector(); closeModal('importFfvbModal');
    alert(`${n} rencontre(s) ajoutée(s).`);
}

function formatMatchTitle(match) {
    if (!match) return ''; const date = new Date(match.date.replace(/-/g, '/')).toLocaleDateString('fr-FR'); const location = match.location === 'domicile' ? '(Dom.)' : '(Ext.)'; let statusText = ''; if (match.forfeitStatus === 'win') statusText = ' [Forfait G]'; else if (match.forfeitStatus === 'loss') statusText = ' [Forfait P]'; return `Match du ${date} vs ${match.opponent} ${location}${statusText}`;
}

function renderMatchSelector() {
    const currentTeam = getCurrentTeam(); 
    const selector = document.getElementById('matchSelector'); 
    const selectorButton = document.getElementById('matchSelectButton'); // Le bouton visible
    if (!selector || !selectorButton) return; 

    const currentSelectedMatchId = selector.value; 
    selector.innerHTML = '<option value="">-- Sélectionnez un match --</option>';
    
    if(currentTeam && currentTeam.matches && currentTeam.matches.length > 0) { 
        const sortedMatches = [...currentTeam.matches].sort((a, b) => new Date(b.date) - new Date(a.date)); 
        sortedMatches.forEach(match => { 
            const option = document.createElement('option'); 
            option.value = match.id; 
            option.textContent = formatMatchTitle(match); 
            selector.appendChild(option); 
        }); 
        
        if (currentSelectedMatchId && selector.querySelector(`option[value="${currentSelectedMatchId}"]`)) { 
            selector.value = currentSelectedMatchId; 
        } else { 
            const savedMatchId = localStorage.getItem(`lastSelectedMatch_${appData.currentTeamId}`); 
            if (savedMatchId && selector.querySelector(`option[value="${savedMatchId}"]`)) { 
                selector.value = savedMatchId; 
            } else { 
                selector.value = ''; 
            } 
        } 
    } else { 
        selector.value = ''; 
    }
    
    // Met à jour le texte du bouton avec l'option sélectionnée
    const selectedOption = selector.options[selector.selectedIndex];
    if (selectedOption) {
        selectorButton.textContent = selectedOption.textContent;
    } else {
        selectorButton.textContent = '-- Sélectionnez un match --';
    }
}

function renderAttendanceForSelectedMatch() {
    const currentTeam = getCurrentTeam();
    const selector = document.getElementById('matchSelector');
    const matchId = parseInt(selector.value);
    const selectedMatchContentDiv = document.getElementById('selectedMatchContent');
    const attendanceList = document.getElementById('attendanceList');
    const attendanceToggleIcon = document.getElementById('attendance-toggle-icon');
	
	// AJOUT : Récupère le badge des présents
    const presentBadge = document.getElementById('match-present-count-badge');
	
    if (!matchId || !currentTeam || !attendanceList || !selectedMatchContentDiv) {
         if (selectedMatchContentDiv) selectedMatchContentDiv.classList.add('hidden');
         if(attendanceList) attendanceList.innerHTML = ''; // Clear list if no match selected
         // Reset toggle state if no match
         if (attendanceToggleIcon && !attendanceToggleIcon.classList.contains('-rotate-180')) {
            attendanceToggleIcon.classList.add('-rotate-180');
         }
         if (attendanceList && !attendanceList.classList.contains('hidden')) {
             attendanceList.classList.add('hidden');
         }
        if (presentBadge) presentBadge.textContent = '0'; // Remet à 0 si rien
        return;
    }

    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) {
         selectedMatchContentDiv.classList.add('hidden');
         attendanceList.innerHTML = '';
          // Reset toggle state if match not found
         if (attendanceToggleIcon && !attendanceToggleIcon.classList.contains('-rotate-180')) {
            attendanceToggleIcon.classList.add('-rotate-180');
         }
          if (attendanceList && !attendanceList.classList.contains('hidden')) {
             attendanceList.classList.add('hidden');
         }
        if (presentBadge) presentBadge.textContent = '0'; // Remet à 0 si pas de match
        return;
    }
	
	// AJOUT : Met à jour le badge avec le nombre d'IDs dans le tableau 'present'
    if (presentBadge) {
        presentBadge.textContent = `${match.present.length} présent(s)`;
    }

    selectedMatchContentDiv.classList.remove('hidden'); // Ensure container is visible
    attendanceList.innerHTML = ''; // Clear previous list

    // Calculate set counts for each player in this match
    const matchSetCounts = {};
    if (currentTeam.players) {
        currentTeam.players.forEach(player => { matchSetCounts[player.id] = 0; });

        SETS.forEach(setName => {
            const setPositions = (currentTeam.courtPositions && currentTeam.courtPositions[matchId] && currentTeam.courtPositions[matchId][setName]) || {};
            const setSubs = (match.substitutions && match.substitutions[setName]) || [];

            // Count players starting the set (court + libero)
            Object.values(setPositions).forEach(playerId => {
                if (playerId && matchSetCounts.hasOwnProperty(playerId)) {
                    // Count only once per set, even if they switch positions via libero rule later (handled by sub logic)
                     // A simple way is to use a temporary set for players already counted in this set
                     const countedInThisSet = new Set();
                     if (!countedInThisSet.has(playerId)) {
                         matchSetCounts[playerId]++;
                         countedInThisSet.add(playerId);
                     }
                }
            });

             // Count players coming in as substitutes
             const subbedInThisSet = new Set();
             setSubs.forEach(sub => {
                 const playerId = sub.in;
                 // Count only if they haven't started and haven't already subbed in THIS SET
                 if (playerId && matchSetCounts.hasOwnProperty(playerId) && !Object.values(setPositions).includes(playerId) && !subbedInThisSet.has(playerId)) {
                     matchSetCounts[playerId]++;
                     subbedInThisSet.add(playerId);
                 }
             });
        });

        // Sort players by jersey number
        const sortedPlayers = [...currentTeam.players].sort((a, b) => {
            const numA = parseInt(a.jerseyNumber); const numB = parseInt(b.jerseyNumber);
            const aIsNum = !isNaN(numA); const bIsNum = !isNaN(numB);
            if (aIsNum && bIsNum) return numA - numB;
            if (aIsNum) return -1; if (bIsNum) return 1;
            return a.name.localeCompare(b.name);
        });

        sortedPlayers.forEach(player => {
            const isPresent = match.present.includes(player.id);
            const isCaptain = match.captainId === player.id;
            const setCount = matchSetCounts[player.id] || 0;
            const playerRow = document.createElement('div');
            const genderClass = player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100';
            playerRow.className = `flex flex-wrap justify-between items-center py-2 px-3 ${genderClass} rounded-lg gap-2`;
            playerRow.innerHTML = `
                <div class="flex items-center min-w-0">
                    <b class="w-8 inline-block flex-shrink-0">#${player.jerseyNumber || '-'}</b>
                    <span class="font-medium">${player.name}</span>
                </div>
                <div class="flex items-center gap-2 sm:gap-4 flex-shrink-0 w-full sm:w-auto justify-end">
                    <span class="font-semibold text-gray-700 text-sm">${setCount} set(s)</span>
                    <label class="flex items-center gap-1 cursor-pointer" title="Capitaine">
                        <input type="checkbox" onchange="updateCaptain(this, ${matchId}, ${player.id})" ${isPresent ? '' : 'disabled'} ${isCaptain ? 'checked' : ''} class="captain-checkbox">
                        <!-- Removed text C, using ::after in CSS -->
                    </label>
                    <label class="flex items-center gap-1 sm:gap-2 cursor-pointer">
                        <input type="checkbox" onchange="updatePresence(${matchId}, ${player.id}, this.checked)" ${isPresent ? 'checked' : ''} class="w-5 h-5 rounded text-blue-500 border-gray-300 focus:ring-blue-400">
                        <span class="text-sm">Présent</span>
                    </label>
                </div>`;
            attendanceList.appendChild(playerRow);
        });
    }

    // Render other components that depend on the selected match
    renderCourt();
    renderScoreTracker(match);
    renderSubstitutions();
}


async function updateCaptain(checkboxElem, matchId, playerId) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) return;

    // Uncheck all other captain checkboxes visually
    document.querySelectorAll('.captain-checkbox').forEach(box => {
        if (box !== checkboxElem) {
            box.checked = false;
        }
    });

    // Update captainId in the match data
    if (checkboxElem.checked) {
        match.captainId = playerId;
        console.log(`Set captain to player ID: ${playerId}`);
    } else {
        // Only unset if this specific checkbox was the one being unchecked
        if (match.captainId === playerId) {
            match.captainId = null;
            console.log(`Unset captain (was player ID: ${playerId})`);
        }
    }

    await saveData(); // Save changes
    // Re-render attendance to ensure disabled states are correct if presence changes
    renderAttendanceForSelectedMatch();
}


function renderScoreTracker(match) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam || !match) return; // Add check for match existence

    const myTeamLabel = document.getElementById('myTeamNameLabel');
    const opponentLabel = document.getElementById('opponentNameLabel');
    const scoreMyTeamInput = document.getElementById('scoreMyTeam');
    const scoreOpponentInput = document.getElementById('scoreOpponent');
    const setScoresContainer = document.getElementById('setScoresContainer');
    const statusDisplay = document.getElementById('forfeit-status-display');
    const forfeitButtons = document.getElementById('forfeit-buttons');
    const cancelForfeitButton = document.getElementById('cancel-forfeit-button');

    if (myTeamLabel) myTeamLabel.textContent = currentTeam.name;
    if (opponentLabel) opponentLabel.textContent = match.opponent;

    // Ensure score structure exists
    if (!match.score) match.score = { myTeam: '', opponent: '', sets: Array(5).fill(null).map(() => ({ myTeam: '', opponent: '' })) };
    if (!match.score.sets || match.score.sets.length !== 5) { // Ensure exactly 5 sets
         const validSets = Array.isArray(match.score.sets) ? match.score.sets : [];
         match.score.sets = Array(5).fill(null).map((_, i) =>
             validSets[i] || { myTeam: '', opponent: '' }
         );
    }
     // Ensure each set is a valid object
     match.score.sets = match.score.sets.map(s => (s && typeof s === 'object' ? s : { myTeam: '', opponent: '' }));


    if (!match.forfeitStatus) match.forfeitStatus = 'none';

    if (setScoresContainer) {
        setScoresContainer.innerHTML = '';
        match.score.sets.forEach((set, index) => {
            const setRow = document.createElement('div');
            // Use justify-between to push label and inputs apart
            setRow.className = 'flex items-center justify-between';
            setRow.innerHTML = `
                <label class="font-semibold">Set ${index + 1}</label>
                <div class="flex items-center gap-2">
                    <input type="number" min="0" data-set-index="${index}" data-team="myTeam" class="set-score-input w-20 p-2 border border-gray-300 rounded-lg text-center" value="${set.myTeam || ''}">
                    <span>-</span>
                    <input type="number" min="0" data-set-index="${index}" data-team="opponent" class="set-score-input w-20 p-2 border border-gray-300 rounded-lg text-center" value="${set.opponent || ''}">
                </div>
            `;
            setScoresContainer.appendChild(setRow);
        });

        // Re-attach listeners after rebuilding inputs
        document.querySelectorAll('.set-score-input').forEach(input => {
            input.oninput = updateScore; // Ensure this calls the async version
        });
    }

    updateFinalScore(match); // Updates the main score inputs

    // Update forfeit UI
    const scoreInputs = document.querySelectorAll('.set-score-input'); // Select again after potential rebuild
    if (match.forfeitStatus === 'win' || match.forfeitStatus === 'loss') {
        if(statusDisplay) {
            statusDisplay.textContent = `Statut : ${match.forfeitStatus === 'win' ? 'Victoire' : 'Défaite'} par Forfait`;
            statusDisplay.className = `text-center font-semibold mb-2 ${match.forfeitStatus === 'win' ? 'text-green-600' : 'text-red-600'}`;
            statusDisplay.classList.remove('hidden');
        }
        if(forfeitButtons) forfeitButtons.classList.add('hidden');
        if(cancelForfeitButton) cancelForfeitButton.classList.remove('hidden');
        scoreInputs.forEach(input => input.disabled = true);
    } else {
        if(statusDisplay) statusDisplay.classList.add('hidden');
        if(forfeitButtons) forfeitButtons.classList.remove('hidden');
        if(cancelForfeitButton) cancelForfeitButton.classList.add('hidden');
        scoreInputs.forEach(input => input.disabled = false);
    }
}


function updateFinalScore(match) {
    if (!match || !match.score) return; // Guard against missing data

    let myTeamSetsWon = 0;
    let opponentSetsWon = 0;

    if (match.forfeitStatus !== 'none') {
        // Score is already set correctly by setForfeit function
        myTeamSetsWon = match.score.myTeam || 0;
        opponentSetsWon = match.score.opponent || 0;
    } else if (match.score.sets) {
        match.score.sets.forEach(set => {
            if (set && typeof set === 'object') { // Check if set is a valid object
                const myTeamScore = parseInt(set.myTeam, 10);
                const opponentScore = parseInt(set.opponent, 10);

                // Count set only if both scores are valid numbers and at least one is > 0
                if (!isNaN(myTeamScore) && !isNaN(opponentScore) && (myTeamScore > 0 || opponentScore > 0) ) {
                    if (myTeamScore > opponentScore) {
                        myTeamSetsWon++;
                    } else if (opponentScore > myTeamScore) {
                        opponentSetsWon++;
                    }
                }
            }
        });
        // Update the main score in the data object
        match.score.myTeam = myTeamSetsWon;
        match.score.opponent = opponentSetsWon;
    }

    // Update the UI input fields
    const scoreMyTeamInput = document.getElementById('scoreMyTeam');
    const scoreOpponentInput = document.getElementById('scoreOpponent');
    if (scoreMyTeamInput) scoreMyTeamInput.value = myTeamSetsWon;
    if (scoreOpponentInput) scoreOpponentInput.value = opponentSetsWon;
}


async function updateScore() {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const matchId = parseInt(document.getElementById('matchSelector').value);
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) return;

    // If entering score manually, cancel any existing forfeit status
    if (match.forfeitStatus !== 'none') {
        match.forfeitStatus = 'none';
        // Update UI related to forfeit status immediately
        document.getElementById('forfeit-status-display').classList.add('hidden');
        document.getElementById('forfeit-buttons').classList.remove('hidden');
        document.getElementById('cancel-forfeit-button').classList.add('hidden');
        document.querySelectorAll('.set-score-input').forEach(input => input.disabled = false);
    }

    // Update the appData object based on input fields
    document.querySelectorAll('.set-score-input').forEach(input => {
        const setIndex = parseInt(input.dataset.setIndex);
        const team = input.dataset.team;
        // Ensure score structure exists before assignment
        if (!match.score) match.score = { myTeam: '', opponent: '', sets: Array(5).fill(null).map(() => ({ myTeam: '', opponent: '' })) };
        if (!match.score.sets) match.score.sets = Array(5).fill(null).map(() => ({ myTeam: '', opponent: '' }));
        if (!match.score.sets[setIndex]) match.score.sets[setIndex] = { myTeam: '', opponent: '' };

        match.score.sets[setIndex][team] = input.value;
    });

    // Recalculate and update the final set scores in the UI and data
    updateFinalScore(match);
    await saveData(); // Save the changes to Firestore and localStorage
    // Re-render match selector ONLY to update the score potentially shown in the title
     renderMatchSelector();
     // No need to call renderScoreTracker again, as UI was updated by updateFinalScore
}


async function setForfeit(status) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const matchId = parseInt(document.getElementById('matchSelector').value);
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) return;

    match.forfeitStatus = status;

    // Standard forfeit scores
    const winScore = { myTeam: 25, opponent: 0 };
    const lossScore = { myTeam: 0, opponent: 25 };
    const emptyScore = { myTeam: '', opponent: '' };

    if (status === 'win') {
        match.score = { myTeam: 3, opponent: 0, sets: [ winScore, winScore, winScore, emptyScore, emptyScore ] };
    } else if (status === 'loss') {
         match.score = { myTeam: 0, opponent: 3, sets: [ lossScore, lossScore, lossScore, emptyScore, emptyScore ] };
    } else { // status === 'none'
        match.score = { myTeam: '', opponent: '', sets: Array(5).fill(null).map(() => ({ myTeam: '', opponent: '' })) };
    }

    await saveData();
    renderScoreTracker(match); // Update UI for score inputs and forfeit buttons
    renderMatchSelector(); // Update score/status in dropdown
    renderResults(); // Update results table
    renderStats(); // Update stats table
}


async function updatePresence(matchId, playerId, isChecked) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) return;

    if (isChecked) {
        if (!match.present.includes(playerId)) {
            match.present.push(playerId);
        }
    } else {
        match.present = match.present.filter(id => id !== playerId);
        // If player is removed from present, also remove as captain and from court/subs/faults
        if (match.captainId === playerId) {
            match.captainId = null;
        }
        if (currentTeam.courtPositions && currentTeam.courtPositions[matchId]) {
            SETS.forEach(setKey => {
                if (currentTeam.courtPositions[matchId][setKey]) {
                    const setPositions = currentTeam.courtPositions[matchId][setKey];
                    for (const pos in setPositions) {
                        if (setPositions[pos] === playerId) {
                            delete setPositions[pos];
                        }
                    }
                }
            });
        }
         if (match.substitutions) {
             SETS.forEach(setKey => {
                 if (match.substitutions[setKey]) {
                     match.substitutions[setKey] = match.substitutions[setKey].filter(sub => sub.in !== playerId && sub.out !== playerId);
                 }
             });
         }
         if (match.faults) {
              SETS.forEach(setKey => {
                  if (match.faults[setKey] && match.faults[setKey][playerId]) {
                      delete match.faults[setKey][playerId];
                  }
              });
         }
        // Recalculate played status immediately after modifications
        recalculatePlayedStatus(matchId);
    }

    await saveData();
    renderAttendanceForSelectedMatch(); // Re-render the attendance list with updated state (incl. captain disable state)
    renderCourt(); // Re-render court as player availability changed
    renderLiveTrackingView(); // Re-render live view as player might have disappeared
}



// ============================
// COMPOSITION & SUBSTITUTIONS
// ============================
function renderSetSelector() {
    const selectors = [document.getElementById('set-selector-matches'), document.getElementById('set-selector-live')];
    selectors.forEach(selectorDiv => {
        if(!selectorDiv) return;
        selectorDiv.innerHTML = '';
        SETS.forEach((setName, index) => {
            const button = document.createElement('button');
            button.textContent = `Set ${index + 1}`;
            button.className = `set-button flex-1 py-2 px-4 text-sm font-semibold rounded-md ${currentSet === setName ? 'active bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`; // Added base styles
            button.onclick = () => selectSet(setName);
            selectorDiv.appendChild(button);
        });
    });
}

function setCourtPositionColor(selectElement, playerId) {
    const currentTeam = getCurrentTeam();
    selectElement.classList.remove('bg-pink-100', 'bg-blue-100', 'bg-white'); // Reset colors

    if (playerId && currentTeam) {
        const player = currentTeam.players.find(p => p.id === parseInt(playerId));
        if (player) {
            selectElement.classList.add(player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100');
            return;
        }
    }
    // Default background if no player or player not found
    selectElement.classList.add('bg-white');
}

function renderCourt() {
    const currentTeam = getCurrentTeam();
    const matchId = parseInt(document.getElementById('matchSelector').value);
    const liberoContainer = document.getElementById('libero-selector-container');

    // D'abord, vide les anciens éléments (plus de <select>)
    for (let i = 1; i <= 6; i++) {
        const posDiv = document.getElementById(`pos-${i}`);
        if (posDiv) {
            const oldButton = posDiv.querySelector('.player-select-button');
            if (oldButton) posDiv.removeChild(oldButton);
        }
    }
    if (liberoContainer) liberoContainer.innerHTML = '';

    if (!matchId || !currentTeam || !currentTeam.players) {
        return; // Sort si pas de match, équipe, ou joueurs
    }

    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) return; // Sort si le match n'est pas trouvé

    // Assure que la structure courtPositions existe
    if (!currentTeam.courtPositions) currentTeam.courtPositions = {};
    if (!currentTeam.courtPositions[matchId]) currentTeam.courtPositions[matchId] = {};
    if (!currentTeam.courtPositions[matchId][currentSet]) currentTeam.courtPositions[matchId][currentSet] = {};

    const setPositions = currentTeam.courtPositions[matchId][currentSet];
    const presentPlayers = currentTeam.players.filter(p => match.present.includes(p.id));

    // Fonction interne pour créer le bouton de sélection
    const createPlayerButton = (positionKey, playerId) => {
        const player = playerId ? presentPlayers.find(p => p.id === playerId) : null;
        const button = document.createElement('button');
        button.className = 'player-select-button w-full p-2 rounded border text-left truncate text-xs';
        
        if (player) {
            button.textContent = `${player.jerseyNumber || '#'}.${player.name}`;
        } else {
            button.textContent = positionKey === 'libero' ? '-- Choisir un libéro --' : '-- Choisir --';
            button.classList.add('text-gray-500');
        }
        
        button.onclick = () => openPositionSelectModal(positionKey);
        
        // Applique la couleur (rose/bleu/blanc)
        setCourtPositionColor(button, playerId); // setCourtPositionColor fonctionne aussi sur les boutons
        return button;
    };

    // Rendu des 6 positions du terrain
    for (let i = 1; i <= 6; i++) {
        const posDiv = document.getElementById(`pos-${i}`);
        const positionKey = `pos-${i}`;
        if (!posDiv) continue;

        const currentPlayerIdForThisPos = setPositions[positionKey];
        const button = createPlayerButton(positionKey, currentPlayerIdForThisPos);
        posDiv.appendChild(button);
    }

    // Rendu du sélecteur de Libéro
    if (liberoContainer) {
        const liberoId = setPositions.libero;
        const button = createPlayerButton('libero', liberoId);
        liberoContainer.appendChild(button);
    }
}


/**
 * Fonction utilitaire pour comparer deux objets de composition.
 * (Nécessaire car JSON.stringify n'est pas fiable si l'ordre des clés change).
 * @param {object} compoA - Le premier objet (ex: { 'pos-1': 1, 'libero': 2 })
 * @param {object} compoB - Le second objet
 * @returns {boolean} - Vrai s'ils sont identiques.
 */
function areCompositionsEqual(compoA, compoB) {
    // Gère les cas où un (ou les deux) sont vides/null/undefined
    if (!compoA && !compoB) return true; // Deux sets vides sont "égaux"
    if (!compoA || !compoB) return false; // Un vide et un plein ne sont pas égaux

    const keysA = Object.keys(compoA);
    const keysB = Object.keys(compoB);

    // S'ils n'ont pas le même nombre de joueurs, ils sont différents
    if (keysA.length !== keysB.length) {
        return false;
    }

    // Vérifie que chaque joueur est à la même place
    for (const key of keysA) {
        if (compoA[key] !== compoB[key]) {
            return false;
        }
    }
    
    // Si toutes les vérifications passent, ils sont égaux
    return true;
}


/**
 * Met à jour la position d'un joueur sur le terrain pour le set courant
 * ET propage ce changement aux sets suivants (cascade "intelligente").
 * @param {string} position - La position à mettre à jour (ex: 'pos-1' ou 'libero').
 * @param {number | null} playerId - L'ID du joueur, ou null pour vider.
 * @param {boolean} [forceCloseModal=false] - Si true, ferme la modale de sélection.
 */
async function updatePosition(position, playerId, forceCloseModal = false) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const matchId = parseInt(document.getElementById('matchSelector').value);
    if (!matchId) return;

    // Si on a cliqué sur "Vider", le playerId est null, c'est géré
    
    // Ferme la modale IMMÉDIATEMENT si demandé (pour une meilleure réactivité)
    if (forceCloseModal) {
        closeModal('genericSelectModal');
    }

    if (!currentTeam.courtPositions[matchId]) currentTeam.courtPositions[matchId] = {};
    if (!currentTeam.courtPositions[matchId][currentSet]) currentTeam.courtPositions[matchId][currentSet] = {};

    const matchPositions = currentTeam.courtPositions[matchId];
    
    // 1. Snapshot de la compo ACTUELLE (AVANT modification)
    const originalCurrentSetCompo = JSON.parse(JSON.stringify(matchPositions[currentSet] || {}));

    const setPositions = matchPositions[currentSet]; // Référence à la compo actuelle

    // --- Logique de résolution des conflits (inchangée) ---
    if (playerId) {
        if (position === 'libero') {
            for (const pos in setPositions) {
                if (pos.startsWith('pos-') && setPositions[pos] === playerId) {
                    delete setPositions[pos];
                }
            }
        } else { 
            if (setPositions.libero === playerId) {
                delete setPositions.libero;
            }
             for (const pos in setPositions) {
                if (pos.startsWith('pos-') && pos !== position && setPositions[pos] === playerId) {
                    delete setPositions[pos];
                }
            }
        }
    }

    // --- Mise à jour de la position (inchangée) ---
    if (playerId) {
        setPositions[position] = playerId;
    } else {
        // S'assure de supprimer la clé si le playerId est null (cas "Vider")
        delete setPositions[position];
    }
    // 'setPositions' contient maintenant la NOUVELLE composition

    // --- Logique de Cascade (inchangée) ---
    const currentSetIndex = SETS.indexOf(currentSet);

    for (let i = currentSetIndex + 1; i < SETS.length; i++) {
        const subsequentSetName = SETS[i]; 
        const subsequentSetCompo = matchPositions[subsequentSetName] || {};

        if (areCompositionsEqual(subsequentSetCompo, originalCurrentSetCompo)) {
            console.log(`Cascade: Mise à jour de ${subsequentSetName} depuis ${currentSet}.`);
            matchPositions[subsequentSetName] = JSON.parse(JSON.stringify(setPositions));
        } else {
            console.log(`Cascade: Arrêt à ${subsequentSetName} (modification manuelle détectée).`);
            break; 
        }
    }
    // --- FIN DE LA LOGIQUE DE CASCADE ---

    // --- Sauvegarde et rendu (inchangés) ---
    recalculatePlayedStatus(matchId); 
    await saveData(); 

    renderCourt();
    renderAttendanceForSelectedMatch(); 
    renderSubstitutions(); 
    renderLiveTrackingView(); 
}


/**
 * Efface la composition (terrain + libéro) du set actuellement sélectionné.
 */
async function clearCurrentSetComposition() {
    const currentTeam = getCurrentTeam();
    const matchId = parseInt(document.getElementById('matchSelector').value);
    
    if (!currentTeam || !matchId) return;

    if (!confirm(`Voulez-vous vraiment vider toute la composition du ${currentSet.replace('set', 'Set ')} ?`)) {
        return;
    }

    // S'assurer que la structure de base existe
    if (!currentTeam.courtPositions) currentTeam.courtPositions = {};
    if (!currentTeam.courtPositions[matchId]) currentTeam.courtPositions[matchId] = {};

    // Vider la composition
    currentTeam.courtPositions[matchId][currentSet] = {};
    console.log(`Composition du ${currentSet} vidée.`);

    // Recalculer le statut "joué" (car les joueurs ont été retirés)
    recalculatePlayedStatus(matchId); 
    
    // Sauvegarder les changements
    await saveData();

    // Mettre à jour l'interface
    renderCourt(); // Affiche les listes déroulantes vides
    renderAttendanceForSelectedMatch(); // Met à jour les comptages de sets
}


function renderSubstitutions() {
    const subsList = document.getElementById('substitutionsList');
    const currentTeam = getCurrentTeam();
    const matchId = parseInt(document.getElementById('matchSelector').value);

    if (!subsList || !currentTeam || !matchId) {
        if(subsList) subsList.innerHTML = '';
        return;
    }

    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match || !match.substitutions || !match.substitutions[currentSet] || match.substitutions[currentSet].length === 0) {
        subsList.innerHTML = '<p class="text-gray-500 text-sm">Aucun remplacement pour ce set.</p>';
        return;
    }

    subsList.innerHTML = '';
    match.substitutions[currentSet].forEach(sub => {
        const playerOut = currentTeam.players.find(p => p.id === sub.out)?.name || `ID ${sub.out}`;
        const playerIn = currentTeam.players.find(p => p.id === sub.in)?.name || `ID ${sub.in}`;
        const subDiv = document.createElement('div');
        subDiv.className = 'text-sm p-2 bg-gray-100 rounded';
        subDiv.textContent = `Entrée de ${playerIn} à la place de ${playerOut}`;
        subsList.appendChild(subDiv);
    });
}


function recalculatePlayedStatus(matchId) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) return;

    const playedIds = new Set();
    // Check court positions for all sets of this match
    if (currentTeam.courtPositions && currentTeam.courtPositions[matchId]) {
        SETS.forEach(setKey => {
            if (currentTeam.courtPositions[matchId][setKey]) {
                const setPositions = currentTeam.courtPositions[matchId][setKey];
                Object.values(setPositions).forEach(playerId => {
                     if (playerId) playedIds.add(playerId); // Add players from court and libero
                });
            }
        });
    }
    // Check substitutions for all sets of this match
    if (match.substitutions) {
        SETS.forEach(setKey => {
            if (match.substitutions[setKey]) {
                match.substitutions[setKey].forEach(sub => {
                    if (sub.in) playedIds.add(sub.in); // Add players who subbed in
                });
            }
        });
    }
    match.played = Array.from(playedIds);
     console.log(`Recalculated played status for match ${matchId}:`, match.played);
}

function openSubstitutionModal(playerIdToReplace) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam || !currentTeam.players) return;
    const matchId = parseInt(document.getElementById('matchSelector').value);
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) return;
    const playerToReplace = currentTeam.players.find(p => p.id === playerIdToReplace);
    if (!playerToReplace) return;

    const modalTitle = document.getElementById('substitutionModalTitle');
    const substitutesListDiv = document.getElementById('substitutesList');
    if (!modalTitle || !substitutesListDiv) return;

    modalTitle.textContent = `Remplacer ${playerToReplace.name}`;
    substitutesListDiv.innerHTML = ''; // Clear previous list

    // Ensure structures exist
    const setPositions = (currentTeam.courtPositions && currentTeam.courtPositions[matchId] && currentTeam.courtPositions[matchId][currentSet]) || {};
    const onCourtPlayerIds = Object.keys(setPositions)
        .filter(pos => pos.startsWith('pos-'))
        .map(pos => setPositions[pos]).filter(Boolean);
    const liberoId = setPositions.libero;

    // Determine if replacing the libero
    const isReplacingLibero = (playerIdToReplace === liberoId);
     if (isReplacingLibero) {
        modalTitle.textContent = `Remplacer le Libéro`;
     }


    // Filter available substitutes
    let availableSubstitutes = currentTeam.players.filter(p => {
        // Must be present, not currently on court (in pos-X), and not the current libero
        const isOnCourt = onCourtPlayerIds.includes(p.id);
        const isCurrentLibero = p.id === liberoId;
        return match.present.includes(p.id) && !isOnCourt && !isCurrentLibero;
    });

    // If replacing libero, filter further to only show other liberos
    if (isReplacingLibero) {
        availableSubstitutes = availableSubstitutes.filter(p =>
            p.mainPosition === 'Libéro' || p.secondaryPosition === 'Libéro'
        );
    } else {
        // If replacing a court player, cannot sub in the current libero
         // This is already handled by the initial filter, but double check:
         availableSubstitutes = availableSubstitutes.filter(p => p.id !== liberoId);
    }

    if (availableSubstitutes.length === 0) {
        substitutesListDiv.innerHTML = `<p class="text-gray-500">Aucun remplaçant éligible disponible.</p>`;
    } else {
        availableSubstitutes.forEach(sub => {
            const subButton = document.createElement('button');
            subButton.className = 'w-full text-left p-3 bg-gray-100 rounded-lg hover:bg-blue-100 transition';
            subButton.innerHTML = `<span class="font-bold">#${sub.jerseyNumber || '-'}</span> ${sub.name}`;
            subButton.onclick = () => executeSubstitution(playerIdToReplace, sub.id);
            substitutesListDiv.appendChild(subButton);
        });
    }

    document.getElementById('substitutionModal').classList.remove('hidden');
}


async function executeSubstitution(playerOutId, playerInId) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const matchId = parseInt(document.getElementById('matchSelector').value);
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) return;

    // Ensure structures exist
    if (!currentTeam.courtPositions || !currentTeam.courtPositions[matchId] || !currentTeam.courtPositions[matchId][currentSet]) {
         alert("Erreur: Impossible de trouver la composition du set.");
         return;
    }

    const matchPositions = currentTeam.courtPositions[matchId];
    const setPositions = matchPositions[currentSet];
    
    // --- 1. SNAPSHOT AVANT MODIFICATION (Pour la cascade) ---
    // On sauvegarde l'état de la compo AVANT le remplacement pour comparer avec les sets suivants
    const compositionBeforeSub = JSON.parse(JSON.stringify(setPositions));
    
    let positionToUpdate = null;

    // Find position of player going out (could be court or libero)
    if (setPositions.libero === playerOutId) {
        positionToUpdate = 'libero';
    } else {
        for (const pos in setPositions) {
            if (pos.startsWith('pos-') && setPositions[pos] === playerOutId) {
                positionToUpdate = pos;
                break;
            }
        }
    }

    if (positionToUpdate) {
        // --- Conflict check before applying ---
        const playerComingIn = currentTeam.players.find(p => p.id === playerInId);
        const isPlayerInLibero = playerComingIn?.mainPosition === 'Libéro' || playerComingIn?.secondaryPosition === 'Libéro';

        if (positionToUpdate === 'libero' && !isPlayerInLibero) {
            alert("Erreur: Seul un autre libéro peut remplacer le libéro.");
            return;
        }
        if (positionToUpdate.startsWith('pos-') && isPlayerInLibero) {
             console.warn("Substitution: Libero potentially entering a court position.");
        }

        // --- Apply the change ---
        setPositions[positionToUpdate] = playerInId;

        // Record the substitution
        if (!match.substitutions) match.substitutions = {};
        if (!match.substitutions[currentSet]) match.substitutions[currentSet] = [];
        match.substitutions[currentSet].push({ out: playerOutId, in: playerInId });

        // --- 2. LOGIQUE DE CASCADE (Propagation aux sets suivants) ---
        // Si les sets suivants étaient identiques à la compo d'avant le changement,
        // on considère qu'ils suivent le set actuel et on les met à jour.
        const currentSetIndex = SETS.indexOf(currentSet);

        for (let i = currentSetIndex + 1; i < SETS.length; i++) {
            const subsequentSetName = SETS[i]; 
            const subsequentSetCompo = matchPositions[subsequentSetName] || {};

            // On compare avec compositionBeforeSub (l'ancienne version)
            if (areCompositionsEqual(subsequentSetCompo, compositionBeforeSub)) {
                console.log(`Cascade (Sub): Mise à jour de ${subsequentSetName} suite au remplacement dans ${currentSet}.`);
                // On applique la NOUVELLE composition (setPositions) au set suivant
                matchPositions[subsequentSetName] = JSON.parse(JSON.stringify(setPositions));
            } else {
                console.log(`Cascade (Sub): Arrêt à ${subsequentSetName} (modification manuelle détectée).`);
                break; 
            }
        }
        // --- FIN DE LA CASCADE ---

        recalculatePlayedStatus(matchId); // Recalculate based on new state
        await saveData(); // Save the updated state

        closeModal('substitutionModal');
        // Re-render relevant parts of the UI
        renderCourt(); // Update court dropdowns
        renderAttendanceForSelectedMatch(); // Update set counts
        renderSubstitutions(); // Update substitution list display
        renderLiveTrackingView(); // Update the live tracking view
    } else {
        alert("Erreur : Le joueur à remplacer n'a pas été trouvé sur le terrain ou comme libéro.");
    }
}


// ============================
// STATISTIQUES
// ============================
function renderStats() {
    renderPlayerStats();
    renderTeamStats();
}

// Moyenne pondérée (++ = 100 %, + = 75 %, - = 25 %, -- = 0 %) sur toutes les notes des critères affichés ; null s'il n'y a aucune note
function weightedValue(counts, columns) {
    let points = 0; let total = 0;
    columns.forEach(c => EVAL_LEVELS.forEach(l => {
        const n = counts[`${c.id}_${l.id}`] || 0;
        total += n;
        points += n * l.weight;
    }));
    return total ? Math.round(points / total) : null;
}

// Pastille colorée pour une moyenne : vert >= 70 %, jaune >= 50 %, orange >= 30 %, rouge en dessous
function averageBadge(value) {
    if (value === null) return '<span class="text-gray-300">–</span>';
    const color = value >= 70 ? 'bg-green-100 text-green-800' : value >= 50 ? 'bg-yellow-100 text-yellow-800' : value >= 30 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800';
    return `<span class="inline-block min-w-[3.5rem] px-2 py-1 rounded-full text-sm font-bold ${color}">${value} %</span>`;
}

// Couleurs des notes : en-têtes et cases du tableau
const LEVEL_HEAD_STYLES = { pp: 'text-green-700', p: 'text-green-600', m: 'text-orange-600', mm: 'text-red-600' };
const LEVEL_CELL_STYLES = { pp: 'bg-green-100 text-green-800 font-bold', p: 'bg-green-50 text-green-700 font-semibold', m: 'bg-orange-50 text-orange-700 font-semibold', mm: 'bg-red-100 text-red-700 font-bold' };
const GROUP_BACKGROUNDS = ['bg-indigo-50', 'bg-sky-50']; // un fond différent un critère sur deux

// Construit l'en-tête du tableau des statistiques joueurs : 4 colonnes (++ + - --) par critère, en-tête et colonne Joueur figés au défilement
function renderStatsHeader(columns) {
    const head = document.getElementById('statsTableHead');
    if (!head) return;
    const fixed = (label) => `<th class="sticky top-0 z-20 bg-gray-100 p-2 text-center text-xs font-semibold text-gray-600" rowspan="2">${label}</th>`;
    head.innerHTML = `
        <tr style="height: 2.5rem;">
            <th class="sticky top-0 left-0 z-30 bg-gray-100 p-2 text-left font-semibold" rowspan="2">Joueur</th>
            ${fixed('Présences')}${fixed('Matchs Joués')}${fixed('Sets Joués')}
            ${columns.map((c, i) => `<th colspan="4" class="sticky top-0 z-20 ${GROUP_BACKGROUNDS[i % 2]} p-2 text-center font-bold border-l-2 border-gray-800">${escapeHtml(c.label)}</th>`).join('')}
            <th class="sticky top-0 z-20 bg-gray-100 p-2 text-center font-semibold border-l-2 border-gray-800" rowspan="2" title="Moyenne pondérée : ++ = 100 %, + = 75 %, - = 25 %, -- = 0 %">Moyenne</th>
        </tr>
        <tr>
            ${columns.map((c, i) => EVAL_LEVELS.map((l, j) => `<th style="top: 2.5rem;" class="sticky z-20 ${GROUP_BACKGROUNDS[i % 2]} p-1 min-w-[2.25rem] whitespace-nowrap text-center text-sm font-bold ${LEVEL_HEAD_STYLES[l.id]} ${j === 0 ? 'border-l-2 border-gray-800' : ''}">${l.label}</th>`).join('')).join('')}
        </tr>`;
}

// Dernières statistiques affichées (utilisées par l'export Excel)
let statsExportData = null;

// Exporte en Excel le tableau tel qu'il est affiché (filtres par match et par set compris)
function exportStatsToExcel() {
    const team = getCurrentTeam();
    if (!statsExportData || !team) {
        alert("Aucune statistique à exporter.");
        return;
    }
    const { columns, players, teamCounts } = statsExportData;
    const toPercent = (value) => value === null ? '' : value / 100;
    const filterText = (document.getElementById('statsFilterSummary') || {}).textContent || '';
    const title = `${team.name}${team.season ? ' — ' + team.season : ''} — ${filterText}`;
    const width = 4 + columns.length * 4 + 1;

    const headRow1 = ['Joueur', 'Présences', 'Matchs Joués', 'Sets Joués', ...columns.flatMap(c => [c.label, '', '', '']), 'Moyenne'];
    const headRow2 = ['', '', '', '', ...columns.flatMap(() => EVAL_LEVELS.map(l => l.label)), ''];
    const playerRows = players.map(p => [p.name, p.presence, p.played, p.sets,
        ...columns.flatMap(c => EVAL_LEVELS.map(l => p.counts[`${c.id}_${l.id}`] || 0)), toPercent(p.average)]);
    const teamRow = ['Équipe', '', '', '', ...columns.flatMap(c => [toPercent(weightedValue(teamCounts, [c])), '', '', '']),
        toPercent(weightedValue(teamCounts, columns))];

    const worksheet = XLSX.utils.aoa_to_sheet([[title], headRow1, headRow2, ...playerRows, teamRow]);

    // Cellules fusionnées : titre, colonnes fixes sur 2 lignes, un critère sur 4 colonnes, note d'équipe par critère
    const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: width - 1 } }];
    [0, 1, 2, 3, width - 1].forEach(c => merges.push({ s: { r: 1, c }, e: { r: 2, c } }));
    const teamRowIndex = 3 + players.length;
    columns.forEach((c, i) => {
        merges.push({ s: { r: 1, c: 4 + i * 4 }, e: { r: 1, c: 7 + i * 4 } });
        merges.push({ s: { r: teamRowIndex, c: 4 + i * 4 }, e: { r: teamRowIndex, c: 7 + i * 4 } });
    });
    worksheet['!merges'] = merges;
    worksheet['!cols'] = [{ wch: 24 }, { wch: 11 }, { wch: 13 }, { wch: 11 }, ...columns.flatMap(() => EVAL_LEVELS.map(() => ({ wch: 6 }))), { wch: 10 }];

    // Moyennes affichées en pourcentage
    for (let r = 3; r <= teamRowIndex; r++) {
        for (let c = 4; c < width; c++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
            if (cell && cell.t === 'n' && (c === width - 1 || r === teamRowIndex)) cell.z = '0%';
        }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Statistiques');
    const safeName = String(team.name).replace(/[\\/:*?"<>|]/g, '').trim() || 'equipe';
    XLSX.writeFile(workbook, `Statistiques_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Affiche les statistiques des joueurs, potentiellement filtrées par match.
 * Les filtres actifs sont `statsMatchIds` (matchs à inclure) et `statsSetNames` (sets à inclure) ; null = tout.
 */
function renderPlayerStats() { 
    const currentTeam = getCurrentTeam();
    const statsBody = document.getElementById('statsTableBody');
    if (!statsBody) return;
    statsBody.innerHTML = ''; 
    
    const criteriaColumns = getStatColumns(currentTeam);
    renderStatsHeader(criteriaColumns);
    updateStatsFilterSummary();
    const legend = document.getElementById('evalLegend');
    if (legend) legend.innerHTML = EVAL_LEGEND.map(line => `<p>${escapeHtml(line)}</p>`).join('');

    if (!currentTeam || !currentTeam.players || currentTeam.players.length === 0) {
        statsExportData = null;
        statsBody.innerHTML = `<tr><td colspan="${5 + criteriaColumns.length * 4}" class="p-4 text-center text-gray-500">Aucun joueur dans l'effectif.</td></tr>`;
        return;
    }

    const sortedPlayers = [...currentTeam.players].sort((a, b) => a.name.localeCompare(b.name));

    const teamCounts = {};
    const exportPlayers = [];
    sortedPlayers.forEach(player => {
        let presenceCount = 0; let playedCount = 0; let setCount = 0;
        const evalCounts = {};
        const addCounts = (target, source) => { for (const key in source) target[key] = (target[key] || 0) + (source[key] || 0); };

        // --- DÉBUT DE LA LOGIQUE DE FILTRE ---
        let matchesToProcess = currentTeam.matches;

        // Si un filtre est fourni, filtre la liste des matchs
        if (Array.isArray(statsMatchIds) && currentTeam.matches) {
            matchesToProcess = currentTeam.matches.filter(m => statsMatchIds.includes(m.id));
        }
        // --- FIN DE LA LOGIQUE DE FILTRE ---


        if (matchesToProcess) { // S'assure qu'il y a des matchs à traiter
            matchesToProcess.forEach(match => { 
                if (!match) return; 
                const matchSets = statsSetNames || SETS;

                // Note: La présence et le "joué" sont calculés sur les matchs filtrés
                if (match.present?.includes(player.id)) presenceCount++;
                if (match.played?.includes(player.id)) playedCount++;

                 SETS.forEach((setName, index) => {
                    if (!matchSets.includes(setName)) return;
                    const setScore = match.score?.sets?.[index];
                    const wasSetPlayed = setScore && setScore.myTeam !== '' && setScore.opponent !== '';

                    if (!wasSetPlayed) {
                        return; 
                    }

                     let playedInSet = false;
                     const setPositions = (currentTeam.courtPositions && currentTeam.courtPositions[match.id] && currentTeam.courtPositions[match.id][setName]) || {};
                     if (Object.values(setPositions).includes(player.id)) {
                         playedInSet = true;
                     }
                     const setSubs = (match.substitutions && match.substitutions[setName]) || [];
                      if (!playedInSet && setSubs.some(sub => sub.in === player.id)) {
                          playedInSet = true;
                      }
                     
                     if (playedInSet) {
                         setCount++;
                     }
                 });


                // Agrège les notes (sur les matchs filtrés)
                addCounts(evalCounts, collectEvalCounts(match, matchSets).byPlayer[player.id]);
            });
        }

        const row = document.createElement('tr');
        row.className = 'group border-b hover:bg-gray-50 transition';

        const baseCell = (value) => `<td class="p-2 text-center text-sm text-gray-600">${value || ''}</td>`;
        const levelCells = criteriaColumns.map(c => EVAL_LEVELS.map((l, j) => {
            const value = evalCounts[`${c.id}_${l.id}`] || 0;
            const border = j === 0 ? 'border-l-2 border-gray-800' : '';
            return value
                ? `<td class="p-2 min-w-[2.25rem] text-center ${LEVEL_CELL_STYLES[l.id]} ${border}">${value}</td>`
                : `<td class="p-2 min-w-[2.25rem] text-center text-gray-300 ${border}">·</td>`;
        }).join('')).join('');
        row.innerHTML = `
            <td class="sticky left-0 z-10 bg-white group-hover:bg-gray-50 p-2 font-medium whitespace-nowrap border-r">${escapeHtml(player.name)}</td>
            ${baseCell(presenceCount)}${baseCell(playedCount)}${baseCell(setCount)}
            ${levelCells}
            <td class="p-2 text-center border-l-2 border-gray-800">${averageBadge(weightedValue(evalCounts, criteriaColumns))}</td>
        `;
        statsBody.appendChild(row);
        exportPlayers.push({ name: player.name, presence: presenceCount, played: playedCount, sets: setCount, counts: evalCounts, average: weightedValue(evalCounts, criteriaColumns) });
        for (const key in evalCounts) teamCounts[key] = (teamCounts[key] || 0) + evalCounts[key];
    });

    // Ligne Équipe : note de chaque critère et moyenne générale
    const teamRow = document.createElement('tr');
    teamRow.className = 'border-t-2 border-gray-800 bg-gray-100';
    teamRow.innerHTML = `
        <td class="sticky left-0 z-10 bg-gray-100 p-2 font-bold border-r">Équipe</td>
        <td class="p-2" colspan="3"></td>
        ${criteriaColumns.map(c => `<td colspan="4" class="p-2 text-center border-l-2 border-gray-800">${averageBadge(weightedValue(teamCounts, [c]))}</td>`).join('')}
        <td class="p-2 text-center border-l-2 border-gray-800">${averageBadge(weightedValue(teamCounts, criteriaColumns))}</td>
    `;
    statsBody.appendChild(teamRow);
    statsExportData = { columns: criteriaColumns, players: exportPlayers, teamCounts };
}


/**
 * Calcule et affiche les statistiques globales de l'équipe pour la saison.
 * Cible l'élément <tr id="teamStatsRow">.
 * Approche alternative : Filtre les matchs joués d'abord (Filtre Corrigé).
 */
function renderTeamStats() {
    const currentTeam = getCurrentTeam();
    const statsRow = document.getElementById('teamStatsRow');
    if (!statsRow) {
        console.error("Élément 'teamStatsRow' introuvable.");
        return;
    }
    statsRow.innerHTML = '';

    if (!currentTeam || !currentTeam.matches || currentTeam.matches.length === 0) {
        statsRow.innerHTML = `<td colspan="15" class="p-4 text-center text-gray-500">Aucun match enregistré.</td>`;
        return;
    }

    // --- DÉBUT DE LA CORRECTION DU FILTRE ---

    // 1. Filtrer les matchs pour ne garder que ceux joués
    const playedMatches = currentTeam.matches.filter(match => {
        // Utilise optional chaining (?.) au cas où 'score' n'existe pas
        // Convertit en nombre (avec || 0 si NaN ou vide)
        const mySets = parseInt(match.score?.myTeam) || 0; 
        const oppSets = parseInt(match.score?.opponent) || 0;
        // Le match a un score réel si au moins une équipe a gagné un set
        const hasActualScore = mySets > 0 || oppSets > 0; 
        const isForfeit = match.forfeitStatus !== 'none';
        
        // Garde le match SEULEMENT si hasActualScore est vrai OU si c'est un forfait
        return hasActualScore || isForfeit; 
    });

    // 2. Le nombre de matchs joués est la taille de la liste filtrée
    const actuallyPlayedCount = playedMatches.length;
    console.log("renderTeamStats (Nouvelle Approche - Filtre Corrigé): Nombre de matchs joués trouvés:", actuallyPlayedCount);

    // --- FIN DE LA CORRECTION DU FILTRE ---


    // Initialise l'objet stats (inchangé)
    let stats = {
        points: 0, joues: 0, gagnes: 0, perdus: 0,
        g30: 0, g31: 0, g32: 0, p23: 0, p13: 0, p03: 0,
        setsPour: 0, setsContre: 0, ptsPour: 0, ptsContre: 0
    };

    // 3. Boucler UNIQUEMENT sur les matchs joués (inchangé depuis la version précédente)
    playedMatches.forEach(match => {
        // Traitement spécifique pour les forfaits
        if (match.forfeitStatus === 'win') {
            stats.points += 3; stats.gagnes++; stats.g30++;
            stats.setsPour += 3; stats.ptsPour += 75;
            return; 
        }
        if (match.forfeitStatus === 'loss') {
            stats.perdus++; stats.p03++;
            stats.setsContre += 3; stats.ptsContre += 75;
            return; 
        }

        // Traitement pour les matchs avec score (non-forfait)
        const mySets = parseInt(match.score.myTeam) || 0; // Ici on sait que le score existe
        const oppSets = parseInt(match.score.opponent) || 0;

        stats.setsPour += mySets;
        stats.setsContre += oppSets;

        if (match.score.sets) {
            match.score.sets.forEach(set => {
                 if (set && typeof set === 'object') {
                    stats.ptsPour += parseInt(set.myTeam) || 0;
                    stats.ptsContre += parseInt(set.opponent) || 0;
                }
            });
        }

        if (mySets > oppSets) {
            stats.gagnes++;
            if (mySets === 3 && oppSets === 0) { stats.points += 3; stats.g30++; }
            else if (mySets === 3 && oppSets === 1) { stats.points += 3; stats.g31++; }
            else if (mySets === 3 && oppSets === 2) { stats.points += 2; stats.g32++; }
        } else if (oppSets > mySets) {
            stats.perdus++;
            if (mySets === 2 && oppSets === 3) { stats.points += 1; stats.p23++; }
            else if (mySets === 1 && oppSets === 3) { stats.p13++; }
            else if (mySets === 0 && oppSets === 3) { stats.p03++; }
        }
    }); // Fin de la boucle sur playedMatches

    // Affiche les statistiques calculées dans le tableau HTML (inchangé)
    if (actuallyPlayedCount === 0) {
         statsRow.innerHTML = `<td colspan="15" class="p-4 text-center text-gray-500">Aucun match joué pour le moment.</td>`;
    } else {
        console.log("renderTeamStats (Nouvelle Approche - Filtre Corrigé): Valeur finale avant affichage:", actuallyPlayedCount);
        statsRow.innerHTML = `
            <td class="p-2 font-bold">${stats.points}</td>
            <td class="p-2">${actuallyPlayedCount || ''}</td>
            <td class="p-2">${stats.gagnes || ''}</td>
            <td class="p-2">${stats.perdus || ''}</td>
            <td class="p-2">${stats.g30 || ''}</td>
            <td class="p-2">${stats.g31 || ''}</td>
            <td class="p-2">${stats.g32 || ''}</td>
            <td class="p-2">${stats.p23 || ''}</td>
            <td class="p-2">${stats.p13 || ''}</td>
            <td class="p-2">${stats.p03 || ''}</td>
            <td class="p-2">${stats.setsPour || ''}</td>
            <td class="p-2">${stats.setsContre || ''}</td>
            <td class="p-2">${stats.ptsPour || ''}</td>
            <td class="p-2">${stats.ptsContre || ''}</td>
        `;
    }
}

// Filtres des statistiques : null = tout afficher
let statsMatchIds = null; // ID des matchs à inclure
let statsSetNames = null; // noms des sets à inclure ('set1'...'set5'), pour tous les matchs

// Phrase qui rappelle les filtres actifs
function updateStatsFilterSummary() {
    const summary = document.getElementById('statsFilterSummary');
    if (!summary) return;
    const matchText = statsMatchIds ? `${statsMatchIds.length} match(s)` : 'tous les matchs';
    const setText = statsSetNames ? statsSetNames.map(name => name.replace('set', '')).join(', ') : 'tous';
    summary.textContent = `Filtre : ${matchText} — sets : ${setText}`;
}

/**
 * Remplit la liste des matchs (cases à cocher) DANS LA MODALE de filtre.
 */
function renderStatsFilter() {
    const currentTeam = getCurrentTeam();
    const listDiv = document.getElementById('stats-modal-match-list');
    if (!listDiv) return;
    listDiv.innerHTML = ''; // Vide la liste

    if (!currentTeam || !currentTeam.matches || currentTeam.matches.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-500">Aucun match à filtrer.</p>';
        return;
    }

    // Trie par date croissante (du premier au dernier)
    const sortedMatches = [...currentTeam.matches].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedMatches.forEach(match => {
        const matchLabel = formatMatchTitle(match); // Réutilise la fonction de formatage
        const matchId = match.id;
        const isChecked = !statsMatchIds || statsMatchIds.includes(matchId);

        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center';

        itemDiv.innerHTML = `
            <input id="match-filter-${matchId}" type="checkbox" value="${matchId}" ${isChecked ? 'checked' : ''} class="stats-match-filter h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
            <label for="match-filter-${matchId}" class="ml-2 block text-sm text-gray-900 truncate" title="${escapeHtml(matchLabel)}">
                ${escapeHtml(matchLabel)}
            </label>
        `;
        listDiv.appendChild(itemDiv);
    });
}

/**
 * Coche ou décoche toutes les cases du filtre de statistiques.
 * @param {boolean} isChecked - True pour cocher, false pour décocher.
 */
function selectAllStatsMatches(isChecked) {
    document.querySelectorAll('.stats-match-filter').forEach(checkbox => {
        checkbox.checked = isChecked;
    });
}

/**
 * Récupère les matchs sélectionnés DANS LA MODALE et relance le rendu des statistiques.
 */
function applyStatsFilter() {
    const boxes = [...document.querySelectorAll('#statsFilterModal .stats-match-filter')];
    const selectedMatchIds = boxes.filter(checkbox => checkbox.checked).map(checkbox => parseInt(checkbox.value));

    if (selectedMatchIds.length === 0) {
        alert("Veuillez sélectionner au moins un match pour afficher les statistiques.");
        return;
    }

    statsMatchIds = selectedMatchIds.length === boxes.length ? null : selectedMatchIds;
    renderPlayerStats();

    closeModal('statsFilterModal'); // Ferme la modale après application
}

/**
 * Remplit la liste du filtre et ouvre la modale de filtre des statistiques.
 */
function openStatsFilterModal() {
    renderStatsFilter(); // Remplit la liste
    document.getElementById('statsFilterModal').classList.remove('hidden'); // Ouvre la modale
}

// --- Filtre des sets (s'applique à tous les matchs sélectionnés) ---
function openStatsSetFilterModal() {
    document.querySelectorAll('.stats-set-filter').forEach(checkbox => {
        checkbox.checked = !statsSetNames || statsSetNames.includes(checkbox.value);
    });
    document.getElementById('statsSetFilterModal').classList.remove('hidden');
}

function selectAllStatsSets(isChecked) {
    document.querySelectorAll('.stats-set-filter').forEach(checkbox => {
        checkbox.checked = isChecked;
    });
}

function applyStatsSetFilter() {
    const boxes = [...document.querySelectorAll('#statsSetFilterModal .stats-set-filter')];
    const selected = boxes.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);

    if (selected.length === 0) {
        alert("Veuillez sélectionner au moins un set pour afficher les statistiques.");
        return;
    }

    statsSetNames = selected.length === boxes.length ? null : selected;
    renderPlayerStats();
    closeModal('statsSetFilterModal');
}

// ============================
// SUIVI MATCH (LIVE) — un bouton par critère et par joueur ; on touche le critère puis la note ++ / + / - / --
// ============================
const EVAL_LEVELS = [
    { id: 'pp', label: '++', weight: 100, style: 'bg-green-600 hover:bg-green-700' },
    { id: 'p', label: '+', weight: 75, style: 'bg-green-400 hover:bg-green-500' },
    { id: 'm', label: '-', weight: 25, style: 'bg-orange-400 hover:bg-orange-500' },
    { id: 'mm', label: '--', weight: 0, style: 'bg-red-500 hover:bg-red-600' }
];
// Barème explicatif (repris de la feuille du coach ; les parties coupées sur la capture sont marquées « … »)
const EVAL_LEGEND = [
    '++ = Parfait / Attaque fait Point / Récep : 4 choix de passes / Service : Ace',
    '+ = Ok / Attaque mise en difficulté / Récep : 2 choix de passes / Service : pas de fixe possible en face',
    '- = Mauvais / Attaque défendu, adversaire à 2 choix ou plus / Récep : 1 choix de passe / Service : …',
    '-- = Raté / Attaque faute ou bloc sans soutien possible / Récep : Ace ou 0 choix de passe / Service : Faute',
    'Bloc : ++ = kill bloc / + = bloc de leur côté ou balle bien ralentie / - = erreur de bloc / -- = faute de bloc',
    '* Les deux participants sur les blocs, s\'ils sont en place, sont comptabilisés'
];
// Critères proposés par défaut à chaque équipe (identifiants d'origine conservés pour ne perdre aucun historique)
const DEFAULT_CRITERIA = [
    { id: 'service', label: 'Service', color: '#2563eb' },
    { id: 'attack', label: 'Attaque', color: '#ea580c' },
    { id: 'reception', label: 'Récep', color: '#0d9488' },
    { id: 'block', label: 'Bloc', color: '#9333ea' },
    { id: 'net', label: 'Autres', color: '#475569' }
];
// Couleurs proposées aux nouveaux critères (la première non utilisée est choisie) ; l'utilisateur peut ensuite en choisir une autre
const CRITERIA_PALETTE = ['#2563eb', '#ea580c', '#0d9488', '#9333ea', '#475569', '#16a34a', '#db2777', '#ca8a04', '#0891b2', '#dc2626', '#4f46e5', '#92400e'];
// Un libéro ne sert pas, n'attaque pas et ne bloque pas : ces critères ne lui sont pas proposés
const LIBERO_HIDDEN_CRITERIA = ['service', 'attack', 'block'];

// Première couleur de la palette qui n'est pas encore utilisée (sinon on recommence la palette)
function nextFreeColor(usedColors) {
    return CRITERIA_PALETTE.find(color => !usedColors.includes(color)) || CRITERIA_PALETTE[usedColors.length % CRITERIA_PALETTE.length];
}

// Texte noir ou blanc selon la luminosité de la couleur du bouton
function readableTextColor(hex) {
    const value = parseInt(hex.slice(1), 16);
    const luminance = (0.299 * (value >> 16) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
    return luminance > 0.62 ? '#111827' : '#ffffff';
}

// Donne une couleur aux critères qui n'en ont pas encore (listes enregistrées avant l'ajout des couleurs)
function ensureCriteriaColors(list) {
    const used = list.map(c => c.color).filter(Boolean);
    return list.map(c => {
        if (c.color) return c;
        const preset = DEFAULT_CRITERIA.find(d => d.id === c.id);
        const color = preset && !used.includes(preset.color) ? preset.color : nextFreeColor(used);
        used.push(color);
        return { ...c, color };
    });
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Liste des critères de l'équipe. Les critères supprimés mais déjà utilisés sont "archivés" (masqués, gardés dans les stats).
// Ancien format { faults: [...], points: [...] } : les deux listes sont fusionnées.
function getCriteria(team, includeArchived = false) {
    let list = team && team.trackingCriteria;
    if (!Array.isArray(list)) {
        if (list && (list.faults || list.points)) {
            const merged = new Map();
            [...(list.faults || []), ...(list.points || [])].forEach(c => {
                const existing = merged.get(c.id);
                if (!existing || (existing.archived && !c.archived)) merged.set(c.id, { ...c });
            });
            list = [...merged.values()];
        } else {
            list = DEFAULT_CRITERIA;
        }
    }
    list = ensureCriteriaColors(list);
    return includeArchived ? list : list.filter(c => !c.archived);
}

function criterionHasData(team, criterionId) {
    return (team.matches || []).some(match => {
        const inLegacy = ['faults', 'points'].some(mode => Object.values(match[mode] || {}).some(setData =>
            Object.values(setData || {}).some(playerData => playerData && playerData[criterionId] > 0)));
        const inEvals = Object.values(match.evals || {}).some(setData =>
            Object.values(setData || {}).some(playerData => playerData && EVAL_LEVELS.some(l => playerData[`${criterionId}_${l.id}`] > 0)));
        return inLegacy || inEvals;
    });
}

// Colonnes des statistiques : les critères actuels de l'équipe (un critère supprimé n'y figure plus)
function getStatColumns(team) {
    return getCriteria(team).map(c => ({ id: c.id, label: c.label }));
}

// Additionne les notes d'un match pour les sets demandés : { byPlayer: {id: {critère_niveau: n}}, total: {critère_niveau: n} }
// Les anciennes fautes comptent comme "--" et les anciens points comme "++" du même critère.
function collectEvalCounts(match, setNames) {
    const byPlayer = {};
    const total = {};
    const add = (playerId, key, n) => {
        if (!n) return;
        byPlayer[playerId] = byPlayer[playerId] || {};
        byPlayer[playerId][key] = (byPlayer[playerId][key] || 0) + n;
        total[key] = (total[key] || 0) + n;
    };
    setNames.forEach(setName => {
        const evals = (match.evals && match.evals[setName]) || {};
        Object.keys(evals).forEach(playerId => { for (const key in evals[playerId]) add(playerId, key, evals[playerId][key]); });
        const faults = (match.faults && match.faults[setName]) || {};
        Object.keys(faults).forEach(playerId => { for (const id in faults[playerId]) add(playerId, `${id}_mm`, faults[playerId][id]); });
        const points = (match.points && match.points[setName]) || {};
        Object.keys(points).forEach(playerId => { for (const id in points[playerId]) add(playerId, `${id}_pp`, points[playerId][id]); });
    });
    return { byPlayer, total };
}

function createPlayerCardLive(match, player, isLibero) {
    const counts = collectEvalCounts(match, [currentSet]).byPlayer[player.id] || {};
    let criteria = getCriteria(getCurrentTeam());
    if (isLibero) {
        const forLibero = criteria.filter(c => !LIBERO_HIDDEN_CRITERIA.includes(c.id));
        if (forLibero.length > 0) criteria = forLibero;
    }
    // Critères limités à certains postes : on se base sur le poste principal du joueur (sans poste renseigné : tous les critères)
    if (player.mainPosition) criteria = criteria.filter(c => !(c.positions && c.positions.length) || c.positions.includes(player.mainPosition));
    const card = document.createElement('div');
    const genderClass = player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100';
    card.className = `live-player-card ${genderClass} flex flex-col`;
    const buttons = criteria.map(c => {
        const total = EVAL_LEVELS.reduce((acc, l) => acc + (counts[`${c.id}_${l.id}`] || 0), 0);
        const detail = EVAL_LEVELS.filter(l => counts[`${c.id}_${l.id}`]).map(l => `${l.label}${counts[`${c.id}_${l.id}`]}`).join(' ');
        return `
            <button id="crit-btn-${player.id}-${c.id}" onclick="openRatingModal(${player.id}, '${c.id}')" class="flex flex-col items-center justify-center p-1 min-h-[72px] rounded-md text-sm font-medium w-full select-none hover:brightness-90 transition" style="background-color: ${c.color}; color: ${readableTextColor(c.color)};">
                <span>${escapeHtml(c.label)}</span>
                <span class="font-bold text-lg leading-tight">${total}</span>
                <span class="text-xs opacity-90 leading-tight">${detail}</span>
            </button>`;
    }).join('');
    card.innerHTML = `
        <div class="font-bold cursor-pointer hover:text-blue-600 player-name-display" onclick="openSubstitutionModal(${player.id})">
            #${escapeHtml(player.jerseyNumber) || '-'} ${escapeHtml(player.name)}
        </div>
        <div class="grid grid-cols-2 gap-2 mt-3 flex-grow">${buttons}</div>
    `;
    return card;
}

// --- Fenêtre de notation : s'ouvre au clic sur un critère, se ferme dès que la note est choisie ---
let pendingRating = null; // { playerId, criterionId }

function openRatingModal(playerId, criterionId) {
    const team = getCurrentTeam();
    const matchId = parseInt(document.getElementById('matchSelector').value);
    const match = team && team.matches.find(m => m.id === matchId);
    const player = team && team.players.find(p => p.id === playerId);
    const criterion = getCriteria(team, true).find(c => c.id === criterionId);
    if (!match || !player || !criterion) return;
    pendingRating = { playerId, criterionId };
    const counts = collectEvalCounts(match, [currentSet]).byPlayer[playerId] || {};
    document.getElementById('ratingModalTitle').textContent = criterion.label;
    document.getElementById('ratingModalSubtitle').textContent = `#${player.jerseyNumber || '-'} ${player.name} — Set ${currentSet.replace('set', '')}`;
    document.getElementById('ratingButtons').innerHTML = EVAL_LEVELS.map(l => `
        <button onclick="rateCriterion('${l.id}')" class="${l.style} text-white rounded-xl py-6 text-3xl font-bold select-none">
            ${l.label}<span class="block text-xs font-medium opacity-90">${counts[`${criterionId}_${l.id}`] || 0}</span>
        </button>`).join('');
    document.getElementById('ratingModal').classList.remove('hidden');
}

async function rateCriterion(levelId) {
    if (!pendingRating) return;
    const { playerId, criterionId } = pendingRating;
    pendingRating = null;
    closeModal('ratingModal');
    await updateEval(parseInt(document.getElementById('matchSelector').value), playerId, `${criterionId}_${levelId}`, 1);
}

async function updateEval(matchId, playerId, key, change) {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return;
    const match = currentTeam.matches.find(m => m.id === matchId); if (!match) return;

    if (!match.evals) match.evals = {};
    if (!match.evals[currentSet]) match.evals[currentSet] = {};
    if (!match.evals[currentSet][playerId]) match.evals[currentSet][playerId] = {};

    const playerEvals = match.evals[currentSet][playerId];
    let count = playerEvals[key] || 0;
    if (change < 0 && count === 0) return;
    if (change < 0 && navigator.vibrate) navigator.vibrate(100);
    if (change > 0) {
        appData.lastEvalAction = JSON.parse(JSON.stringify({ matchId, playerId, evalKey: key, set: currentSet }));
    }

    playerEvals[key] = count + change;
    await saveData();
    renderLiveTrackingView();
}

// Annule la dernière note saisie
async function undoLastAction() {
    const action = appData.lastEvalAction ? JSON.parse(JSON.stringify(appData.lastEvalAction)) : null;
    if (!action) {
        alert("Il n'y a pas de dernière action à annuler.");
        return;
    }
    if (action.set !== currentSet) {
        alert(`La dernière action a été enregistrée sur le set ${action.set.replace('set','')}. Veuillez sélectionner ce set pour l'annuler.`);
        return;
    }
    appData.lastEvalAction = null;
    await saveData();
    await updateEval(action.matchId, action.playerId, action.evalKey, -1);
}

// Résumé sous la saisie : total équipe par critère pour le set en cours
function renderSummary() {
    const summaryDiv = document.getElementById('set-faults-summary');
    const currentTeam = getCurrentTeam();
    const matchSelector = document.getElementById('matchSelector');
    if (!summaryDiv || !currentTeam || !matchSelector || !matchSelector.value) {
        if (summaryDiv) summaryDiv.innerHTML = '';
        return;
    }
    const match = currentTeam.matches.find(m => m.id === parseInt(matchSelector.value));
    if (!match) { summaryDiv.innerHTML = ''; return; }
    const { total } = collectEvalCounts(match, [currentSet]);
    const rows = getStatColumns(currentTeam).map(c => `
        <tr class="border-b">
            <td class="p-2 font-medium">${escapeHtml(c.label)}</td>
            ${EVAL_LEVELS.map(l => `<td class="p-2 text-center">${total[`${c.id}_${l.id}`] || 0}</td>`).join('')}
        </tr>`).join('');
    summaryDiv.innerHTML = `<h4 class="text-lg font-semibold mb-2 text-center">Total équipe — Set ${currentSet.replace('set', '')}</h4>
        <table class="w-full text-sm max-w-md mx-auto">
            <thead class="bg-gray-100"><tr><th class="p-2 text-left">Critère</th>${EVAL_LEVELS.map(l => `<th class="p-2 text-center">${l.label}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

/**
 * Affiche l'interface de suivi en direct pour le match et le set sélectionnés.
 */
function renderLiveTrackingView() {
    const currentTeam = getCurrentTeam();
    const liveContent = document.getElementById('live-content');
    const liveHint = document.getElementById('live-match-hint');
    const courtLayout = document.getElementById('live-court-layout');
    const liveMatchDisplay = document.getElementById('live-match-display');
    const liveMatchName = document.getElementById('live-match-name');
    const undoButton = document.getElementById('undo-last-fault');
    const matchSelector = document.getElementById('matchSelector');

    // --- VÉRIFICATION (inchangée) ---
    if (!matchSelector || !matchSelector.value || !currentTeam || !liveContent || !liveHint || !courtLayout || !liveMatchDisplay || !liveMatchName) {
        if(liveContent) liveContent.classList.add('hidden');
        if(liveMatchDisplay) liveMatchDisplay.classList.add('hidden');
        if(liveHint) liveHint.classList.remove('hidden');
        const summaryDiv = document.getElementById('set-faults-summary');
        if (summaryDiv) summaryDiv.innerHTML = '';
        return;
    }
    // --- FIN DE LA VÉRIFICATION ---

    const matchId = parseInt(matchSelector.value);
    liveHint.classList.add('hidden');
    liveMatchDisplay.classList.remove('hidden');
    liveContent.classList.remove('hidden');

    if (undoButton) undoButton.onclick = undoLastAction;

    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) {
         liveContent.classList.add('hidden'); liveHint.textContent = "Erreur: Match introuvable."; liveHint.classList.remove('hidden'); return;
     }

    liveMatchName.textContent = formatMatchTitle(match);

    renderSetSelector();

    courtLayout.innerHTML = '';
    const setPositions = (currentTeam.courtPositions && currentTeam.courtPositions[matchId] && currentTeam.courtPositions[matchId][currentSet]) || {};

    const onCourtPlayerIds = Object.keys(setPositions)
        .filter(pos => pos.startsWith('pos-'))
        .map(pos => setPositions[pos]).filter(Boolean);

    // ID du libéro DÉSIGNÉ pour ce set
    const liberoId = setPositions.libero;

    const participatingPlayerIds = new Set([...onCourtPlayerIds, liberoId].filter(Boolean));

    if (participatingPlayerIds.size === 0) {
        courtLayout.innerHTML = `<p class="text-gray-500 col-span-2 text-center">Définissez la composition dans l'onglet "Matchs" pour commencer le suivi.</p>`;
        renderSummary();
        return;
    }

    const addCard = (playerId) => {
        const player = currentTeam.players.find(p => p.id === playerId);
        if (!player) return;
        const card = createPlayerCardLive(match, player, playerId === liberoId);
        if (playerId === liberoId) card.classList.add('border-t-4', 'border-yellow-500', 'mt-2');
        courtLayout.appendChild(card);
    };
    onCourtPlayerIds.forEach(addCard);
    if (liberoId) addCard(liberoId);

    renderSummary();
}

// --- Fenêtre « Personnaliser les critères » (une seule liste) ---
let criteriaDraft = null; // copie de travail [{id, label}], enregistrée seulement avec le bouton "Enregistrer"

function openCriteriaModal() {
    const team = getCurrentTeam();
    if (!team) return;
    criteriaDraft = getCriteria(team).map(c => ({ ...c }));
    renderCriteriaModal();
    document.getElementById('criteriaModal').classList.remove('hidden');
}

function renderCriteriaModal() {
    const container = document.getElementById('criteria-list');
    container.innerHTML = '';
    criteriaDraft.forEach((c, index) => {
        const block = document.createElement('div');
        block.className = 'pb-2 border-b border-gray-100';
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        row.innerHTML = `
            <input type="text" maxlength="20" value="${escapeHtml(c.label)}" class="flex-grow min-w-0 p-2 border border-gray-300 rounded-lg" oninput="criteriaDraft[${index}].label = this.value">
            <input type="color" value="${c.color}" title="Couleur du bouton" class="w-10 h-9 p-0 border border-gray-300 rounded cursor-pointer flex-shrink-0" oninput="criteriaDraft[${index}].color = this.value">
            <button onclick="moveCriterion(${index}, -1)" ${index === 0 ? 'disabled' : ''} class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-40" title="Monter">▲</button>
            <button onclick="moveCriterion(${index}, 1)" ${index === criteriaDraft.length - 1 ? 'disabled' : ''} class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-40" title="Descendre">▼</button>
            <button onclick="removeCriterionDraft(${index})" class="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" title="Supprimer">X</button>`;
        const positionsRow = document.createElement('div');
        positionsRow.className = 'flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-600';
        positionsRow.innerHTML = '<span class="font-semibold">Suivi pour :</span>' + POSITIONS.map((pos, pi) =>
            `<label class="flex items-center gap-1"><input type="checkbox" ${(c.positions || []).includes(pos) ? 'checked' : ''} onchange="toggleCriterionPosition(${index}, ${pi}, this.checked)">${escapeHtml(pos)}</label>`).join('');
        block.appendChild(row);
        block.appendChild(positionsRow);
        container.appendChild(block);
    });
}

// Coche / décoche un poste pour le critère (aucun poste coché = critère suivi pour tous les postes)
function toggleCriterionPosition(index, positionIndex, checked) {
    const pos = POSITIONS[positionIndex];
    const set = new Set(criteriaDraft[index].positions || []);
    if (checked) set.add(pos); else set.delete(pos);
    criteriaDraft[index].positions = POSITIONS.filter(p => set.has(p));
}

function addCriterionDraft() {
    criteriaDraft.push({ id: `c_${Date.now()}`, label: '', color: nextFreeColor(criteriaDraft.map(c => c.color)) });
    renderCriteriaModal();
    const inputs = document.querySelectorAll('#criteria-list input');
    if (inputs.length) inputs[inputs.length - 1].focus();
}

function moveCriterion(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= criteriaDraft.length) return;
    [criteriaDraft[index], criteriaDraft[target]] = [criteriaDraft[target], criteriaDraft[index]];
    renderCriteriaModal();
}

function removeCriterionDraft(index) {
    if (criteriaDraft.length <= 1) return alert('Il faut garder au moins un critère.');
    criteriaDraft.splice(index, 1);
    renderCriteriaModal();
}

async function saveCriteria() {
    const team = getCurrentTeam();
    if (!team || !criteriaDraft) return;
    const cleaned = criteriaDraft.map(c => ({ id: c.id, label: c.label.trim(), color: c.color, positions: c.positions || [] }));
    if (cleaned.some(c => !c.label)) return alert('Chaque critère doit avoir un nom.');
    const names = cleaned.map(c => c.label.toLowerCase());
    if (new Set(names).size !== names.length) return alert('Deux critères ont le même nom.');

    // Critères retirés : archivés s'ils ont de l'historique, supprimés sinon
    const keptIds = cleaned.map(c => c.id);
    const removed = getCriteria(team, true).filter(c => !keptIds.includes(c.id));
    const toKeepArchived = removed.filter(c => criterionHasData(team, c.id)).map(c => ({ ...c, archived: true }));
    team.trackingCriteria = [...cleaned, ...toKeepArchived];
    await saveData();
    closeModal('criteriaModal');
    renderLiveTrackingView();
    renderPlayerStats();
}

// ============================
// RÉSULTATS & STATS (Read-only rendering)
// ============================
function renderResults() {
    console.log("renderResults: Début de l'exécution."); // Log 1: Vérifie si la fonction est appelée

    const currentTeam = getCurrentTeam();
    const resultsTableBody = document.getElementById('results-list-table');
    // const summaryDiv = document.getElementById('results-summary'); // Cet ID n'existe plus

    // Vérifie si l'élément tbody existe
    if (!resultsTableBody) {
        console.error("renderResults: ERREUR CRITIQUE - Élément 'results-list-table' (tbody) introuvable !");
        return; 
    }

    // Vide le contenu précédent
    resultsTableBody.innerHTML = ''; 
    console.log("renderResults: Tableau (tbody) vidé."); // Log 2: Confirme le vidage

    // Vérifie si l'équipe et les matchs existent
    if (!currentTeam || !currentTeam.matches || currentTeam.matches.length === 0) {
        console.warn("renderResults: Aucune équipe ou aucun match trouvé. Affichage du message 'Aucun match'."); // Log 3: Cas où il n'y a pas de matchs
        resultsTableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Aucun match enregistré pour cette équipe.</td></tr>';
        return;
    }

    console.log(`renderResults: ${currentTeam.matches.length} match(s) trouvé(s) pour l'équipe.`); // Log 4: Confirme le nombre de matchs

    // Trie les matchs par date (ordre chronologique)
    const sortedMatches = [...currentTeam.matches].sort((a, b) => new Date(a.date.replace(/-/g, '/')) - new Date(b.date.replace(/-/g, '/')));

    let rowsAdded = 0; // Compteur pour vérifier si des lignes sont ajoutées

    // Boucle sur chaque match trié
    sortedMatches.forEach((match, index) => {
        console.log(`renderResults: Traitement du match ${index + 1}/${sortedMatches.length} (ID: ${match.id}, Adversaire: ${match.opponent})`); // Log 5: Suit chaque match

        // S'assure que la structure score/sets existe
        const score = match.score || { myTeam: '', opponent: '', sets: [] };
        const sets = score.sets || [];
        // Récupère les scores finaux (sets gagnés), utilise 0 si vide ou invalide
        const mySets = parseInt(score.myTeam) || 0; 
        const oppSets = parseInt(score.opponent) || 0; 

        // Détermine si le match est considéré comme "joué" (a un score final ou un statut de forfait)
        const isPlayed = match.forfeitStatus !== 'none' || (mySets > 0 || oppSets > 0);
        console.log(`renderResults: Match ID ${match.id} - est joué ? ${isPlayed} (Forfait: ${match.forfeitStatus}, Score: ${score.myTeam}-${score.opponent})`); // Log 6: Vérifie la condition 'isPlayed'

        // Variables pour l'affichage du résultat
        let resultText = ''; 
        let resultColor = 'text-gray-500'; // Gris par défaut
        
        if (isPlayed) {
            // Traitement pour les matchs joués
            if (match.forfeitStatus === 'win') {
                resultText = '(F)'; resultColor = 'text-green-600';
            } else if (match.forfeitStatus === 'loss') {
                resultText = '(F)'; resultColor = 'text-red-600';
            } else { // Score normal
                resultColor = mySets > oppSets ? 'text-green-600' : (oppSets > mySets ? 'text-red-600' : 'text-gray-500');
                // resultText reste vide pour les scores normaux
            }
        } else {
             // Affichage pour les matchs non joués
             resultText = 'N/J'; // Non Joué
             resultColor = 'text-gray-400';
        }

        // Construit le HTML pour les scores des sets
        let setScoresHtml = '';
        // Affiche les scores des sets uniquement si le match est considéré comme joué
        if (isPlayed && sets.length > 0) { 
             sets.forEach((set, setIndex) => {
                 // S'assure que le set existe et a des scores valides
                 if (set && (set.myTeam !== '' || set.opponent !== '')) { 
                     setScoresHtml += `<span class="whitespace-nowrap text-xs px-2 py-1 bg-gray-200 rounded">${set.myTeam}-${set.opponent}</span>`;
                 } else {
                     console.log(`renderResults: Match ID ${match.id}, Set ${setIndex + 1} ignoré (scores vides).`); // Log 7: Si un set est vide
                 }
             });
        }
        // Si aucun score de set n'a été ajouté mais que le match est joué (ex: forfait saisi avant les sets)
        if (isPlayed && setScoresHtml === '' && match.forfeitStatus !== 'none') {
             setScoresHtml = '<span class="text-xs text-gray-400">Forfait</span>';
        } else if (isPlayed && setScoresHtml === '') {
             setScoresHtml = '<span class="text-xs text-gray-400">N/A</span>';
        }

        // Crée l'élément de ligne du tableau
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50'; 
        // Remplit la ligne avec les cellules (td)
        row.innerHTML = `
            <td class="p-3 text-sm text-gray-600 whitespace-nowrap">${new Date(match.date.replace(/-/g, '/')).toLocaleDateString('fr-FR')}</td>
            <td class="p-3 text-sm">${match.opponent}</td>
            <td class="p-3 text-center text-sm">${match.location === 'domicile' ? 'Dom.' : 'Ext.'}</td>
            <td class="p-3 text-center font-bold ${resultColor}">${mySets}-${oppSets} ${resultText}</td>
            <td class="p-3">
                <div class="flex flex-row gap-1 overflow-x-auto whitespace-nowrap">
                    ${setScoresHtml || ''} 
                </div>
            </td>
        `;
        // Ajoute la ligne au corps du tableau
        resultsTableBody.appendChild(row);
        rowsAdded++; // Incrémente le compteur de lignes ajoutées
    });

    console.log(`renderResults: Terminé. ${rowsAdded} ligne(s) ajoutée(s) au tableau.`); // Log 8: Nombre final de lignes
    
    // La partie summaryDiv a été supprimée car déplacée vers renderTeamStats
}


/** Ouvre la modale de sélection de l'équipe */
function openTeamSelectModal() {
    const selector = document.getElementById('teamSelector');
    const modalTitle = document.getElementById('genericModalTitle');
    const modalList = document.getElementById('genericModalList');
    const modalClearBtn = document.getElementById('genericModalClearButton');

    modalTitle.textContent = 'Changer d\'équipe';
    modalList.innerHTML = '';
    modalClearBtn.classList.add('hidden'); // Pas de bouton "Vider"

    Array.from(selector.options).forEach(option => {
        if (!option.value) return; // Ignore le placeholder

        const button = document.createElement('button');
        button.className = 'w-full text-left p-3 bg-gray-100 rounded-lg hover:bg-blue-100 transition';
        button.textContent = option.textContent;
        button.onclick = () => selectTeamFromModal(option.value);
        modalList.appendChild(button);
    });
    
    document.getElementById('genericSelectModal').classList.remove('hidden');
}

/** Ouvre la modale de sélection du match */
function openMatchSelectModal() {
    const selector = document.getElementById('matchSelector');
    const modalTitle = document.getElementById('genericModalTitle');
    const modalList = document.getElementById('genericModalList');
    const modalClearBtn = document.getElementById('genericModalClearButton');

    modalTitle.textContent = 'Sélectionner un match';
    modalList.innerHTML = '';
    modalClearBtn.classList.add('hidden'); // Pas de bouton "Vider"

    Array.from(selector.options).forEach(option => {
        if (!option.value) { // Gère le placeholder
            const placeholder = document.createElement('p');
            placeholder.className = 'text-gray-500 text-center p-3';
            placeholder.textContent = 'Aucun match à sélectionner.';
            // S'il n'y a qu'une option (le placeholder), on l'affiche
            if (selector.options.length === 1) modalList.appendChild(placeholder);
            return;
        }

        const button = document.createElement('button');
        button.className = 'w-full text-left p-3 bg-gray-100 rounded-lg hover:bg-blue-100 transition';
        button.textContent = option.textContent;
        button.onclick = () => selectMatchFromModal(option.value);
        modalList.appendChild(button);
    });
    
    document.getElementById('genericSelectModal').classList.remove('hidden');
}

/** Ouvre la modale personnalisée pour sélectionner un joueur pour une position. */
function openPositionSelectModal(positionKey) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam || !currentTeam.players) return;
    const matchId = parseInt(document.getElementById('matchSelector').value);
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) return;

    // Cible la modale GÉNÉRIQUE
    const modal = document.getElementById('genericSelectModal');
    const modalTitle = document.getElementById('genericModalTitle');
    const modalList = document.getElementById('genericModalList');
    const modalClearBtn = document.getElementById('genericModalClearButton');

    if (positionKey === 'libero') {
        modalTitle.textContent = 'Choisir le Libéro';
    } else {
        modalTitle.textContent = `Choisir le joueur en P${positionKey.replace('pos-', '')}`;
    }
    
    // Configure et AFFICHE le bouton "Vider"
    modalClearBtn.classList.remove('hidden');
    const clearButton = modalClearBtn.querySelector('button');
    if (clearButton) clearButton.onclick = () => updatePosition(positionKey, null, true); // true = forceCloseModal

    modalList.innerHTML = ''; // Vide la liste précédente

    // ... (Le reste de la logique de filtrage des joueurs est inchangée) ...
    const setPositions = (currentTeam.courtPositions && currentTeam.courtPositions[matchId] && currentTeam.courtPositions[matchId][currentSet]) || {};
    const onCourtPlayerIds = Object.keys(setPositions)
                                .filter(pos => pos.startsWith('pos-'))
                                .map(pos => setPositions[pos]);
    const liberoId = setPositions.libero;
    const presentPlayers = currentTeam.players.filter(p => match.present.includes(p.id));
    
    let availablePlayers = [];

    if (positionKey === 'libero') {
        availablePlayers = presentPlayers.filter(p =>
            (p.mainPosition === 'Libéro' || p.secondaryPosition === 'Libéro') &&
            !onCourtPlayerIds.includes(p.id)
        );
    } else {
        availablePlayers = presentPlayers.filter(p => p.id !== liberoId);
    }
    
    if (availablePlayers.length === 0) {
        modalList.innerHTML = `<p class="text-gray-500">Aucun joueur éligible disponible.</p>`;
    } else {
        availablePlayers.forEach(player => {
            const isAlreadyOnCourt = onCourtPlayerIds.includes(player.id) && setPositions[positionKey] !== player.id;
            
            const playerButton = document.createElement('button');
            playerButton.className = 'w-full text-left p-3 bg-gray-100 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 disabled:hover:bg-gray-100';
            playerButton.innerHTML = `<span class="font-bold">#${player.jerseyNumber || '-'}</span> ${player.name}`;
            
            if (isAlreadyOnCourt) {
                playerButton.disabled = true;
                playerButton.title = "Déjà sur le terrain";
            } else {
                playerButton.onclick = () => updatePosition(positionKey, player.id, true); 
            }
            modalList.appendChild(playerButton);
        });
    }

    modal.classList.remove('hidden');
}

/** Gère le clic dans la modale de sélection d'équipe */
function selectTeamFromModal(teamId) {
    const selector = document.getElementById('teamSelector');
    selector.value = teamId;
    // Déclenche manuellement l'événement 'change'
    selector.dispatchEvent(new Event('change'));
    closeModal('genericSelectModal');
}

/** Gère le clic dans la modale de sélection de match */
function selectMatchFromModal(matchId) {
	const selector = document.getElementById('matchSelector');
	selector.value = matchId;
	   
		renderMatchSelector(); 

	// Déclenche manuellement l'événement 'change'
	selector.dispatchEvent(new Event('change'));
	closeModal('genericSelectModal');
}


// ============================
// GESTION DU VERROUILLAGE ÉCRAN (Screen Wake Lock API)
// ============================

let wakeLock = null; // Variable pour garder une référence au verrou

/**
 * Demande un verrou pour empêcher la mise en veille de l'écran.
 */
const requestWakeLock = async () => {
  // Vérifie si l'API est supportée par le navigateur
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      
      // Écoute si le verrou est libéré par le système
      wakeLock.addEventListener('release', () => {
        console.log('Screen Wake Lock a été libéré par le système.');
        wakeLock = null; // Réinitialise la variable
      });
      
      console.log('Screen Wake Lock activé.');
    } catch (err) {
      // L'erreur peut survenir si le document n'est pas visible, etc.
      console.error(`${err.name}, ${err.message}`);
      wakeLock = null; // Assure que wakeLock est null en cas d'erreur
    }
  } else {
    console.warn("L'API Screen Wake Lock n'est pas supportée par ce navigateur.");
  }
};

/**
 * Libère le verrou d'écran s'il est actif.
 */
const releaseWakeLock = async () => {
  if (wakeLock !== null) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('Screen Wake Lock libéré manuellement.');
    } catch (err) {
      console.error(`Erreur lors de la libération du Wake Lock: ${err.name}, ${err.message}`);
    }
  }
};

/**
 * Gère les changements de visibilité de l'onglet/application.
 * Ré-acquiert le verrou SEULEMENT si l'onglet 'Suivi' était actif.
 */
const handleVisibilityChange = () => {
  // Vérifie si l'onglet redevient visible
  if (document.visibilityState === 'visible') {
    // Récupère le dernier onglet actif depuis le localStorage
    const lastActiveTab = localStorage.getItem('lastActiveTab');
    
    // Si le dernier onglet était 'live', on tente de réactiver le verrou
    if (lastActiveTab === 'live') {
      console.log("L'onglet est redevenu visible ET l'onglet 'Suivi' était actif. Tentative de réactivation du Wake Lock.");
      requestWakeLock(); 
    } else {
      console.log("L'onglet est redevenu visible, mais l'onglet 'Suivi' n'était pas le dernier actif. Pas de réactivation du Wake Lock.");
    }
  } 
  // On ne fait rien de spécial si l'onglet devient caché (hidden), 
  // car releaseWakeLock est déjà appelé en quittant l'onglet 'live'.
};

// Écoute les changements de visibilité
document.addEventListener('visibilitychange', handleVisibilityChange);


console.log("Main script loaded. Waiting for DOMContentLoaded and Firebase ready.");

// ============================
// GESTION DES ENTRAÎNEMENTS
// ============================

/**
 * Affiche la liste des séances d'entraînement, séparant les séances à venir et passées.
 */
function renderTrainingList() {
    const currentTeam = getCurrentTeam();
    
    // Récupère les nouveaux conteneurs
    const upcomingListDiv = document.getElementById('upcoming-training-list');
    const pastListDiv = document.getElementById('past-training-list');
    const drawerElement = document.getElementById('past-trainings-drawer');
    const summaryElement = document.getElementById('past-trainings-summary');

    if (!upcomingListDiv || !pastListDiv || !drawerElement || !summaryElement) {
        console.error("Éléments de la liste d'entraînements introuvables !");
        return;
    }

    // Réinitialise les listes et cache le tiroir par défaut
    upcomingListDiv.innerHTML = '';
    pastListDiv.innerHTML = '';
    drawerElement.classList.add('hidden'); 

    if (!currentTeam || !currentTeam.trainings || currentTeam.trainings.length === 0) {
        upcomingListDiv.innerHTML = '<p class="text-gray-500">Aucune séance planifiée.</p>';
        return;
    }

    // Trie par date croissante (du plus ancien au plus récent)
    const sortedTrainings = [...currentTeam.trainings].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Récupère la date d'aujourd'hui (à minuit) pour la comparaison
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    let upcomingCount = 0;
    let pastCount = 0;

    sortedTrainings.forEach(session => {
        const sessionDate = new Date(session.date.replace(/-/g, '/'));
        const sessionDateString = sessionDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        const isPast = sessionDate < today;

        const card = document.createElement('div');
        
        // Applique les styles (grisé ou normal)
        let cardClasses = 'p-4 border rounded-lg flex justify-between items-center cursor-pointer transition';
        if (isPast) {
            cardClasses += ' bg-gray-100 hover:bg-gray-200'; // Style "grisé"
        } else {
            cardClasses += ' shadow-sm bg-gray-50 hover:shadow-md hover:bg-white'; // Style normal + hover
        }

        card.className = cardClasses;
        card.onclick = () => openEditTrainingModal(session.id); // Rend la carte cliquable
        
        card.innerHTML = `
            <div>
                <p class="font-bold text-lg">${session.theme || 'Séance'}</p>
                <p class="text-sm text-gray-600">${sessionDateString}</p>
            </div>
            `;

        // Ajoute la carte à la bonne liste
        if (isPast) {
            pastListDiv.appendChild(card);
            pastCount++;
        } else {
            upcomingListDiv.appendChild(card);
            upcomingCount++;
        }
    });

    // Affiche les messages si les listes sont vides
    if (upcomingCount === 0) {
        upcomingListDiv.innerHTML = '<p class="text-gray-500">Aucune séance à venir planifiée.</p>';
    }

    if (pastCount > 0) {
        // S'il y a des séances passées, on met à jour le titre du tiroir et on l'affiche
        summaryElement.textContent = `Voir les ${pastCount} séance(s) passée(s)`;
        drawerElement.classList.remove('hidden');
    }
    // Si pastCount est 0, le tiroir reste caché (comme défini au début)
}

/**
 * Ouvre la modale pour ajouter une nouvelle séance.
 */
function openAddTrainingModal() {
    // Pré-remplit la date d'aujourd'hui
    document.getElementById('newTrainingDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('newTrainingTheme').value = '';
    document.getElementById('newTrainingPlan').value = '';
    document.getElementById('addTrainingModal').classList.remove('hidden');
}

/**
 * Ajoute la nouvelle séance à la liste et sauvegarde.
 */
async function addTrainingSession() {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;

    const date = document.getElementById('newTrainingDate').value;
    const theme = document.getElementById('newTrainingTheme').value.trim();
    const plan = document.getElementById('newTrainingPlan').value.trim();

    if (!date) {
        alert("Veuillez sélectionner une date.");
        return;
    }
    
    const allPlayerIds = currentTeam.players ? currentTeam.players.map(p => p.id) : [];

    const newSession = {
        id: Date.now(),
        date: date,
        theme: theme,
        plan: plan,
        attendance: { // Initialise l'objet de présence
            present: allPlayerIds, // Cette ligne est maintenant correcte
            absent: [],
            injured: []
        }
    };

    if (!currentTeam.trainings) currentTeam.trainings = [];
    currentTeam.trainings.push(newSession);

    await saveData();
    renderTrainingList();
    closeModal('addTrainingModal');
}

/**
 * Ouvre la modale pour modifier une séance existante et gère la présence.
 * @param {number} sessionId - L'ID de la séance à ouvrir.
 */
function openEditTrainingModal(sessionId) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;

    const session = currentTeam.trainings.find(s => s.id === sessionId);
    if (!session) {
        alert("Erreur : Séance introuvable.");
        return;
    }

    // Stocke l'ID
    document.getElementById('editTrainingId').value = sessionId;

    // Remplit les infos de la séance
    document.getElementById('editTrainingDate').value = session.date;
    document.getElementById('editTrainingTheme').value = session.theme || '';
    document.getElementById('editTrainingPlan').value = session.plan || '';

    // Remplit la liste de présence
    renderTrainingAttendance(session);

    // Ouvre la modale
    document.getElementById('editTrainingModal').classList.remove('hidden');
}

/**
 * Remplit la liste des joueurs pour le suivi de la présence.
 * @param {object} session - L'objet de la séance.
 */
function renderTrainingAttendance(session) {
    const currentTeam = getCurrentTeam();
    const listDiv = document.getElementById('training-attendance-list');
    listDiv.innerHTML = '';

    if (!currentTeam || !currentTeam.players || currentTeam.players.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-500">Aucun joueur dans l\'effectif.</p>';
        return;
    }

    // Assure que l'objet de présence existe
    if (!session.attendance) {
        session.attendance = { present: [], absent: [], injured: [] };
    }

    // Trie les joueurs par nom
    const sortedPlayers = [...currentTeam.players].sort((a, b) => a.name.localeCompare(b.name));

    sortedPlayers.forEach(player => {
      
        let currentStatus = 'present'; // Statut par défaut
        if (session.attendance.absent && session.attendance.absent.includes(player.id)) {
            currentStatus = 'absent';
        } else if (session.attendance.injured && session.attendance.injured.includes(player.id)) {
            currentStatus = 'injured';
        }

        const playerDiv = document.createElement('div');
        playerDiv.className = 'flex flex-col sm:flex-row justify-between sm:items-center py-2 border-b';
        playerDiv.innerHTML = `
            <span class="font-medium">${player.name}</span>
            <div class="flex gap-3 mt-2 sm:mt-0">
                <label class="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="attendance-${player.id}" value="present" ${currentStatus === 'present' ? 'checked' : ''}>
                    Présent
                </label>
                <label class="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="attendance-${player.id}" value="absent" ${currentStatus === 'absent' ? 'checked' : ''}>
                    Absent
                </label>
                <label class="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="attendance-${player.id}" value="injured" ${currentStatus === 'injured' ? 'checked' : ''}>
                    Blessé
                </label>
            </div>
        `;
        listDiv.appendChild(playerDiv);
    });
}

/**
 * Sauvegarde les modifications apportées à une séance (plan et présence).
 */
async function saveTrainingChanges() {
    const currentTeam = getCurrentTeam();
    const sessionId = parseInt(document.getElementById('editTrainingId').value);
    if (!currentTeam || !sessionId) return;

    const session = currentTeam.trainings.find(s => s.id === sessionId);
    if (!session) return;

    // Met à jour le plan
    session.date = document.getElementById('editTrainingDate').value;
    session.theme = document.getElementById('editTrainingTheme').value.trim();
    session.plan = document.getElementById('editTrainingPlan').value.trim();

    // Met à jour la présence
    const newAttendance = { present: [], absent: [], injured: [] };
    currentTeam.players.forEach(player => {
        const selectedRadio = document.querySelector(`input[name="attendance-${player.id}"]:checked`);
        if (selectedRadio) {
            const status = selectedRadio.value; // 'present', 'absent', or 'injured'
            newAttendance[status].push(player.id);
        } else {
            newAttendance.present.push(player.id); // Par défaut si rien n'est coché
        }
    });
    session.attendance = newAttendance;

    await saveData();
    renderTrainingList(); // Rafraîchit la liste principale
    closeModal('editTrainingModal');
}

/**
 * Supprime une séance d'entraînement.
 */
async function deleteTrainingSession() {
    const currentTeam = getCurrentTeam();
    const sessionId = parseInt(document.getElementById('editTrainingId').value);
    if (!currentTeam || !sessionId) return;

    const session = currentTeam.trainings.find(s => s.id === sessionId);
    if (!session) return;

    if (confirm(`Êtes-vous sûr de vouloir supprimer la séance du ${session.date} ?`)) {
        currentTeam.trainings = currentTeam.trainings.filter(s => s.id !== sessionId);
        await saveData();
        renderTrainingList();
        closeModal('editTrainingModal');
    }
}

/**
 * Duplique la séance d'entraînement en cours d'édition,
 * la sauvegarde et ouvre la modale d'édition pour cette nouvelle séance.
 */
async function duplicateTrainingSession() {
    const currentTeam = getCurrentTeam();
    const sessionId = parseInt(document.getElementById('editTrainingId').value);
    if (!currentTeam || !sessionId) return;

    const sessionToDuplicate = currentTeam.trainings.find(s => s.id === sessionId);
    if (!sessionToDuplicate) return;

    // Crée une copie profonde
    const newSession = JSON.parse(JSON.stringify(sessionToDuplicate));

    // Attribue un nouvel ID et des infos mises à jour
    newSession.id = Date.now();
    newSession.theme = (newSession.theme || 'Séance') + " (Copie)";
    
    // Change la date à aujourd'hui par défaut
    newSession.date = new Date().toISOString().split('T')[0];

    // Ajoute la nouvelle session à la liste
    currentTeam.trainings.push(newSession);

    // Sauvegarde les données
    await saveData();

    // Met à jour la liste en arrière-plan
    renderTrainingList();

    // Ferme l'ancienne modale
    closeModal('editTrainingModal');

    // Ouvre la modale d'édition pour la NOUVELLE séance
    // On utilise un petit délai pour s'assurer que la fermeture est terminée
    setTimeout(() => {
        openEditTrainingModal(newSession.id);
    }, 100);
}

// ============================
// IMPORT / EXPORT EXCEL
// ============================

/**
 * Génère et télécharge un modèle Excel vide pour aider l'utilisateur.
 */
function downloadPlayerTemplate() {
    // Définit les colonnes attendues
    const headers = [
        ["Nom", "Prénom", "Numéro", "Licence", "Genre (H/F)", "Poste Principal", "Poste Secondaire"]
    ];

    // Crée un classeur et une feuille
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);

    // Ajoute une ligne d'exemple (optionnel)
    XLSX.utils.sheet_add_aoa(ws, [
        ["Dupont", "Jean", "10", "123456", "H", "Passeur", ""]
    ], { origin: "A2" });

    XLSX.utils.book_append_sheet(wb, ws, "Effectif");

    // Déclenche le téléchargement
    XLSX.writeFile(wb, "Modele_Import_Joueurs.xlsx");
}

/**
 * Déclenche le clic sur l'input de fichier caché.
 */
function triggerImportPlayers() {
    document.getElementById('importPlayerFile').click();
}

/**
 * Traite le fichier Excel sélectionné et ajoute les joueurs.
 */
async function handlePlayerImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Prend la première feuille
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertit en JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert("Le fichier semble vide.");
                return;
            }

            const currentTeam = getCurrentTeam();
            let addedCount = 0;
            let duplicateCount = 0;

            jsonData.forEach(row => {
                // Mapping des colonnes (flexible sur la casse)
                // On cherche les clés qui ressemblent à nos attentes
                const getVal = (keyStart) => {
                    const key = Object.keys(row).find(k => k.trim().toLowerCase().startsWith(keyStart.toLowerCase()));
                    return key ? row[key] : null;
                };

                const lastName = getVal("Nom") || "";
                const firstName = getVal("Prénom") || getVal("Prenom") || "";
                const fullName = `${firstName} ${lastName}`.trim() || getVal("Nom complet") || "Joueur Inconnu";
                
                let jersey = getVal("Numéro") || getVal("Numero") || "";
                if (jersey) jersey = String(jersey); // Force en chaîne

                const license = getVal("Licence") || "";
                const genderRaw = getVal("Genre") || getVal("Sexe") || "H";
                const gender = genderRaw.toString().toUpperCase().includes("F") ? "F" : "H";
                
                let mainPos = getVal("Poste P") || "Passeur"; // Défaut
                let secPos = getVal("Poste S") || "";

                // Validation basique des postes (doit correspondre aux constantes)
                if (!POSITIONS.includes(mainPos)) mainPos = POSITIONS[0];
                if (secPos && !POSITIONS.includes(secPos)) secPos = "";

                // Vérification doublon (Nom)
                const exists = currentTeam.players.some(p => p.name.toLowerCase() === fullName.toLowerCase());
                
                if (!exists && fullName !== "Joueur Inconnu") {
                    currentTeam.players.push({
                        id: Date.now() + Math.floor(Math.random() * 1000), // ID unique
                        name: fullName,
                        licenseNumber: String(license),
                        jerseyNumber: jersey,
                        gender: gender,
                        mainPosition: mainPos,
                        secondaryPosition: secPos
                    });
                    addedCount++;
                } else {
                    duplicateCount++;
                }
            });

            if (addedCount > 0) {
                await saveData();
                renderPlayerList();
                alert(`${addedCount} joueur(s) importé(s) avec succès !` + (duplicateCount > 0 ? `\n(${duplicateCount} ignorés car déjà existants)` : ""));
            } else {
                alert("Aucun nouveau joueur n'a été importé (doublons ou format incorrect).");
            }

        } catch (error) {
            console.error("Erreur lors de l'importation:", error);
            alert("Erreur lors de la lecture du fichier Excel. Vérifiez le format.");
        } finally {
            // Reset l'input pour permettre de réimporter le même fichier si besoin
            event.target.value = ''; 
        }
    };

    reader.readAsArrayBuffer(file);
}


/**
 * Effectue une rotation des joueurs sur le terrain.
 * @param {string} direction - 'clockwise' (Standard: P2->P1) ou 'counter-clockwise' (Inverse: P1->P2).
 */
async function rotateCourt(direction) {
    const currentTeam = getCurrentTeam();
    if (!currentTeam) return;
    const matchId = parseInt(document.getElementById('matchSelector').value);
    if (!matchId) return;

    // S'assure que la structure existe
    if (!currentTeam.courtPositions[matchId] || !currentTeam.courtPositions[matchId][currentSet]) {
        alert("La composition est vide.");
        return;
    }

    const matchPositions = currentTeam.courtPositions[matchId];
    const setPositions = matchPositions[currentSet];
    
    // 1. Sauvegarde pour la cascade
    const compositionBeforeRotation = JSON.parse(JSON.stringify(setPositions));

    // Création de la nouvelle map de positions
    const newPositions = { ...setPositions }; // Copie incluant le libéro

    // Définition de l'ordre des positions (P1 à P6)
    // Clockwise (Rotation standard Volley) : Le joueur en P2 va en P1, P1 va en P6, etc.
    // P1(1) <- P2(2) <- P3(3) <- P4(4) <- P5(5) <- P6(6) <- P1(1)
    
    const rotationMap = {
        'clockwise': {
            'pos-1': 'pos-2',
            'pos-6': 'pos-1',
            'pos-5': 'pos-6',
            'pos-4': 'pos-5',
            'pos-3': 'pos-4',
            'pos-2': 'pos-3'
        },
        'counter-clockwise': {
            'pos-2': 'pos-1',
            'pos-3': 'pos-2',
            'pos-4': 'pos-3',
            'pos-5': 'pos-4',
            'pos-6': 'pos-5',
            'pos-1': 'pos-6'
        }
    };

    const mapToUse = rotationMap[direction];

    // Applique la rotation
    for (const [targetPos, sourcePos] of Object.entries(mapToUse)) {
        if (setPositions[sourcePos]) {
            newPositions[targetPos] = setPositions[sourcePos];
        } else {
            delete newPositions[targetPos]; // Si la source est vide, la cible devient vide
        }
    }

    // Met à jour l'objet principal
    matchPositions[currentSet] = newPositions;


    // --- 2. LOGIQUE DE CASCADE (Propagation aux sets suivants) ---
    const currentSetIndex = SETS.indexOf(currentSet);

    for (let i = currentSetIndex + 1; i < SETS.length; i++) {
        const subsequentSetName = SETS[i]; 
        const subsequentSetCompo = matchPositions[subsequentSetName] || {};

        // Si le set suivant était identique à la compo AVANT rotation, on le met à jour
        if (areCompositionsEqual(subsequentSetCompo, compositionBeforeRotation)) {
            console.log(`Cascade (Rotation): Mise à jour de ${subsequentSetName} depuis ${currentSet}.`);
            matchPositions[subsequentSetName] = JSON.parse(JSON.stringify(newPositions));
        } else {
            console.log(`Cascade (Rotation): Arrêt à ${subsequentSetName}.`);
            break; 
        }
    }
    // --- FIN CASCADE ---

    await saveData();
    renderCourt();
    // Pas besoin de recalculatePlayedStatus ici car ce sont les mêmes joueurs, juste déplacés.
}

/**
 * Ferme le tiroir de présence (si ouvert).
 */
function collapseAttendanceDrawer() {
    const drawer = document.getElementById('attendance-drawer');
    if (drawer && drawer.open) {
        drawer.open = false;
    }
}
