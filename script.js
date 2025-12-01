// ============================
// CONSTANTES ET ÉTAT GLOBAL
// ============================
const POSITIONS = ['Passeur', 'Central', 'R\u00e9ceptionneur-Attaquant', 'Pointu', 'Lib\u00e9ro'];
const SETS = ['set1', 'set2', 'set3', 'set4', 'set5'];

// Structure de données principale, chargée depuis localStorage au démarrage

let currentSet = 'set1';
// 'currentUser' est défini et géré dans auth.js
// let firestoreListener = null; // Géré dans auth.js

// États pour le suivi du match
let currentTrackingMode = 'faults'; // 'faults' or 'points'
let currentDetailMode = true; // true = detailed, false = simple

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
            loadDetailModePreference(matchId); // Charge la préférence détail/simple pour ce match
            renderAttendanceForSelectedMatch(); // Affiche la feuille de match, etc.
            renderLiveTrackingView(); // Met à jour l'onglet Suivi Match
        });
    }

    const detailToggle = document.getElementById('detail-mode-toggle');
     if (detailToggle) {
        detailToggle.addEventListener('change', async () => {
            currentDetailMode = detailToggle.checked;
            console.log("Detail mode toggled:", currentDetailMode);
             await saveDetailModePreference(); // Sauvegarde la préférence (appelle saveData d'auth.js)
            renderLiveTrackingView(); // Rafraîchit l'affichage
        });
     }

     // Attache les listeners pour les boutons Fautes/Points
     const faultModeButton = document.getElementById('track-mode-faults');
     const pointModeButton = document.getElementById('track-mode-points');
     if (faultModeButton) faultModeButton.addEventListener('click', () => setTrackingMode('faults'));
     if (pointModeButton) pointModeButton.addEventListener('click', () => setTrackingMode('points'));

}

// ============================
// GESTION DES MODES DE SUIVI
// ============================
function setTrackingMode(mode) {
    if (mode === 'faults' || mode === 'points') {
        currentTrackingMode = mode;
        console.log("Tracking mode set to:", mode);

        const faultBtn = document.getElementById('track-mode-faults');
        const pointBtn = document.getElementById('track-mode-points');

        if (faultBtn && pointBtn) {
            
            // --- DÉBUT DE LA MODIFICATION (Couleurs 400) ---

            // Style INACTIF (Blanc/Gris)
            const inactiveClasses = ['bg-white', 'text-gray-700', 'hover:bg-gray-50'];
            
            // Style ACTIF pour FAUTES (Orange) - VOTRE MODIFICATION
            const faultActiveClasses = ['bg-orange-400', 'text-white', 'hover:bg-orange-500'];
            
            // Style ACTIF pour POINTS (Vert) - VOTRE MODIFICATION
            const pointActiveClasses = ['bg-green-400', 'text-white', 'hover:bg-green-500'];

            // Liste de TOUTES les classes de style à nettoyer
            const allClassesToRemove = [
                ...inactiveClasses, 
                ...faultActiveClasses, 
                ...pointActiveClasses,
                'bg-blue-500', 
                'hover:bg-blue-600',
                'bg-orange-500', // Ajout des anciens styles pour un nettoyage complet
                'hover:bg-orange-600',
                'bg-green-500',
                'hover:bg-green-600'
            ];

            // 1. Nettoyer les deux boutons
            faultBtn.classList.remove(...allClassesToRemove);
            pointBtn.classList.remove(...allClassesToRemove);

            // 2. Appliquer les bons styles
            if (mode === 'faults') {
                faultBtn.classList.add(...faultActiveClasses); // Actif (Orange)
                pointBtn.classList.add(...inactiveClasses);    // Inactif (Blanc)
            } else { // mode === 'points'
                faultBtn.classList.add(...inactiveClasses);    // Inactif (Blanc)
                pointBtn.classList.add(...pointActiveClasses); // Actif (Vert)
            }
            // --- FIN DE LA MODIFICATION ---
        }

        // Met à jour le libellé de l'interrupteur (inchangé)
        const detailLabel = document.getElementById('detail-toggle-label');
         if (detailLabel) {
            detailLabel.textContent = currentDetailMode
                                        ? (mode === 'faults' ? "Fautes Détaillées" : "Points Détaillés")
                                        : (mode === 'faults' ? "Fautes Simples" : "Points Simples");
         }

        renderLiveTrackingView(); // Re-render the cards for the new mode
    }
}

function loadDetailModePreference(matchId) {
     const team = getCurrentTeam();
     if (!team || !team.matches) return; // Sécurité
     const match = team.matches.find(m => m.id === parseInt(matchId));

     if (match) {
        // Récupère la valeur sauvegardée ou utilise true (détaillé) par défaut
        currentDetailMode = typeof match.detailMode === 'boolean' ? match.detailMode : true;
     } else {
         currentDetailMode = true; // Défaut si le match n'est pas (encore) trouvé
     }
     // Met à jour l'état visuel de l'interrupteur
     const toggle = document.getElementById('detail-mode-toggle');
     if (toggle) toggle.checked = currentDetailMode;
     console.log(`Loaded detail mode preference for match ${matchId}: ${currentDetailMode}`);

     // Met à jour le libellé du bouton Détaillé/Simple
     const detailLabel = document.getElementById('detail-toggle-label');
      if (detailLabel) {
         detailLabel.textContent = currentDetailMode
                                     ? (currentTrackingMode === 'faults' ? "Fautes Détaillées" : "Points Détaillés")
                                     : (currentTrackingMode === 'faults' ? "Fautes Simples" : "Points Simples");
      }
}

