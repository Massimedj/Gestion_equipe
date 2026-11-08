// ========================================================================
// Contenu pour : src/coach/shared/ui.js
// Ouverture / fermeture des fenêtres, protection des textes affichés (escapeHtml).
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam } from '../pages/effectif.js';

// --- Début du code déplacé ---


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

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { closeModal, escapeHtml };

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.openAddPlayerModal = openAddPlayerModal;
window.openAddMatchModal = openAddMatchModal;
window.openAddTeamModal = openAddTeamModal;
window.openEditTeamModal = openEditTeamModal;
window.closeModal = closeModal;
window.openInfoLiveModal = openInfoLiveModal;
window.toggleAttendanceList = toggleAttendanceList;
