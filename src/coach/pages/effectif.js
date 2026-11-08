// ========================================================================
// Contenu pour : src/coach/pages/effectif.js
// Onglet Effectif : équipes, joueurs, modèle et import Excel des joueurs.
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { renderAttendanceForSelectedMatch } from './rencontres.js';
import { renderStats } from './statistiques.js';
import { recalculatePlayedStatus, renderCourt } from './terrain.js';
import { renderAllForCurrentTeam } from '../script.js';
import { saveData } from '../shared/auth.js';
import { POSITIONS, SETS } from '../shared/etat.js';
import { closeModal } from '../shared/ui.js';
import { showAlert, showConfirm } from '../shared/dialog.js';

// --- Début du code déplacé ---

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
        showAlert("Veuillez entrer un nom d'équipe.");
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
         showAlert("Le nom de l'équipe ne peut pas être vide.");
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
    if (await showConfirm(`Êtes-vous sûr de vouloir supprimer l'équipe "${currentTeam.name}" (${currentTeam.season || 'sans saison'}) ?\n\nATTENTION : Cette action est irréversible et supprimera tous les joueurs, matchs et statistiques associés à cette équipe.`, { title: "Supprimer l'équipe ?", confirmText: 'Supprimer', danger: true })) {
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

    if (!name) { showAlert('Le nom du joueur est requis.'); return; }

    if (currentTeam.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showAlert('Un joueur avec ce nom existe déjà.'); return;
    }
    if (jerseyNumber && currentTeam.players.some(p => p.jerseyNumber === jerseyNumber)) {
        showAlert('Ce numéro de maillot est déjà pris.'); return;
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

    if (!newName) { showAlert('Le nom du joueur ne peut pas être vide.'); return; }

    // Check for duplicate name (excluding the player being edited)
    if (currentTeam.players.some(p => p.id !== playerId && p.name.toLowerCase() === newName.toLowerCase())) {
        showAlert('Un autre joueur a déjà ce nom.'); return;
    }
     // Check for duplicate jersey number (excluding the player being edited)
    if (newJersey && currentTeam.players.some(p => p.id !== playerId && p.jerseyNumber === newJersey)) {
        showAlert('Ce numéro de maillot est déjà pris par un autre joueur.'); return;
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

    if (await showConfirm(`Voulez-vous vraiment supprimer ${playerToDelete.name} ? Il sera retiré de l'effectif et de tous les matchs.`, { title: 'Supprimer le joueur ?', confirmText: 'Supprimer', danger: true })) {
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
    if (await showConfirm("Êtes-vous sûr de vouloir supprimer TOUS les joueurs ? Cette action est irréversible et les retirera de tous les matchs.", { title: 'Supprimer tous les joueurs ?', confirmText: 'Tout supprimer', danger: true })) {
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
                showAlert("Le fichier semble vide.");
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
                showAlert(`${addedCount} joueur(s) importé(s) avec succès !` + (duplicateCount > 0 ? `\n(${duplicateCount} ignorés car déjà existants)` : ""));
            } else {
                showAlert("Aucun nouveau joueur n'a été importé (doublons ou format incorrect).");
            }

        } catch (error) {
            console.error("Erreur lors de l'importation:", error);
            showAlert("Erreur lors de la lecture du fichier Excel. Vérifiez le format.");
        } finally {
            // Reset l'input pour permettre de réimporter le même fichier si besoin
            event.target.value = ''; 
        }
    };

    reader.readAsArrayBuffer(file);
}
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { getCurrentTeam, switchTeam, renderTeamSelector, renderPlayerList };

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.addTeam = addTeam;
window.saveTeamChanges = saveTeamChanges;
window.deleteCurrentTeam = deleteCurrentTeam;
window.addPlayer = addPlayer;
window.openEditPlayerModal = openEditPlayerModal;
window.savePlayerChanges = savePlayerChanges;
window.deletePlayer = deletePlayer;
window.deleteAllPlayers = deleteAllPlayers;
window.downloadPlayerTemplate = downloadPlayerTemplate;
window.triggerImportPlayers = triggerImportPlayers;
window.handlePlayerImport = handlePlayerImport;
