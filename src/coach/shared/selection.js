// ========================================================================
// Contenu pour : src/coach/shared/selection.js
// Fenêtres de choix (équipe, match, poste sur le terrain).
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam } from '../pages/effectif.js';
import { renderMatchSelector } from '../pages/rencontres.js';
import { currentSet, updatePosition } from '../pages/terrain.js';
import { closeModal } from './ui.js';

// --- Début du code déplacé ---


/** Ouvre / ferme le menu de l'équipe (bandeau du haut) : changer, ajouter, modifier, supprimer. */
function toggleTeamMenu() {
    const menu = document.getElementById('team-menu');
    if (!menu) return;
    if (!menu.classList.contains('hidden')) { closeTeamMenu(); return; }

    const selector = document.getElementById('teamSelector');
    const currentId = window.appData ? String(window.appData.currentTeamId) : '';
    menu.innerHTML = '';

    const addItem = (text, className, onClick) => {
        const button = document.createElement('button');
        button.className = 'w-full text-left px-3 py-2 rounded-lg transition ' + className;
        button.textContent = text;
        button.onclick = () => { closeTeamMenu(); onClick(); };
        menu.appendChild(button);
    };

    Array.from(selector.options).forEach(option => {
        if (!option.value) return; // Ignore le placeholder
        const isCurrent = option.value === currentId;
        addItem((isCurrent ? '✓ ' : '') + option.textContent,
            isCurrent ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-100',
            () => selectTeamFromMenu(option.value));
    });

    if (menu.children.length > 0) {
        const separator = document.createElement('hr');
        separator.className = 'my-2';
        menu.appendChild(separator);
    }
    addItem('+ Ajouter une équipe', 'text-indigo-600 font-semibold hover:bg-indigo-50', () => openAddTeamModal());
    if (getCurrentTeam()) {
        addItem('Modifier cette équipe', 'text-yellow-700 font-semibold hover:bg-yellow-50', () => openEditTeamModal());
        addItem('Supprimer cette équipe', 'text-red-600 font-semibold hover:bg-red-50', () => deleteCurrentTeam());
    }

    menu.classList.remove('hidden');
    document.getElementById('teamSelectButton')?.setAttribute('aria-expanded', 'true');
}

function closeTeamMenu() {
    document.getElementById('team-menu')?.classList.add('hidden');
    document.getElementById('teamSelectButton')?.setAttribute('aria-expanded', 'false');
}

// Ferme le menu d'un clic à côté ou avec Échap
document.addEventListener('click', (e) => {
    if (!e.target.closest('#team-menu') && !e.target.closest('#teamSelectButton')) closeTeamMenu();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTeamMenu();
});

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

/** Gère le choix d'une équipe dans le menu du bandeau */
function selectTeamFromMenu(teamId) {
    const selector = document.getElementById('teamSelector');
    selector.value = teamId;
    // Déclenche manuellement l'événement 'change'
    selector.dispatchEvent(new Event('change'));
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
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { openPositionSelectModal };

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.toggleTeamMenu = toggleTeamMenu;
window.openMatchSelectModal = openMatchSelectModal;
