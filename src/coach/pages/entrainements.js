// ========================================================================
// Contenu pour : src/coach/pages/entrainements.js
// Onglet Entraînements : séances et présences.
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam } from './effectif.js';
import { saveData } from '../shared/auth.js';
import { closeModal } from '../shared/ui.js';
import { showAlert, showConfirm } from '../shared/dialog.js';

// --- Début du code déplacé ---

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
        showAlert("Veuillez sélectionner une date.");
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
        showAlert("Erreur : Séance introuvable.");
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

    if (await showConfirm(`Êtes-vous sûr de vouloir supprimer la séance du ${session.date} ?`, { title: 'Supprimer la séance ?', confirmText: 'Supprimer', danger: true })) {
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
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { renderTrainingList };

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.openAddTrainingModal = openAddTrainingModal;
window.addTrainingSession = addTrainingSession;
window.saveTrainingChanges = saveTrainingChanges;
window.deleteTrainingSession = deleteTrainingSession;
window.duplicateTrainingSession = duplicateTrainingSession;
