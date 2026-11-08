// ========================================================================
// Contenu pour : src/coach/pages/rencontres.js
// Onglet Matchs : rencontres, feuille de match (présences, capitaine), score.
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam } from './effectif.js';
import { renderResults } from './resultats.js';
import { renderStats } from './statistiques.js';
import { renderLiveTrackingView } from './suivi.js';
import { recalculatePlayedStatus, renderCourt, renderSubstitutions } from './terrain.js';
import { saveData } from '../shared/auth.js';
import { SETS } from '../shared/etat.js';
import { closeModal } from '../shared/ui.js';
import { showAlert, showConfirm } from '../shared/dialog.js';

// --- Début du code déplacé ---

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
    } else { showAlert('Veuillez sélectionner une date et un adversaire.'); }
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
        showAlert("Veuillez d'abord sélectionner un match.");
        return;
    }

    const matchId = parseInt(matchIdInput.value);
    const match = currentTeam.matches.find(m => m.id === matchId);
    if (!match) {
        showAlert("Erreur : Impossible de trouver le match sélectionné.");
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
    if (!newDate || !newOpponent) { showAlert('Veuillez renseigner la date et le nom de l\'adversaire.'); return; }
    match.date = newDate; match.opponent = newOpponent; match.location = newLocation;
    await saveData(); renderMatchSelector(); const selector = document.getElementById('matchSelector'); if (selector.value != matchId) { selector.value = matchId; selector.dispatchEvent(new Event('change')); } else { renderAttendanceForSelectedMatch(); renderLiveTrackingView(); } closeModal('editMatchModal');
}

async function deleteSelectedMatch() {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return; const matchId = parseInt(document.getElementById('matchSelector').value); const matchToDelete = currentTeam.matches.find(m => m.id === matchId); if (!matchToDelete) return;
    if (await showConfirm(`Voulez-vous vraiment supprimer le match contre ${matchToDelete.opponent} du ${new Date(matchToDelete.date.replace(/-/g, '/')).toLocaleDateString('fr-FR')} ?`, { title: 'Supprimer le match ?', confirmText: 'Supprimer', danger: true })) {
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

/**
 * Ferme le tiroir de présence (si ouvert).
 */
function collapseAttendanceDrawer() {
    const drawer = document.getElementById('attendance-drawer');
    if (drawer && drawer.open) {
        drawer.open = false;
    }
}
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { formatMatchTitle, renderMatchSelector, renderAttendanceForSelectedMatch };

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.createMatch = createMatch;
window.openEditMatchModal = openEditMatchModal;
window.saveMatchChanges = saveMatchChanges;
window.deleteSelectedMatch = deleteSelectedMatch;
window.updateCaptain = updateCaptain;
window.setForfeit = setForfeit;
window.updatePresence = updatePresence;
window.collapseAttendanceDrawer = collapseAttendanceDrawer;
