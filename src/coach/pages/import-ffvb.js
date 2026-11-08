// ========================================================================
// Contenu pour : src/coach/pages/import-ffvb.js
// Import des rencontres depuis le calendrier FFVB.
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam } from './effectif.js';
import { renderMatchSelector } from './rencontres.js';
import { saveData } from '../shared/auth.js';
import { closeModal, escapeHtml } from '../shared/ui.js';
import { showAlert } from '../shared/dialog.js';

// --- Début du code déplacé ---

// ============================
// IMPORT DES RENCONTRES DEPUIS LA FFVB
// ============================
let ffvbCalendar = []; // [{ code, date (AAAA-MM-JJ), time, home, away }]
// Le site FFVB refuse la lecture directe par le navigateur : on passe par notre fonction Firebase (dossier functions/).
const FFVB_RELAYS = [
    u => 'https://europe-west1-assistant-coach-volley.cloudfunctions.net/ffvbCalendar?url=' + encodeURIComponent(u)
];

function openImportFfvbModal() {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return;
    closeModal('addMatchModal');
    document.getElementById('ffvbUrl').value = currentTeam.rankingUrl || '';
    document.getElementById('ffvbStatus').textContent = '';
    document.getElementById('ffvbStep2').classList.add('hidden');
    document.getElementById('ffvbFileInput').value = '';
    ffvbCalendar = [];
    document.getElementById('importFfvbModal').classList.remove('hidden');
}

function setFfvbStatus(text, isError) {
    const el = document.getElementById('ffvbStatus');
    el.textContent = text; el.className = 'text-sm mt-2 ' + (isError ? 'text-red-600' : 'text-gray-600');
}

// Lit la page HTML du calendrier FFVB (une ligne = un match)
function parseFfvbHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const byCode = new Map();
    doc.querySelectorAll('tr').forEach(tr => {
        const c = [...tr.children].filter(e => e.tagName === 'TD').map(td => td.textContent.trim());
        const d = /^(\d\d)\/(\d\d)\/(\d\d)$/.exec(c[1] || '');
        if (c.length < 6 || !d || !/^[A-Z0-9]+$/.test(c[0]) || !c[3] || !c[5]) return;
        byCode.set(c[0], { code: c[0], date: `20${d[3]}-${d[2]}-${d[1]}`, time: c[2], home: c[3], away: c[5] });
    });
    return [...byCode.values()];
}

// Lit le fichier CSV d'export du calendrier FFVB
function parseFfvbCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const h = (lines.shift() || '').split(';').map(s => s.trim());
    const i = n => h.indexOf(n);
    if ([i('Match'), i('Date'), i('EQA_nom'), i('EQB_nom')].some(x => x < 0)) return [];
    return lines.map(l => l.split(';')).filter(c => /^\d{4}-\d\d-\d\d$/.test(c[i('Date')] || ''))
        .map(c => ({ code: c[i('Match')], date: c[i('Date')], time: c[i('Heure')] || '', home: c[i('EQA_nom')].trim(), away: c[i('EQB_nom')].trim() }));
}

