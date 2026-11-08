// ========================================================================
// Contenu pour : src/coach/script.js
// Point d'entrée de l'application : démarrage, navigation entre les onglets,
// rafraîchissement général de l'écran.
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam, renderPlayerList, renderTeamSelector, switchTeam } from './pages/effectif.js';
import { renderTrainingList } from './pages/entrainements.js';
import './pages/import-ffvb.js';
import { renderAttendanceForSelectedMatch, renderMatchSelector } from './pages/rencontres.js';
import { renderResults } from './pages/resultats.js';
import { renderPlayerStats, renderTeamStats, resetStatsFilter } from './pages/statistiques.js';
import { renderLiveTrackingView } from './pages/suivi.js';
import { renderSetSelector, selectSet } from './pages/terrain.js';
import { initializeApp } from './shared/auth.js';
import { POSITIONS } from './shared/etat.js';
import './shared/presentation.js';
import './shared/selection.js';
import './shared/ui.js';
import './shared/zoom.js';
import { releaseWakeLock, requestWakeLock } from './shared/veille-ecran.js';
import { showAlert } from './shared/dialog.js';
import { VERSION } from '../shared/version.js';

document.getElementById('app-version').textContent = VERSION;

// --- Début du code déplacé ---
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
        showAlert("Erreur de chargement de l'application (auth.js).");
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
            tabButton.classList.remove('bg-white', 'text-blue-700', 'shadow');
            tabButton.classList.add('text-blue-100', 'hover:bg-blue-500', 'hover:text-white');
            tabButton.removeAttribute('aria-current');
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
        button.classList.add('bg-white', 'text-blue-700', 'shadow');
        button.classList.remove('text-blue-100', 'hover:bg-blue-500', 'hover:text-white');
        button.setAttribute('aria-current', 'page');
    }

    // Rafraîchit les données spécifiques à l'onglet qui vient d'être affiché
    if (tabName === 'stats') {
        // L'onglet Stats n'affiche plus que les stats joueurs       
		resetStatsFilter(); // remet le filtre à « tout afficher » (fonction dans pages/statistiques.js)
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
    document.getElementById('no-team-hint')?.classList.toggle('hidden', teamExists); // Invitation à créer une équipe

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


console.log("Main script loaded. Waiting for DOMContentLoaded and Firebase ready.");
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { renderAllForCurrentTeam };

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.showMainTab = showMainTab;
