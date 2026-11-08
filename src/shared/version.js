// ========================================================================
// Numéro de version de l'application, affiché en pied de page.
// À incrémenter à chaque intervention livrée (voir CLAUDE.md, section 6) :
//   MAJEUR   : changement qui casse la compatibilité ou migration de données
//   MINEUR   : nouvelle fonction ou évolution visible (remet CORRECTIF à 0)
//   CORRECTIF: bug corrigé, sans nouvelle fonction
// ========================================================================

export const VERSION_MAJEUR = 1;
export const VERSION_MINEUR = 29;
export const VERSION_CORRECTIF = 2;

export const VERSION = `${VERSION_MAJEUR}.${VERSION_MINEUR}.${VERSION_CORRECTIF}`;
