// ========================================================================
// Contenu pour : src/coach/shared/veille-ecran.js
// Empêche la mise en veille de l'écran pendant le suivi de match.
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

// --- Début du code déplacé ---


// ============================
// GESTION DU VERROUILLAGE ÉCRAN (Screen Wake Lock API)
// ============================

let wakeLock = null; // Variable pour garder une référence au verrou

/**
 * Demande un verrou pour empêcher la mise en veille de l'écran.
 */
const requestWakeLock = async () => {
  // Vérifie si l'API est supportée par le navigateur
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      
      // Écoute si le verrou est libéré par le système
      wakeLock.addEventListener('release', () => {
        console.log('Screen Wake Lock a été libéré par le système.');
        wakeLock = null; // Réinitialise la variable
      });
      
      console.log('Screen Wake Lock activé.');
    } catch (err) {
      // L'erreur peut survenir si le document n'est pas visible, etc.
      console.error(`${err.name}, ${err.message}`);
      wakeLock = null; // Assure que wakeLock est null en cas d'erreur
    }
  } else {
    console.warn("L'API Screen Wake Lock n'est pas supportée par ce navigateur.");
  }
};

/**
 * Libère le verrou d'écran s'il est actif.
 */
const releaseWakeLock = async () => {
  if (wakeLock !== null) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('Screen Wake Lock libéré manuellement.');
    } catch (err) {
      console.error(`Erreur lors de la libération du Wake Lock: ${err.name}, ${err.message}`);
    }
  }
};

/**
 * Gère les changements de visibilité de l'onglet/application.
 * Ré-acquiert le verrou SEULEMENT si l'onglet 'Suivi' était actif.
 */
const handleVisibilityChange = () => {
  // Vérifie si l'onglet redevient visible
  if (document.visibilityState === 'visible') {
    // Récupère le dernier onglet actif depuis le localStorage
    const lastActiveTab = localStorage.getItem('lastActiveTab');
    
    // Si le dernier onglet était 'live', on tente de réactiver le verrou
    if (lastActiveTab === 'live') {
      console.log("L'onglet est redevenu visible ET l'onglet 'Suivi' était actif. Tentative de réactivation du Wake Lock.");
      requestWakeLock(); 
    } else {
      console.log("L'onglet est redevenu visible, mais l'onglet 'Suivi' n'était pas le dernier actif. Pas de réactivation du Wake Lock.");
    }
  } 
  // On ne fait rien de spécial si l'onglet devient caché (hidden), 
  // car releaseWakeLock est déjà appelé en quittant l'onglet 'live'.
};

// Écoute les changements de visibilité
document.addEventListener('visibilitychange', handleVisibilityChange);
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { requestWakeLock, releaseWakeLock };
