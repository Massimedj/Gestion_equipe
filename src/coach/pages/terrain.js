// ========================================================================
// Contenu pour : src/coach/pages/terrain.js
// Composition sur le terrain (set en cours, rotations, remplacements).
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam } from './effectif.js';
import { renderAttendanceForSelectedMatch } from './rencontres.js';
import { renderLiveTrackingView } from './suivi.js';
import { saveData } from '../shared/auth.js';
import { SETS } from '../shared/etat.js';
import { openPositionSelectModal } from '../shared/selection.js';
import { closeModal } from '../shared/ui.js';
import { showAlert, showConfirm } from '../shared/dialog.js';

// --- Début du code déplacé ---

// Structure de données principale, chargée depuis localStorage au démarrage

let currentSet = 'set1';



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
            button.className = `set-button flex-1 py-2 px-1 sm:px-4 text-sm font-semibold rounded-md ${currentSet === setName ? 'active bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`; // Added base styles
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
        button.className = 'player-select-button w-full p-2 rounded border text-left break-words leading-tight text-xs';
        
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

    if (!await showConfirm(`Voulez-vous vraiment vider toute la composition du ${currentSet.replace('set', 'Set ')} ?`, { title: 'Vider la composition ?', confirmText: 'Vider', danger: true })) {
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
         showAlert("Erreur: Impossible de trouver la composition du set.");
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
            showAlert("Erreur: Seul un autre libéro peut remplacer le libéro.");
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
        showAlert("Erreur : Le joueur à remplacer n'a pas été trouvé sur le terrain ou comme libéro.");
    }
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
        showAlert("La composition est vide.");
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
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { currentSet, selectSet, renderSetSelector, renderCourt, updatePosition, renderSubstitutions, recalculatePlayedStatus };

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.updatePosition = updatePosition;
window.clearCurrentSetComposition = clearCurrentSetComposition;
window.openSubstitutionModal = openSubstitutionModal;
window.rotateCourt = rotateCourt;