async function saveDetailModePreference() {
     const matchId = parseInt(document.getElementById('matchSelector').value);
     const team = getCurrentTeam();
     if (!team || !team.matches) return; // Sécurité
     const match = team.matches.find(m => m.id === matchId);

     if (match) {
         match.detailMode = currentDetailMode; // Met à jour la donnée dans l'objet match
         await saveData(); // Sauvegarde (local et en ligne si connecté) via auth.js
         console.log(`Saved detail mode for match ${matchId}:`, currentDetailMode);

          // Met à jour le libellé après sauvegarde
         const detailLabel = document.getElementById('detail-toggle-label');
         if (detailLabel) {
             detailLabel.textContent = currentDetailMode
                                         ? (currentTrackingMode === 'faults' ? "Fautes Détaillées" : "Points Détaillés")
                                         : (currentTrackingMode === 'faults' ? "Fautes Simples" : "Points Simples");
         }
     } else {
         console.warn("Could not save detail mode preference: match not found.");
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
        window.appData.lastFaultAction = null; 
        window.appData.lastPointAction = null; 
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
        
		// Initialise le mode de suivi (Fautes/Points)
        // Cet appel est déplacé ici pour s'assurer qu'appData est chargé
        // avant que setTrackingMode -> renderLiveTrackingView -> getCurrentTeam ne soit appelé.
        setTrackingMode(currentTrackingMode);
		
        // Restaure le dernier onglet actif ou va sur 'Effectif' par défaut
        const lastTab = localStorage.getItem('lastActiveTab') || 'roster';
        showMainTab(lastTab); // Affiche le bon onglet

        // Restaure le dernier match sélectionné pour cette équipe
        const savedMatchId = localStorage.getItem(`lastSelectedMatch_${appData.currentTeamId}`);
        const selector = document.getElementById('matchSelector');

        if (savedMatchId && selector && selector.querySelector(`option[value="${savedMatchId}"]`)) {
             console.log(`Restoring selected match: ${savedMatchId}`);
            selector.value = savedMatchId;
            // Charge la préférence détail/simple pour ce match restauré
            loadDetailModePreference(savedMatchId);
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

    if (!currentTeam || !playerListDiv) return;

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
        return;
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

/**
 * Affiche les statistiques des joueurs, potentiellement filtrées par match.
 * @param {number[] | null} [matchIdsToRender=null] - Liste d'ID de matchs à inclure. Si null, inclut tous les matchs.
 */
function renderPlayerStats(matchIdsToRender = null) { 
    const currentTeam = getCurrentTeam();
    const statsBody = document.getElementById('statsTableBody');
    if (!statsBody) return;
    statsBody.innerHTML = ''; 
    if (!currentTeam || !currentTeam.players || currentTeam.players.length === 0) {
         statsBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-gray-500">Aucun joueur dans l\'effectif.</td></tr>';
        return;
    }

    const sortedPlayers = [...currentTeam.players].sort((a, b) => a.name.localeCompare(b.name));

    sortedPlayers.forEach(player => {
        let presenceCount = 0; let playedCount = 0; let setCount = 0; let setsWonCount = 0;
        let faultCounts = { service: 0, attack: 0, reception: 0, net: 0 };
        let pointCounts = { service: 0, attack: 0, block: 0, net: 0 };

        // --- DÉBUT DE LA LOGIQUE DE FILTRE ---
        let matchesToProcess = currentTeam.matches;

        // Si un filtre est fourni, filtre la liste des matchs
        if (Array.isArray(matchIdsToRender) && currentTeam.matches) {
            matchesToProcess = currentTeam.matches.filter(m => matchIdsToRender.includes(m.id));
        }
        // --- FIN DE LA LOGIQUE DE FILTRE ---


        if (matchesToProcess) { // S'assure qu'il y a des matchs à traiter
            matchesToProcess.forEach(match => { 
                if (!match) return; 

                // Note: La présence et le "joué" sont calculés sur les matchs filtrés
                if (match.present?.includes(player.id)) presenceCount++;
                if (match.played?.includes(player.id)) playedCount++;

                 SETS.forEach((setName, index) => {
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
                         if (parseInt(setScore.myTeam) > parseInt(setScore.opponent)) {
                             setsWonCount++;
                         }
                     }
                 });


                // Agrège les fautes (sur les matchs filtrés)
                if (match.faults) {
                    SETS.forEach(setName => {
                        if (match.faults[setName]?.[player.id]) {
                            const playerFaultsInSet = match.faults[setName][player.id];
                            faultCounts.service += playerFaultsInSet.service || 0;
                            faultCounts.attack += playerFaultsInSet.attack || 0;
                            faultCounts.reception += playerFaultsInSet.reception || 0;
                            faultCounts.net += playerFaultsInSet.net || 0;
                        }
                    });
                 }
                 // Agrège les points (sur les matchs filtrés)
                 if (match.points) {
                    SETS.forEach(setName => {
                        if (match.points[setName]?.[player.id]) {
                            const p = match.points[setName][player.id];
                            pointCounts.service += p.service || 0;
                            pointCounts.attack += p.attack || 0;
                            pointCounts.block += p.block || 0; 
                            pointCounts.net += p.net || 0;     
                        }
                    });
                 }
            });
        }

        const totalFaults = Object.values(faultCounts).reduce((a, b) => a + b, 0);
        const totalPoints = Object.values(pointCounts).reduce((a, b) => a + b, 0); 

        const row = document.createElement('tr');
        row.className = 'border-b';
        // HTML de la ligne (inchangé)
        row.innerHTML = `
            <td class="p-3">${player.name}</td>
            <td class="p-3 text-center">${presenceCount || ''}</td>
            <td class="p-3 text-center">${playedCount || ''}</td>
            <td class="p-3 text-center">${setCount || ''}</td>
            <td class="p-3 text-center">${setsWonCount || ''}</td>
            <td class="p-3 text-center text-red-600">${faultCounts.service || ''}</td>
            <td class="p-3 text-center text-red-600">${faultCounts.attack || ''}</td>
            <td class="p-3 text-center text-red-600">${faultCounts.reception || ''}</td>
            <td class="p-3 text-center text-red-600">${faultCounts.net || ''}</td>
            <td class="p-3 text-center font-bold">${totalFaults || ''}</td>
            <td class="p-3 text-center text-green-600">${pointCounts.service || ''}</td>
            <td class="p-3 text-center text-green-600">${pointCounts.attack || ''}</td>
            <td class="p-3 text-center text-green-600">${pointCounts.block || ''}</td>
            <td class="p-3 text-center text-green-600">${pointCounts.net || ''}</td>
            <td class="p-3 text-center font-bold">${totalPoints || ''}</td>
        `;
        statsBody.appendChild(row);
    });
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

        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center';
        
        itemDiv.innerHTML = `
            <input id="match-filter-${matchId}" type="checkbox" value="${matchId}" checked class="stats-match-filter h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
            <label for="match-filter-${matchId}" class="ml-2 block text-sm text-gray-900 truncate" title="${matchLabel}">
                ${matchLabel}
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
    const selectedMatchIds = [];
    // Cible les checkboxes DANS LA MODALE
    document.querySelectorAll('#statsFilterModal .stats-match-filter:checked').forEach(checkbox => {
        selectedMatchIds.push(parseInt(checkbox.value));
    });

    if (selectedMatchIds.length === 0) {
        alert("Veuillez sélectionner au moins un match pour afficher les statistiques.");
        return;
    }

    // Appelle renderPlayerStats en lui passant la liste des ID sélectionnés
    renderPlayerStats(selectedMatchIds);
    
    closeModal('statsFilterModal'); // Ferme la modale après application
}

/**
 * Remplit la liste du filtre et ouvre la modale de filtre des statistiques.
 */
function openStatsFilterModal() {
    renderStatsFilter(); // Remplit la liste
    document.getElementById('statsFilterModal').classList.remove('hidden'); // Ouvre la modale
}

// ============================
// SUIVI MATCH (LIVE - FAUTES ET POINTS)
// ============================
/**
 * Attache les écouteurs d'événements (clic simple, clic long) aux boutons de faute ou de point.
 * @param {HTMLElement} button - Le bouton HTML.
 * @param {number} matchId - L'ID du match.
 * @param {number} playerId - L'ID du joueur.
 * @param {string} type - Le type de faute/point ('service', 'attack', 'block', 'reception', 'net').
 * @param {string} mode - 'faults' ou 'points'.
 */
function addLiveButtonListeners(button, matchId, playerId, type, mode) {
    let pressTimer; // Timer pour détecter l'appui long
    let longPressOccurred = false; // Flag pour savoir si l'appui long a eu lieu
    let isScrolling = false; // Flag pour ignorer si l'utilisateur fait défiler la page
    let startX, startY; // Coordonnées de départ de l'appui

    // Fonction déclenchée au début de l'appui (souris ou doigt)
    const startPress = (e) => {
        isScrolling = false;
        longPressOccurred = false;
        startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        // Ajoute une classe visuelle pour indiquer que le bouton est pressé
        button.classList.add(mode === 'faults' ? 'fault-btn-active' : 'point-btn-active');

        // Démarre le timer pour l'appui long (500ms)
        pressTimer = setTimeout(() => {
            if (isScrolling) return; // Ne rien faire si l'utilisateur défile
            if (e.cancelable) e.preventDefault(); // Empêche le comportement par défaut (ex: sélection de texte)
            longPressOccurred = true;
            // Appelle la fonction de mise à jour pour décrémenter
            if (mode === 'faults') updateFault(matchId, playerId, type, -1);
            else updatePoint(matchId, playerId, type, -1);
        }, 500);
     };

    // Fonction déclenchée pendant le déplacement (souris ou doigt)
    const movePress = (e) => {
        if (longPressOccurred || isScrolling) return; // Ne rien faire si l'appui long a déjà eu lieu ou si on défile

        const moveX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const moveY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        const diffX = Math.abs(startX - moveX);
        const diffY = Math.abs(startY - moveY);

        // Si le doigt a bougé de plus de 10px, on considère que c'est un défilement
        if (diffX > 10 || diffY > 10) {
            isScrolling = true;
            clearTimeout(pressTimer); // Annule le timer de l'appui long
            button.classList.remove(mode === 'faults' ? 'fault-btn-active' : 'point-btn-active'); // Retire l'effet visuel
        }
     };

    // Fonction déclenchée à la fin de l'appui (relâchement souris ou doigt)
    const endPress = (e) => {
        clearTimeout(pressTimer); // Annule le timer (au cas où il n'ait pas fini)
        // Si l'appui long n'a PAS eu lieu ET qu'on ne défilait PAS
        if (!longPressOccurred && !isScrolling) {
            if (e.cancelable) e.preventDefault(); // Empêche le comportement par défaut (ex: zoom)
            // C'est un clic simple : on appelle la fonction de mise à jour pour incrémenter
            if (mode === 'faults') updateFault(matchId, playerId, type, 1);
            else updatePoint(matchId, playerId, type, 1);
        }
        // Retire l'effet visuel après un court délai (pour l'effet 'flash')
        setTimeout(() => button.classList.remove(mode === 'faults' ? 'fault-btn-active' : 'point-btn-active'), 50);
     };

    // --- Gestion des écouteurs d'événements ---
    // Technique simple pour supprimer les anciens écouteurs avant d'en ajouter de nouveaux
    // Cela évite que les actions ne soient déclenchées plusieurs fois si la carte est redessinée
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    const buttonRef = document.getElementById(newButton.id); // Récupère la référence au nouveau bouton

    // Attache les écouteurs pour la souris
    buttonRef.addEventListener('mousedown', startPress);
    buttonRef.addEventListener('mouseup', endPress);
    buttonRef.addEventListener('mousemove', movePress);
    buttonRef.addEventListener('mouseleave', () => { // Si la souris quitte le bouton pendant l'appui
        clearTimeout(pressTimer);
        isScrolling = true; // On considère que l'action est annulée
        buttonRef.classList.remove(mode === 'faults' ? 'fault-btn-active' : 'point-btn-active');
    });

    // Attache les écouteurs pour le tactile (sans l'option passive pour pouvoir utiliser preventDefault)
    buttonRef.addEventListener('touchstart', startPress);
    buttonRef.addEventListener('touchend', endPress);
    buttonRef.addEventListener('touchmove', movePress);
    buttonRef.addEventListener('touchcancel', () => { // Si le système annule l'événement tactile
        clearTimeout(pressTimer);
        isScrolling = true;
        buttonRef.classList.remove(mode === 'faults' ? 'fault-btn-active' : 'point-btn-active');
    });
}


/**
 * Affiche l'interface de suivi en direct (fautes ou points) pour le match et le set sélectionnés.
 */

function renderLiveTrackingView() {
    const currentTeam = getCurrentTeam();
    const liveContent = document.getElementById('live-content');
    const liveHint = document.getElementById('live-match-hint');
    const courtLayout = document.getElementById('live-court-layout');
    const detailToggle = document.getElementById('detail-mode-toggle');
    const liveMatchDisplay = document.getElementById('live-match-display');
    const liveMatchName = document.getElementById('live-match-name');
    const undoButton = document.getElementById('undo-last-fault'); 
    const matchSelector = document.getElementById('matchSelector'); 

    // --- VÉRIFICATION (inchangée) ---
    if (!matchSelector || !matchSelector.value || !currentTeam || !liveContent || !liveHint || !courtLayout || !detailToggle || !liveMatchDisplay || !liveMatchName) {
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

    if (typeof match.detailMode === 'undefined') match.detailMode = true; 
    detailToggle.checked = currentDetailMode; 

    // --- (Logique des boutons Fautes/Points inchangée) ---
    const faultBtn = document.getElementById('track-mode-faults');
    const pointBtn = document.getElementById('track-mode-points');
    
    if (faultBtn && pointBtn) {
        const inactiveClasses = ['bg-white', 'text-gray-700', 'hover:bg-gray-50'];
        const faultActiveClasses = ['bg-orange-400', 'text-white', 'hover:bg-orange-500'];
        const pointActiveClasses = ['bg-green-400', 'text-white', 'hover:bg-green-500'];
        const allClassesToRemove = [
            ...inactiveClasses, ...faultActiveClasses, ...pointActiveClasses,
            'bg-blue-500', 'hover:bg-blue-600', 'bg-orange-500', 
            'hover:bg-orange-600', 'bg-green-500', 'hover:bg-green-600'
        ];
        faultBtn.classList.remove(...allClassesToRemove);
        pointBtn.classList.remove(...allClassesToRemove);
        if (currentTrackingMode === 'faults') {
            faultBtn.classList.add(...faultActiveClasses);
            pointBtn.classList.add(...inactiveClasses);
        } else {
            faultBtn.classList.add(...inactiveClasses);
            pointBtn.classList.add(...pointActiveClasses);
        }
    }
    // --- (Fin de la logique des boutons) ---

    const detailLabel = document.getElementById('detail-toggle-label');
    if (detailLabel) detailLabel.textContent = currentDetailMode ? (currentTrackingMode === 'faults' ? "Fautes Détaillées" : "Points Détaillés") : (currentTrackingMode === 'faults' ? "Fautes Simples" : "Points Simples");

    renderSetSelector(); 

    courtLayout.innerHTML = ''; 
    const setPositions = (currentTeam.courtPositions && currentTeam.courtPositions[matchId] && currentTeam.courtPositions[matchId][currentSet]) || {};

    const onCourtPlayerIds = Object.keys(setPositions)
        .filter(pos => pos.startsWith('pos-'))
        .map(pos => setPositions[pos]).filter(Boolean); 
    
    // --- DÉBUT DE LA MODIFICATION ---
    // On récupère l'ID du libéro DÉSIGNÉ pour ce set
    const liberoId = setPositions.libero; 
    // --- FIN DE LA MODIFICATION ---

    const participatingPlayerIds = new Set([...onCourtPlayerIds, liberoId].filter(Boolean));

    if (participatingPlayerIds.size === 0) {
        courtLayout.innerHTML = `<p class="text-gray-500 col-span-2 text-center">Définissez la composition dans l'onglet "Matchs" pour commencer le suivi.</p>`;
        renderSummary(); 
        return;
    }

    // Fonction interne pour créer et ajouter une carte joueur
    const createAndAppendCard = (playerId) => {
        const player = currentTeam.players.find(p => p.id === playerId);
        if (!player) return null; 

        let card; 
        // Note : 'isLibero' ici vérifie le RÔLE, mais n'est plus utilisé pour le 'if'
        const isLibero = player.mainPosition === 'Libéro' || player.secondaryPosition === 'Libéro';

        if (currentTrackingMode === 'faults') {
            if (currentDetailMode) {
                // --- MODIFICATION ---
                // On passe l'ID du libéro désigné à la fonction
                card = createPlayerCardLiveDetailed_Faults(match, player, liberoId);
                // --- FIN MODIFICATION ---
                courtLayout.appendChild(card);
                ['service', 'attack', 'reception', 'net'].forEach(type => {
                    const button = card.querySelector(`#fault-btn-${player.id}-${type}`);
                    if (button) addLiveButtonListeners(button, match.id, player.id, type, 'faults');
                });
            } else { 
                card = createPlayerCardLiveSimple_Faults(match, player);
                courtLayout.appendChild(card);
                const button = card.querySelector(`#fault-btn-${player.id}-simple`);
                if (button) addLiveButtonListeners(button, match.id, player.id, 'net', 'faults'); 
            }
        } else { // Mode Points
            if (currentDetailMode) {
                // --- MODIFICATION ---
                // On passe l'ID du libéro désigné à la fonction
                card = createPlayerCardLiveDetailed_Points(match, player, liberoId);
                // --- FIN MODIFICATION ---
                courtLayout.appendChild(card);
                ['service', 'attack', 'block', 'net'].forEach(type => {
                    const button = card.querySelector(`#point-btn-${player.id}-${type}`);
                    if (button) addLiveButtonListeners(button, match.id, player.id, type, 'points');
                });
            } else { 
                card = createPlayerCardLiveSimple_Points(match, player);
                courtLayout.appendChild(card);
                const button = card.querySelector(`#point-btn-${player.id}-simple`);
                if (button) addLiveButtonListeners(button, match.id, player.id, 'net', 'points'); 
            }
        }

        // Style du libéro (inchangé, border-t-4)
        if (playerId === liberoId && card) {
            card.classList.add('border-t-4', 'border-yellow-500', 'mt-2');
        }
        return card;
    };

    onCourtPlayerIds.forEach(createAndAppendCard);
    if (liberoId) createAndAppendCard(liberoId);

    renderSummary(); 
}

function createPlayerCardLiveDetailed_Faults(match, player, designatedLiberoId) {
    const card = document.createElement('div');
    const genderClass = player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100';
    // S'assure que la carte est flex-col
    card.className = `live-player-card ${genderClass} flex flex-col`; 

    const faults = (match.faults && match.faults[currentSet] && match.faults[currentSet][player.id])
                 || { service: 0, attack: 0, reception: 0, net: 0 };

    // --- DÉBUT DE LA MODIFICATION ---
    // La logique vérifie maintenant si ce joueur EST le libéro DÉSIGNÉ pour ce set
    const isDesignatedLibero = player.id === designatedLiberoId;
    // --- FIN DE LA MODIFICATION ---

    let buttonsHtml = '';

    // Classe pour les boutons en GRILLE (carrés)
    const gridLayoutClass = "aspect-square flex flex-col items-center justify-center p-1 rounded-md text-sm font-medium w-full select-none";
    
    // CLASSE CORRIGÉE pour le LIBÉRO (Rectangulaire + 'flex-grow')
    const liberoLayoutClass = "flex flex-col items-center justify-center rounded-md text-sm font-medium w-full p-1 flex-grow select-none"; 

    // Classes de COULEUR (Orange)
    const colorClass = "bg-orange-400 hover:bg-orange-500 border-orange-400 text-white";

    // --- MODIFICATION ---
    if (isDesignatedLibero) { // Utilise la nouvelle variable
    // --- FIN MODIFICATION ---
        // Libero : 2 boutons rectangulaires
        buttonsHtml = `
            <div class="flex flex-col gap-2 mt-3 flex-grow">
                 <button id="fault-btn-${player.id}-reception" class="${liberoLayoutClass} ${colorClass}">
                     <span>Réception</span>
                     <span class="fault-count" id="fault-count-${player.id}-reception">${faults.reception}</span>
                 </button>
                 <button id="fault-btn-${player.id}-net" class="${liberoLayoutClass} ${colorClass}">
                     <span>Autres</span>
                     <span class="fault-count" id="fault-count-${player.id}-net">${faults.net}</span>
                 </button>
            </div>`;
    } else {
        // Autres joueurs (ou libéro sur le terrain) : grille de 4 boutons carrés
        const faultGridClass = "grid grid-cols-2 gap-2 mt-3 flex-grow"; 
        
        buttonsHtml = `
            <div class="${faultGridClass}">
                <button id="fault-btn-${player.id}-service" class="${gridLayoutClass} ${colorClass}">
                    <span>Service</span>
                    <span class="fault-count" id="fault-count-${player.id}-service">${faults.service}</span>
                </button>
                <button id="fault-btn-${player.id}-attack" class="${gridLayoutClass} ${colorClass}">
                    <span>Attaque</span>
                    <span class="fault-count" id="fault-count-${player.id}-attack">${faults.attack}</span>
                </button>
                <button id="fault-btn-${player.id}-reception" class="${gridLayoutClass} ${colorClass}">
                    <span>Récep</span>
                    <span class="fault-count" id="fault-count-${player.id}-reception">${faults.reception}</span>
                </button>
                <button id="fault-btn-${player.id}-net" class="${gridLayoutClass} ${colorClass}">
                    <span>Autres</span>
                    <span class="fault-count" id="fault-count-${player.id}-net">${faults.net}</span>
                </button>
            </div>`;
    }

    card.innerHTML = `
        <div class="font-bold cursor-pointer hover:text-blue-600 player-name-display" onclick="openSubstitutionModal(${player.id})">
            #${player.jerseyNumber || '-'} ${player.name}
        </div>
        ${buttonsHtml}
    `;
    return card;
}


function createPlayerCardLiveSimple_Faults(match, player) {
    const card = document.createElement('div');
    const genderClass = player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100';
    card.className = `live-player-card ${genderClass}`; // Base class

    const faults = (match.faults && match.faults[currentSet] && match.faults[currentSet][player.id])
                 || { service: 0, attack: 0, reception: 0, net: 0 };
    const totalFaults = Object.values(faults).reduce((a, b) => a + b, 0);

    card.innerHTML = `
        <div class="font-bold cursor-pointer hover:text-blue-600 player-name-display" onclick="openSubstitutionModal(${player.id})">
            #${player.jerseyNumber || '-'} ${player.name}
        </div>
        <button id="fault-btn-${player.id}-simple" class="simple-fault-btn">
            <span id="fault-count-${player.id}-simple">${totalFaults}</span>
        </button>
    `;
    return card;
}

/**
 * Crée la carte détaillée pour le suivi des POINTS d'un joueur.
 * @param {object} match - L'objet match actuel.
 * @param {object} player - L'objet joueur.
 * @param {number} designatedLiberoId - L'ID du joueur désigné comme Libéro pour ce set.
 * @returns {HTMLElement} L'élément div représentant la carte.
 */
function createPlayerCardLiveDetailed_Points(match, player, designatedLiberoId) {
    const card = document.createElement('div');
    const genderClass = player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100';
    // S'assure que la carte est flex-col
    card.className = `live-player-card ${genderClass} flex flex-col`;

    const points = (match.points && match.points[currentSet] && match.points[currentSet][player.id])
                 || { service: 0, attack: 0, block: 0, net: 0 }; 

    // --- DÉBUT DE LA MODIFICATION ---
    // La logique vérifie maintenant si ce joueur EST le libéro DÉSIGNÉ pour ce set
    const isDesignatedLibero = player.id === designatedLiberoId;
    // --- FIN DE LA MODIFICATION ---

    let buttonsHtml = '';

    // Classe pour les boutons en GRILLE (carrés)
    const gridLayoutClass = "aspect-square flex flex-col items-center justify-center p-1 rounded-md text-sm font-medium w-full select-none";
    
    // CLASSE CORRIGÉE pour le LIBÉRO (Rectangulaire + 'flex-grow')
    const liberoLayoutClass = "flex flex-col items-center justify-center rounded-md text-sm font-medium w-full p-1 flex-grow select-none"; 

    // Classes de COULEUR (Vert)
    const colorClass = "bg-green-500 hover:bg-green-600 border-green-500 text-white";

    // --- MODIFICATION ---
    if (isDesignatedLibero) { // Utilise la nouvelle variable
    // --- FIN MODIFICATION ---
        // Libero : un seul bouton, rectangulaire, qui s'étire
        buttonsHtml = `
            <div class="flex flex-col gap-2 mt-3 flex-grow">
                 <button id="point-btn-${player.id}-net" class="${liberoLayoutClass} ${colorClass}">
                     <span>Autres</span>
                     <span class="point-count" id="point-count-${player.id}-net">${points.net}</span>
                 </button>
            </div>`;
    } else {
        // Autres joueurs (ou libéro sur le terrain) : grille de 4 boutons carrés
        const pointGridClass = "grid grid-cols-2 gap-2 mt-3 flex-grow"; 
        
        buttonsHtml = `
            <div class="${pointGridClass}">
                <button id="point-btn-${player.id}-service" class="${gridLayoutClass} ${colorClass}">
                    <span>Service</span>
                    <span class="point-count" id="point-count-${player.id}-service">${points.service}</span>
                </button>
                <button id="point-btn-${player.id}-attack" class="${gridLayoutClass} ${colorClass}">
                    <span>Attaque</span>
                    <span class="point-count" id="point-count-${player.id}-attack">${points.attack}</span>
                </button>
                <button id="point-btn-${player.id}-block" class="${gridLayoutClass} ${colorClass}">
                    <span>Bloc</span>
                    <span class="point-count" id="point-count-${player.id}-block">${points.block}</span>
                </button>
                <button id="point-btn-${player.id}-net" class="${gridLayoutClass} ${colorClass}">
                    <span>Autres</span>
                    <span class="point-count" id="point-count-${player.id}-net">${points.net}</span>
                </button>
            </div>`;
    }

    card.innerHTML = `
        <div class="font-bold cursor-pointer hover:text-blue-600 player-name-display" onclick="openSubstitutionModal(${player.id})">
            #${player.jerseyNumber || '-'} ${player.name}
        </div>
        ${buttonsHtml}
    `;
    return card;
}


/**
 * Crée la carte simple pour le suivi des POINTS d'un joueur.
 * @param {object} match - L'objet match actuel.
 * @param {object} player - L'objet joueur.
 * @returns {HTMLElement} L'élément div représentant la carte.
 */
function createPlayerCardLiveSimple_Points(match, player) {
    const card = document.createElement('div');
    const genderClass = player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100';
    card.className = `live-player-card ${genderClass}`;

    // Récupère les points ou initialise
    const points = (match.points && match.points[currentSet] && match.points[currentSet][player.id])
                 || { service: 0, attack: 0, block: 0, net: 0 };
    // Calcule le total des points
    const totalPoints = Object.values(points).reduce((a, b) => a + b, 0);

    // Classes CSS pour le bouton simple (vert)
   const simplePointBtnClass = "simple-point-btn flex-grow mt-3 text-4xl font-bold leading-none flex items-center justify-center aspect-square bg-green-500 hover:bg-green-600 border-green-500 text-white rounded-lg select-none";

    // Construction du HTML de la carte
    card.innerHTML = `
        <div class="font-bold cursor-pointer hover:text-blue-600 player-name-display" onclick="openSubstitutionModal(${player.id})">
            #${player.jerseyNumber || '-'} ${player.name}
        </div>
        <button id="point-btn-${player.id}-simple" class="${simplePointBtnClass}">
            <span id="point-count-${player.id}-simple">${totalPoints}</span>
        </button>
    `;
    return card;
}

/**
 * Met à jour le compteur de FAUTES pour un joueur donné.
 * @param {number} matchId - L'ID du match.
 * @param {number} playerId - L'ID du joueur.
 * @param {string} faultType - Le type de faute ('service', 'attack', 'reception', 'net').
 * @param {number} change - +1 pour incrémenter, -1 pour décrémenter.
 */
async function updateFault(matchId, playerId, faultType, change) {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return;
    const match = currentTeam.matches.find(m => m.id === matchId); if (!match) return;

    // Initialise les objets si nécessaire
    if (!match.faults) match.faults = {};
    if (!match.faults[currentSet]) match.faults[currentSet] = {};
    if (!match.faults[currentSet][playerId]) match.faults[currentSet][playerId] = { service: 0, attack: 0, reception: 0, net: 0 };

    const currentFaults = match.faults[currentSet][playerId];
    let currentCount = currentFaults[faultType] || 0;

    // Ne pas passer en négatif
    if (change < 0 && currentCount === 0) return;

    // Faire vibrer si on décrémente
    if (change < 0 && navigator.vibrate) navigator.vibrate(100);

    // Enregistrer l'action pour l'annulation UNIQUEMENT si c'est un ajout
    if (change > 0) {
        // Sauvegarde une copie profonde pour éviter les modifications par référence
        appData.lastFaultAction = JSON.parse(JSON.stringify({ matchId, playerId, faultType, set: currentSet }));
    }

    // Met à jour le compteur
    currentCount += change;
    currentFaults[faultType] = currentCount;

    // Sauvegarde les données (localStorage et Firestore)
    await saveData();

    // Met à jour l'affichage directement dans l'interface utilisateur
    const detailedCountSpan = document.getElementById(`fault-count-${playerId}-${faultType}`);
    if (detailedCountSpan) detailedCountSpan.textContent = currentCount;

    const simpleCountSpan = document.getElementById(`fault-count-${playerId}-simple`);
    if (simpleCountSpan) {
        const totalFaults = Object.values(currentFaults).reduce((a, b) => a + b, 0);
        simpleCountSpan.textContent = totalFaults;
    }

    // Met à jour le résumé des fautes/points
    renderSummary();
}

/**
 * Met à jour le compteur de POINTS pour un joueur donné.
 * @param {number} matchId - L'ID du match.
 * @param {number} playerId - L'ID du joueur.
 * @param {string} pointType - Le type de point ('service', 'attack', 'block', 'net').
 * @param {number} change - +1 pour incrémenter, -1 pour décrémenter.
 */
async function updatePoint(matchId, playerId, pointType, change) {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return;
    const match = currentTeam.matches.find(m => m.id === matchId); if (!match) return;

    // Initialise les objets si nécessaire
    if (!match.points) match.points = {};
    if (!match.points[currentSet]) match.points[currentSet] = {};
    if (!match.points[currentSet][playerId]) match.points[currentSet][playerId] = { service: 0, attack: 0, block: 0, net: 0 };

    const currentPoints = match.points[currentSet][playerId];
    let currentCount = currentPoints[pointType] || 0;

    // Ne pas passer en négatif
    if (change < 0 && currentCount === 0) return;

    // Faire vibrer si on décrémente
    if (change < 0) {
        if (navigator.vibrate) navigator.vibrate(100);
    }

    // Enregistrer l'action pour l'annulation UNIQUEMENT si c'est un ajout
    if (change > 0) {
        // Sauvegarde une copie profonde
        appData.lastPointAction = JSON.parse(JSON.stringify({ matchId, playerId, pointType, set: currentSet }));
    }

    // Met à jour le compteur
    currentCount += change;
    currentPoints[pointType] = currentCount;

    // Sauvegarde les données
    await saveData();

    // Met à jour l'affichage directement dans l'interface utilisateur
    const detailedCountSpan = document.getElementById(`point-count-${playerId}-${pointType}`);
    if (detailedCountSpan) detailedCountSpan.textContent = currentCount;

    const simpleCountSpan = document.getElementById(`point-count-${playerId}-simple`);
    if (simpleCountSpan) {
        const totalPoints = Object.values(currentPoints).reduce((a, b) => a + b, 0);
        simpleCountSpan.textContent = totalPoints;
    }

    // Met à jour le résumé des fautes/points
    renderSummary();
}

/**
 * Annule la dernière action enregistrée (faute ou point) en fonction du mode de suivi actuel.
 */
async function undoLastAction() {
    let actionToUndo = null; // Contiendra l'objet action { matchId, playerId, type, set }
    let isFault = false;     // Pour savoir quelle fonction update appeler

    // Détermine quelle action annuler en fonction du mode affiché
    if (currentTrackingMode === 'faults' && appData.lastFaultAction) {
        actionToUndo = JSON.parse(JSON.stringify(appData.lastFaultAction)); // Copie profonde
        isFault = true;
    } else if (currentTrackingMode === 'points' && appData.lastPointAction) {
        actionToUndo = JSON.parse(JSON.stringify(appData.lastPointAction)); // Copie profonde
        isFault = false;
    }

    // S'il n'y a rien à annuler pour ce mode
    if (!actionToUndo) {
        alert("Il n'y a pas de dernière action à annuler pour ce mode.");
        return;
    }

    // Extrait les informations de l'action
    const { matchId, playerId, set } = actionToUndo;
    // Récupère la bonne clé ('faultType' ou 'pointType')
    const type = isFault ? actionToUndo.faultType : actionToUndo.pointType;

    // Vérifie si on est sur le bon set
    if (set !== currentSet) {
        alert(`La dernière action (${isFault ? 'faute' : 'point'}) a été enregistrée sur le set ${set.replace('set','')}. Veuillez sélectionner ce set pour l'annuler.`);
        return;
    }

    // Efface l'action d'annulation AVANT de décrémenter
    // pour éviter qu'on puisse annuler plusieurs fois la même action
    if (isFault) {
        appData.lastFaultAction = null;
    } else {
        appData.lastPointAction = null;
    }
    await saveData(); // Sauvegarde l'état sans l'action d'annulation

    // Appelle la fonction de mise à jour appropriée pour décrémenter (-1)
    if (isFault) {
        await updateFault(matchId, playerId, type, -1);
    } else {
        await updatePoint(matchId, playerId, type, -1);
    }
    // Les fonctions updateFault/updatePoint appellent déjà saveData() et renderSummary()
}

/**
 * Affiche le résumé approprié (fautes ou points) en bas de l'onglet Suivi Match.
 */
function renderSummary() {
    if (currentTrackingMode === 'faults') {
        renderSetFaultsSummary();
    } else {
        renderSetPointsSummary();
    }
 }

/**
 * Calcule et affiche le résumé des FAUTES par set et pour le match entier.
 */
function renderSetFaultsSummary() {
    const summaryDiv = document.getElementById('set-faults-summary');
    const currentTeam = getCurrentTeam();
    const matchSelector = document.getElementById('matchSelector'); // Récupère l'élément select

    // --- AJOUT DE LA VÉRIFICATION ---
    // Si le sélecteur n'existe pas, ou si aucune valeur n'est sélectionnée, ou si pas d'équipe, on vide et on sort.
    if (!summaryDiv || !currentTeam || !matchSelector || !matchSelector.value) {
        if (summaryDiv) summaryDiv.innerHTML = '';
        return;
    }
    // --- FIN DE LA VÉRIFICATION ---

    const matchId = parseInt(matchSelector.value); // Maintenant, on sait que .value existe
    const match = currentTeam.matches.find(m => m.id === matchId);

    // Le reste de la fonction est inchangé...
    if (!match || !match.faults) { summaryDiv.innerHTML = ''; return; }

    let totalMatchFaults = 0;
    let summaryHtml = '<h4 class="text-lg font-semibold mb-2 text-center">Total Fautes Directes par Set</h4><div class="space-y-1">';

    SETS.forEach((setName, index) => {
        let setTotal = 0;
        if (match.faults[setName]) {
            Object.values(match.faults[setName]).forEach(playerFaults => {
                setTotal += Object.values(playerFaults).reduce((a, b) => a + b, 0);
            });
        }
        summaryHtml += `<p class="text-sm text-gray-700 text-center">Set ${index + 1}: <span class="font-bold text-lg text-red-600">${setTotal}</span></p>`;
        totalMatchFaults += setTotal;
    });

    summaryHtml += `</div><p class="text-md font-bold mt-3 border-t pt-2 text-center">Total Match: <span class="text-red-600">${totalMatchFaults}</span></p>`;
    summaryDiv.innerHTML = summaryHtml;
}

/**
 * Calcule et affiche le résumé des POINTS par set et pour le match entier.
 */
function renderSetPointsSummary() {
    const summaryDiv = document.getElementById('set-faults-summary'); // Réutilise le même div
    const currentTeam = getCurrentTeam();
    const matchSelector = document.getElementById('matchSelector'); // Récupère l'élément select

    // --- AJOUT DE LA VÉRIFICATION ---
    if (!summaryDiv || !currentTeam || !matchSelector || !matchSelector.value) {
        if (summaryDiv) summaryDiv.innerHTML = '';
        return;
    }
    // --- FIN DE LA VÉRIFICATION ---

    const matchId = parseInt(matchSelector.value); // Maintenant, on sait que .value existe
    const match = currentTeam.matches.find(m => m.id === matchId);

    // Le reste de la fonction est inchangé...
    if (!match || !match.points) { summaryDiv.innerHTML = ''; return; }

    let totalMatchPoints = 0;
    let summaryHtml = '<h4 class="text-lg font-semibold mb-2 text-center">Total Points Marqués par Set</h4><div class="space-y-1">';

    SETS.forEach((setName, index) => {
        let setTotal = 0;
        if (match.points[setName]) {
            Object.values(match.points[setName]).forEach(playerPoints => {
                setTotal += Object.values(playerPoints).reduce((a, b) => a + b, 0);
            });
        }
        summaryHtml += `<p class="text-sm text-gray-700 text-center">Set ${index + 1}: <span class="font-bold text-lg text-green-600">${setTotal}</span></p>`;
        totalMatchPoints += setTotal;
    });

    summaryHtml += `</div><p class="text-md font-bold mt-3 border-t pt-2 text-center">Total Match: <span class="text-green-600">${totalMatchPoints}</span></p>`;
    summaryDiv.innerHTML = summaryHtml;
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
