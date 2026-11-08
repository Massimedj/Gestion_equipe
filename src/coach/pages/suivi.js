// ========================================================================
// Contenu pour : src/coach/pages/suivi.js
// Onglet Suivi : notation des critères en direct, personnalisation des critères.
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam } from './effectif.js';
import { formatMatchTitle } from './rencontres.js';
import { renderPlayerStats } from './statistiques.js';
import { currentSet, renderSetSelector } from './terrain.js';
import { saveData } from '../shared/auth.js';
import { POSITIONS } from '../shared/etat.js';
import { closeModal, escapeHtml } from '../shared/ui.js';
import { showAlert } from '../shared/dialog.js';

// --- Début du code déplacé ---

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
            ${escapeHtml(player.jerseyNumber) || '-'} ${escapeHtml(player.name)}
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
    document.getElementById('ratingModalSubtitle').textContent = `${player.jerseyNumber || '-'} ${player.name} — Set ${currentSet.replace('set', '')}`;
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
        showAlert("Il n'y a pas de dernière action à annuler.");
        return;
    }
    if (action.set !== currentSet) {
        showAlert(`La dernière action a été enregistrée sur le set ${action.set.replace('set','')}. Veuillez sélectionner ce set pour l'annuler.`);
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
        courtLayout.innerHTML = `<p class="text-gray-500 col-span-full text-center">Définissez la composition dans l'onglet "Matchs" pour commencer le suivi.</p>`;
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
    if (criteriaDraft.length <= 1) return showAlert('Il faut garder au moins un critère.');
    criteriaDraft.splice(index, 1);
    renderCriteriaModal();
}

async function saveCriteria() {
    const team = getCurrentTeam();
    if (!team || !criteriaDraft) return;
    const cleaned = criteriaDraft.map(c => ({ id: c.id, label: c.label.trim(), color: c.color, positions: c.positions || [] }));
    if (cleaned.some(c => !c.label)) return showAlert('Chaque critère doit avoir un nom.');
    const names = cleaned.map(c => c.label.toLowerCase());
    if (new Set(names).size !== names.length) return showAlert('Deux critères ont le même nom.');

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
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { EVAL_LEVELS, EVAL_LEGEND, getStatColumns, collectEvalCounts, renderLiveTrackingView };

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.openRatingModal = openRatingModal;
window.rateCriterion = rateCriterion;
window.openCriteriaModal = openCriteriaModal;
window.toggleCriterionPosition = toggleCriterionPosition;
window.addCriterionDraft = addCriterionDraft;
window.moveCriterion = moveCriterion;
window.removeCriterionDraft = removeCriterionDraft;
window.saveCriteria = saveCriteria;
Object.defineProperty(window, 'criteriaDraft', { get: () => criteriaDraft }); // variable lue par un attribut oninput="..."
