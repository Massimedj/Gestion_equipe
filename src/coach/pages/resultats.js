// ========================================================================
// Contenu pour : src/coach/pages/resultats.js
// Onglet Résultats : calendrier et résultats des matchs.
// Extrait de script.js -- rangement seul, aucune logique modifiée.
// ========================================================================

import { getCurrentTeam } from './effectif.js';

// --- Début du code déplacé ---

// ============================
// RÉSULTATS & STATS (Read-only rendering)
// ============================
function renderResults() {
    console.log("renderResults: Début de l'exécution."); // Log 1: Vérifie si la fonction est appelée

    const currentTeam = getCurrentTeam();
    const resultsTableBody = document.getElementById('results-list-table');
    // const summaryDiv = document.getElementById('results-summary'); // Cet ID n'existe plus

    // Vérifie si l'élément tbody existe
    if (!resultsTableBody) {
        console.error("renderResults: ERREUR CRITIQUE - Élément 'results-list-table' (tbody) introuvable !");
        return; 
    }

    // Vide le contenu précédent
    resultsTableBody.innerHTML = ''; 
    console.log("renderResults: Tableau (tbody) vidé."); // Log 2: Confirme le vidage

    // Vérifie si l'équipe et les matchs existent
    if (!currentTeam || !currentTeam.matches || currentTeam.matches.length === 0) {
        console.warn("renderResults: Aucune équipe ou aucun match trouvé. Affichage du message 'Aucun match'."); // Log 3: Cas où il n'y a pas de matchs
        resultsTableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Aucun match enregistré pour cette équipe.</td></tr>';
        return;
    }

    console.log(`renderResults: ${currentTeam.matches.length} match(s) trouvé(s) pour l'équipe.`); // Log 4: Confirme le nombre de matchs

    // Trie les matchs par date (ordre chronologique)
    const sortedMatches = [...currentTeam.matches].sort((a, b) => new Date(a.date.replace(/-/g, '/')) - new Date(b.date.replace(/-/g, '/')));

    let rowsAdded = 0; // Compteur pour vérifier si des lignes sont ajoutées

    // Boucle sur chaque match trié
    sortedMatches.forEach((match, index) => {
        console.log(`renderResults: Traitement du match ${index + 1}/${sortedMatches.length} (ID: ${match.id}, Adversaire: ${match.opponent})`); // Log 5: Suit chaque match

        // S'assure que la structure score/sets existe
        const score = match.score || { myTeam: '', opponent: '', sets: [] };
        const sets = score.sets || [];
        // Récupère les scores finaux (sets gagnés), utilise 0 si vide ou invalide
        const mySets = parseInt(score.myTeam) || 0; 
        const oppSets = parseInt(score.opponent) || 0; 

        // Détermine si le match est considéré comme "joué" (a un score final ou un statut de forfait)
        const isPlayed = match.forfeitStatus !== 'none' || (mySets > 0 || oppSets > 0);
        console.log(`renderResults: Match ID ${match.id} - est joué ? ${isPlayed} (Forfait: ${match.forfeitStatus}, Score: ${score.myTeam}-${score.opponent})`); // Log 6: Vérifie la condition 'isPlayed'

        // Variables pour l'affichage du résultat
        let resultText = ''; 
        let resultColor = 'text-gray-500'; // Gris par défaut
        
        if (isPlayed) {
            // Traitement pour les matchs joués
            if (match.forfeitStatus === 'win') {
                resultText = '(F)'; resultColor = 'text-green-600';
            } else if (match.forfeitStatus === 'loss') {
                resultText = '(F)'; resultColor = 'text-red-600';
            } else { // Score normal
                resultColor = mySets > oppSets ? 'text-green-600' : (oppSets > mySets ? 'text-red-600' : 'text-gray-500');
                // resultText reste vide pour les scores normaux
            }
        } else {
             // Affichage pour les matchs non joués
             resultText = 'N/J'; // Non Joué
             resultColor = 'text-gray-400';
        }

        // Construit le HTML pour les scores des sets
        let setScoresHtml = '';
        // Affiche les scores des sets uniquement si le match est considéré comme joué
        if (isPlayed && sets.length > 0) { 
             sets.forEach((set, setIndex) => {
                 // S'assure que le set existe et a des scores valides
                 if (set && (set.myTeam !== '' || set.opponent !== '')) { 
                     setScoresHtml += `<span class="whitespace-nowrap text-xs px-2 py-1 bg-gray-200 rounded">${set.myTeam}-${set.opponent}</span>`;
                 } else {
                     console.log(`renderResults: Match ID ${match.id}, Set ${setIndex + 1} ignoré (scores vides).`); // Log 7: Si un set est vide
                 }
             });
        }
        // Si aucun score de set n'a été ajouté mais que le match est joué (ex: forfait saisi avant les sets)
        if (isPlayed && setScoresHtml === '' && match.forfeitStatus !== 'none') {
             setScoresHtml = '<span class="text-xs text-gray-400">Forfait</span>';
        } else if (isPlayed && setScoresHtml === '') {
             setScoresHtml = '<span class="text-xs text-gray-400">N/A</span>';
        }

        // Crée l'élément de ligne du tableau
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50'; 
        // Remplit la ligne avec les cellules (td)
        row.innerHTML = `
            <td class="p-3 text-sm text-gray-600 whitespace-nowrap">${new Date(match.date.replace(/-/g, '/')).toLocaleDateString('fr-FR')}</td>
            <td class="p-3 text-sm">${match.opponent}</td>
            <td class="p-3 text-center text-sm">${match.location === 'domicile' ? 'Dom.' : 'Ext.'}</td>
            <td class="p-3 text-center font-bold ${resultColor}">${mySets}-${oppSets} ${resultText}</td>
            <td class="p-3">
                <div class="flex flex-row gap-1 overflow-x-auto whitespace-nowrap">
                    ${setScoresHtml || ''} 
                </div>
            </td>
        `;
        // Ajoute la ligne au corps du tableau
        resultsTableBody.appendChild(row);
        rowsAdded++; // Incrémente le compteur de lignes ajoutées
    });

    console.log(`renderResults: Terminé. ${rowsAdded} ligne(s) ajoutée(s) au tableau.`); // Log 8: Nombre final de lignes
    
    // La partie summaryDiv a été supprimée car déplacée vers renderTeamStats
}
// --- Fin du code déplacé ---

// --- Utilisé par les autres modules ---
export { renderResults };
