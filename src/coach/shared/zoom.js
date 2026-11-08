// ========================================================================
// Contenu pour : src/coach/shared/zoom.js
// Boutons de zoom (+ / −) : agrandit ou réduit la taille de base du texte de
// la page. Tailwind exprime tailles, marges et largeurs à partir de cette
// taille de base, donc presque tout l'affichage suit.
// Le niveau choisi est mémorisé dans le navigateur (localStorage).
// ========================================================================

const ZOOM_LEVELS = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4]; // de 80 % à 140 %, par pas de 10 %
const ZOOM_STORAGE_KEY = 'zoomLevel';

let zoomIndex = ZOOM_LEVELS.indexOf(1);
try {
    const saved = ZOOM_LEVELS.indexOf(parseFloat(localStorage.getItem(ZOOM_STORAGE_KEY)));
    if (saved !== -1) zoomIndex = saved;
} catch (e) { /* stockage indisponible : on garde 100 % */ }

function applyZoom() {
    const level = ZOOM_LEVELS[zoomIndex];
    document.documentElement.style.fontSize = `${Math.round(level * 100)}%`;
    // Le bandeau du haut garde la même taille quel que soit le zoom (comme la barre du bas)
    const banner = document.getElementById('app-banner');
    if (banner) banner.style.zoom = String(1 / level);
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn) zoomInBtn.disabled = zoomIndex === ZOOM_LEVELS.length - 1;
    if (zoomOutBtn) zoomOutBtn.disabled = zoomIndex === 0;
    try { localStorage.setItem(ZOOM_STORAGE_KEY, String(level)); } catch (e) { /* pas grave */ }
}

function zoomIn() {
    if (zoomIndex < ZOOM_LEVELS.length - 1) { zoomIndex++; applyZoom(); }
}

function zoomOut() {
    if (zoomIndex > 0) { zoomIndex--; applyZoom(); }
}

applyZoom();

// --- Expose pour les boutons de la page (attributs onclick="...") ---
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
