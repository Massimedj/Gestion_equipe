// ========================================================================
// Contenu pour : src/coach/shared/dialog.js
// Popups d'alerte et de confirmation modernes, centrées à l'écran.
// Remplacent alert() et confirm() du navigateur.
//   showAlert(message, { title, type })        -> Promise (se résout à la fermeture)
//   showConfirm(message, { title, confirmText, cancelText, danger }) -> Promise<boolean>
// Les styles sont injectés par ce fichier (aucune dépendance à la page).
// ========================================================================

const STYLE_ID = 'app-dialog-style';

const CSS = `
.app-dialog-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    background: rgba(17, 24, 39, 0.55);
    backdrop-filter: blur(2px);
    animation: app-dialog-fade 0.15s ease-out;
}
.app-dialog-box {
    width: 100%; max-width: 420px;
    background: #fff; border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
    padding: 28px 24px 20px; text-align: center;
    font-family: 'Inter', sans-serif;
    animation: app-dialog-pop 0.18s ease-out;
}
.app-dialog-icon {
    width: 56px; height: 56px; margin: 0 auto 14px;
    border-radius: 9999px;
    display: flex; align-items: center; justify-content: center;
}
.app-dialog-icon svg { width: 28px; height: 28px; }
.app-dialog-icon.info    { background: #dbeafe; color: #2563eb; }
.app-dialog-icon.success { background: #dcfce7; color: #16a34a; }
.app-dialog-icon.warning { background: #fef3c7; color: #d97706; }
.app-dialog-icon.error   { background: #fee2e2; color: #dc2626; }
.app-dialog-title {
    font-size: 1.25rem; font-weight: 700; color: #1f2937; margin: 0 0 8px;
}
.app-dialog-message {
    font-size: 0.95rem; line-height: 1.5; color: #4b5563; margin: 0;
    white-space: pre-line; overflow-wrap: anywhere;
}
.app-dialog-actions {
    display: flex; justify-content: center; gap: 12px; margin-top: 22px;
}
.app-dialog-btn {
    flex: 1; padding: 10px 20px; border: 0; border-radius: 8px;
    font-size: 0.95rem; font-weight: 600; cursor: pointer;
    transition: background-color 0.15s;
}
.app-dialog-btn:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
.app-dialog-btn.cancel  { background: #d1d5db; color: #1f2937; }
.app-dialog-btn.cancel:hover  { background: #9ca3af; }
.app-dialog-btn.primary { background: #3b82f6; color: #fff; }
.app-dialog-btn.primary:hover { background: #2563eb; }
.app-dialog-btn.danger  { background: #ef4444; color: #fff; }
.app-dialog-btn.danger:hover  { background: #dc2626; }
@keyframes app-dialog-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes app-dialog-pop  { from { opacity: 0; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: none; } }
`;

const ICONS = {
    info:    '<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    success: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>',
    warning: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>',
    error:   '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>'
};

const DEFAULT_TITLES = {
    info: 'Information', success: 'Succès', warning: 'Attention', error: 'Une erreur est survenue'
};

// Choisit l'icône d'après le texte du message quand aucun type n'est précisé.
function guessType(message) {
    const m = String(message).toLowerCase();
    if (/^erreur|impossible|échou/.test(m)) return 'error';
    if (/succès|ajoutée|importé|envoyé/.test(m)) return 'success';
    return 'warning';
}

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// Les popups s'affichent l'une après l'autre si plusieurs sont demandées d'affilée.
let queue = Promise.resolve();

function openDialog({ type, title, message, confirmText, cancelText, danger }) {
    return new Promise(resolve => {
        injectStyle();
        const previousFocus = document.activeElement;

        const backdrop = document.createElement('div');
        backdrop.className = 'app-dialog-backdrop';

        const box = document.createElement('div');
        box.className = 'app-dialog-box';
        box.setAttribute('role', cancelText ? 'alertdialog' : 'dialog');
        box.setAttribute('aria-modal', 'true');

        const icon = document.createElement('div');
        icon.className = `app-dialog-icon ${type}`;
        icon.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">${ICONS[type]}</svg>`;

        const h = document.createElement('h2');
        h.className = 'app-dialog-title';
        h.textContent = title;

        // textContent : un nom de joueur ou d'équipe ne peut pas injecter de HTML.
        const p = document.createElement('p');
        p.className = 'app-dialog-message';
        p.textContent = message;

        const actions = document.createElement('div');
        actions.className = 'app-dialog-actions';

        let cancelBtn = null;
        if (cancelText) {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'app-dialog-btn cancel';
            cancelBtn.textContent = cancelText;
            actions.appendChild(cancelBtn);
        }
        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = `app-dialog-btn ${danger ? 'danger' : 'primary'}`;
        okBtn.textContent = confirmText;
        actions.appendChild(okBtn);

        box.append(icon, h, p, actions);
        backdrop.appendChild(box);

        function close(result) {
            document.removeEventListener('keydown', onKey, true);
            backdrop.remove();
            if (previousFocus && previousFocus.focus) previousFocus.focus();
            resolve(result);
        }
        // Échap = annuler (ou simplement fermer pour une alerte).
        function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
        }

        okBtn.addEventListener('click', () => close(true));
        if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));
        // Clic à côté de la boîte = annuler / fermer.
        backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(false); });
        document.addEventListener('keydown', onKey, true);

        document.body.appendChild(backdrop);
        // Action destructrice : le focus est sur « Annuler » pour éviter un Entrée malheureux.
        (danger && cancelBtn ? cancelBtn : okBtn).focus();
    });
}

function enqueue(options) {
    const result = queue.then(() => openDialog(options));
    queue = result.catch(() => {});
    return result;
}

/** Affiche un message (remplace alert). type : 'info' | 'success' | 'warning' | 'error' */
function showAlert(message, { title, type } = {}) {
    const t = type || guessType(message);
    return enqueue({ type: t, title: title || DEFAULT_TITLES[t], message, confirmText: 'OK' });
}

/** Demande une confirmation (remplace confirm). Résultat : true si confirmé, false sinon. */
function showConfirm(message, { title = 'Confirmation', confirmText = 'Confirmer', cancelText = 'Annuler', danger = false } = {}) {
    return enqueue({ type: danger ? 'error' : 'warning', title, message, confirmText, cancelText, danger });
}

export { showAlert, showConfirm };