async function fetchFfvbCalendar() {
    let url = document.getElementById('ffvbUrl').value.trim();
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    if (!/^https:\/\/(www\.)?ffvbbeach\.org\//.test(url)) { setFfvbStatus("L'adresse doit être un calendrier du site ffvbbeach.org.", true); return; }
    setFfvbStatus('Récupération du calendrier…', false);
    for (const relay of FFVB_RELAYS) {
        try {
            const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
            const res = await fetch(relay(url), { signal: ctrl.signal }); clearTimeout(timer);
            if (!res.ok) continue;
            const list = parseFfvbHtml(new TextDecoder('windows-1252').decode(await res.arrayBuffer()));
            if (list.length) { showFfvbTeamStep(list); return; }
        } catch (e) { /* on essaie le relais suivant */ }
    }
    setFfvbStatus("Impossible de récupérer le calendrier automatiquement (service relais indisponible ou aucun match trouvé). Réessayez plus tard, ou importez le fichier CSV d'export de la FFVB (bouton ci-dessous).", true);
}

async function loadFfvbCsvFile(input) {
    const file = input.files[0]; if (!file) return;
    const list = parseFfvbCsv(new TextDecoder('windows-1252').decode(await file.arrayBuffer()));
    if (!list.length) { setFfvbStatus("Fichier non reconnu : utilisez le fichier CSV exporté depuis le calendrier FFVB (icône Excel).", true); return; }
    showFfvbTeamStep(list);
}

// Étape 2 : l'utilisateur choisit son équipe parmi celles du calendrier
function showFfvbTeamStep(list) {
    const currentTeam = getCurrentTeam();
    ffvbCalendar = list;
    const teams = [...new Set(list.flatMap(m => [m.home, m.away]))].sort((a, b) => a.localeCompare(b, 'fr'));
    const select = document.getElementById('ffvbTeamSelect');
    select.innerHTML = '<option value="">— Choisissez votre équipe —</option>' + teams.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const guess = teams.find(t => t === currentTeam.ffvbTeamName) || teams.find(t => norm(currentTeam.name) && norm(t) === norm(currentTeam.name));
    if (guess) select.value = guess;
    setFfvbStatus(`${list.length} rencontres trouvées dans le calendrier.`, false);
    document.getElementById('ffvbStep2').classList.remove('hidden');
    renderFfvbMatchList();
}

function ffvbOpponentMatches(m, team) { return m.home === team ? { opponent: m.away, location: 'domicile' } : { opponent: m.home, location: 'exterieur' }; }

function renderFfvbMatchList() {
    const currentTeam = getCurrentTeam(); const team = document.getElementById('ffvbTeamSelect').value;
    const box = document.getElementById('ffvbMatchList'); const btn = document.getElementById('ffvbImportButton');
    if (!team) { box.innerHTML = ''; btn.disabled = true; return; }
    const existing = currentTeam.matches || [];
    const mine = ffvbCalendar.filter(m => m.home === team || m.away === team).sort((a, b) => a.date.localeCompare(b.date));
    box.innerHTML = mine.map(m => {
        const o = ffvbOpponentMatches(m, team);
        const already = existing.some(e => e.ffvbCode === m.code || (e.date === m.date && (e.opponent || '').toLowerCase() === o.opponent.toLowerCase()));
        const label = `${new Date(m.date.replace(/-/g, '/')).toLocaleDateString('fr-FR')}${m.time ? ' ' + m.time : ''} — vs ${o.opponent} (${o.location === 'domicile' ? 'Dom.' : 'Ext.'})`;
        return `<label class="flex items-center gap-2 p-2 rounded ${already ? 'text-gray-400' : 'hover:bg-gray-50'}"><input type="checkbox" value="${escapeHtml(m.code)}" ${already ? 'disabled' : 'checked'} onchange="updateFfvbImportButton()"><span>${escapeHtml(label)}${already ? ' (déjà ajoutée)' : ''}</span></label>`;
    }).join('') || '<p class="text-sm text-gray-500 p-2">Aucune rencontre pour cette équipe.</p>';
    updateFfvbImportButton();
}

function updateFfvbImportButton() {
    document.getElementById('ffvbImportButton').disabled = !document.querySelectorAll('#ffvbMatchList input:checked').length;
}

async function importFfvbMatches() {
    const currentTeam = getCurrentTeam(); if (!currentTeam) return;
    const team = document.getElementById('ffvbTeamSelect').value; if (!team) return;
    const codes = new Set([...document.querySelectorAll('#ffvbMatchList input:checked')].map(i => i.value));
    const allPlayerIds = currentTeam.players ? currentTeam.players.map(p => p.id) : [];
    if (!currentTeam.matches) currentTeam.matches = [];
    let n = 0;
    ffvbCalendar.filter(m => codes.has(m.code)).forEach((m, idx) => {
        const o = ffvbOpponentMatches(m, team);
        currentTeam.matches.push({ id: Date.now() + idx, ffvbCode: m.code, date: m.date, opponent: o.opponent, location: o.location, present: [...allPlayerIds], played: [], captainId: null, score: { myTeam: '', opponent: '', sets: Array(5).fill(null).map(() => ({ myTeam: '', opponent: '' })) }, substitutions: {}, faults: {}, points: {}, detailMode: true, forfeitStatus: 'none' });
        n++;
    });
    currentTeam.ffvbTeamName = team;
    await saveData(); renderMatchSelector(); closeModal('importFfvbModal');
    showAlert(`${n} rencontre(s) ajoutée(s).`);
}
// --- Fin du code déplacé ---

// --- Expose pour les boutons de la page (attributs onclick="..." etc.) ---
window.openImportFfvbModal = openImportFfvbModal;
window.fetchFfvbCalendar = fetchFfvbCalendar;
window.loadFfvbCsvFile = loadFfvbCsvFile;
window.renderFfvbMatchList = renderFfvbMatchList;
window.updateFfvbImportButton = updateFfvbImportButton;
window.importFfvbMatches = importFfvbMatches;
