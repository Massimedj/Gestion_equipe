// ========================================================================
// Contenu pour : src/coach/pages/statistiques.js
// Onglet Statistiques : tableaux joueurs / équipe, filtres, export Excel.
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam } from './effectif.js';
import { formatMatchTitle } from './rencontres.js';
import { EVAL_LEGEND, EVAL_LEVELS, collectEvalCounts, getStatColumns } from './suivi.js';
import { SETS } from '../shared/etat.js';
import { closeModal, escapeHtml } from '../shared/ui.js';
import { showAlert } from '../shared/dialog.js';

// --- Début du code déplacé ---


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
        showAlert("Aucune statistique à exporter.");
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
// Coefficient "pour / contre" au format FFVB : 3 décimales avec un point (ex. 1.500). Vide si "pour" ou "contre" vaut 0.
function formatCoeff(pour, contre) {
    if (!pour || !contre) return '';
    return (pour / contre).toFixed(3);
}

function renderTeamStats() {
    const currentTeam = getCurrentTeam();
    const statsRow = document.getElementById('teamStatsRow');
    if (!statsRow) {
        console.error("Élément 'teamStatsRow' introuvable.");
        return;
    }
    statsRow.innerHTML = '';

    if (!currentTeam || !currentTeam.matches || currentTeam.matches.length === 0) {
        statsRow.innerHTML = `<td colspan="17" class="p-4 text-center text-gray-500">Aucun match enregistré.</td>`;
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
        points: 0, joues: 0, gagnes: 0, perdus: 0, forfaits: 0,
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
            stats.perdus++; stats.p03++; stats.forfaits++;
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
         statsRow.innerHTML = `<td colspan="17" class="p-4 text-center text-gray-500">Aucun match joué pour le moment.</td>`;
    } else {
        console.log("renderTeamStats (Nouvelle Approche - Filtre Corrigé): Valeur finale avant affichage:", actuallyPlayedCount);
        statsRow.innerHTML = `
            <td class="p-2 font-bold">${stats.points}</td>
            <td class="p-2">${actuallyPlayedCount || ''}</td>
            <td class="p-2">${stats.gagnes || ''}</td>
            <td class="p-2">${stats.perdus || ''}</td>
            <td class="p-2">${stats.forfaits || ''}</td>
            <td class="p-2">${stats.g30 || ''}</td>
            <td class="p-2">${stats.g31 || ''}</td>
            <td class="p-2">${stats.g32 || ''}</td>
            <td class="p-2">${stats.p23 || ''}</td>
            <td class="p-2">${stats.p13 || ''}</td>
            <td class="p-2">${stats.p03 || ''}</td>
            <td class="p-2">${stats.setsPour || ''}</td>
            <td class="p-2">${stats.setsContre || ''}</td>
            <td class="p-2">${formatCoeff(stats.setsPour, stats.setsContre)}</td>
            <td class="p-2">${stats.ptsPour || ''}</td>
            <td class="p-2">${stats.ptsContre || ''}</td>
            <td class="p-2">${formatCoeff(stats.ptsPour, stats.ptsContre)}</td>
        `;
    }
}

// Filtres des statistiques : null = tout afficher
let statsMatchIds = null; // ID des matchs à inclure
let statsSetNames = null; // noms des sets à inclure ('set1'...'set5'), pour tous les matchs
// Remet le filtre à « tout afficher » (appelée par showMainTab, qui est dans un autre fichier :
// un module ne peut pas modifier directement les variables d'un autre module).
function resetStatsFilter() { statsMatchIds = null; statsSetNames = null; }

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
        const matchLabel = formatMatchTitle(match).replace(/^Match du /, ''); // Réutilise la fonction de formatage, sans le préfixe "Match du"
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
        showAlert("Veuillez sélectionner au moins un match pour afficher les statistiques.");
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
        showAlert("Veuillez sélectionner au moins un set pour afficher les statistiques.");
        return;
    }

    statsSetNames = selected.length === boxes.length ? null : selected;
    renderPlayerStats();
    closeModal('statsSetFilterModal');
}
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { renderStats, renderPlayerStats, renderTeamStats, resetStatsFilter };

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.exportStatsToExcel = exportStatsToExcel;
window.selectAllStatsMatches = selectAllStatsMatches;
window.applyStatsFilter = applyStatsFilter;
window.openStatsFilterModal = openStatsFilterModal;
window.openStatsSetFilterModal = openStatsSetFilterModal;
window.selectAllStatsSets = selectAllStatsSets;
window.applyStatsSetFilter = applyStatsSetFilter;
