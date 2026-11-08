// ========================================================================
// Contenu pour : src/coach/shared/presentation.js
// Fenêtre de présentation de l'application (bouton « i » du bandeau).
// Elle s'ouvre toute seule à la toute première visite sur ce navigateur ;
// ensuite, seulement quand on clique sur le bouton « i ».
// ========================================================================

const PRESENTATION_SEEN_KEY = 'presentationVue';

function openPresentation() {
    const modal = document.getElementById('presentationModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.firstElementChild.scrollTop = 0; // on repart toujours du haut
    try { localStorage.setItem(PRESENTATION_SEEN_KEY, '1'); } catch (e) { /* stockage indisponible : pas grave */ }
}

function closePresentation() {
    document.getElementById('presentationModal')?.classList.add('hidden');
}

// Échap ferme la présentation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('presentationModal')?.classList.contains('hidden')) closePresentation();
});

// Première visite : ouverture automatique
let alreadySeen = true;
try { alreadySeen = localStorage.getItem(PRESENTATION_SEEN_KEY) === '1'; } catch (e) { /* stockage indisponible : on ne l'impose pas */ }
if (!alreadySeen) openPresentation();

// --- Expose pour les boutons de la page (attributs onclick="...") ---
window.openPresentation = openPresentation;
window.closePresentation = closePresentation;
