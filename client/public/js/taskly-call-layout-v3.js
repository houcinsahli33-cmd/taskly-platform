'use strict';
/* TASKLY CALL LAYOUT V3
 * Presentation-only adapter. No changes to API, WebRTC, LiveKit, Krisp or ringtone.
 * On spacious desktop screens, use a nonmodal dialog inside the existing thread card
 * so the native header/sidebar and conversation list remain visible. On smaller
 * screens, keep Taskly's original modal dialog and its existing buttons.
 */
(function () {
    function eligibleHost() {
        if (!window.matchMedia('(min-width: 1101px)').matches) return null;
        const host = document.querySelector('#chat-workspace .cw-thread');
        if (!host || !host.isConnected) return null;
        const rect = host.getBoundingClientRect();
        if (rect.width < 390 || rect.height < 390) return null;
        if (window.getComputedStyle(host).display === 'none') return null;
        return host;
    }

    function patch() {
        const proto = window.TasklyCallUI?.prototype;
        if (!proto || proto.__tasklyCallLayoutV3) return;
        if (typeof proto.show !== 'function') return;
        const originalShow = proto.show;
        Object.defineProperty(proto, '__tasklyCallLayoutV3', { value: true });
        proto.show = function (...args) {
            const dialog = this.dialog;
            // Do not interfere with a call already shown or another app dialog.
            if (!dialog || dialog.open || !dialog.classList.contains('taskly-call-dialog')) {
                return originalShow.apply(this, args);
            }
            const host = eligibleHost();
            if (!host) {
                // Preserve Taskly's native modal when the center column is not visible.
                dialog.classList.remove('taskly-call-docked', 'taskly-call-floating');
                if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
                return originalShow.apply(this, args);
            }
            host.appendChild(dialog);
            dialog.classList.remove('taskly-call-floating');
            dialog.classList.add('taskly-call-docked');
            // Per-instance one-call interception, never change HTMLDialogElement globally.
            // TasklyCallUI.show() continues to run all of its original signaling/UI logic.
            Object.defineProperty(dialog, 'showModal', {
                configurable: true,
                value: () => dialog.show()
            });
            try {
                return originalShow.apply(this, args);
            } catch (error) {
                dialog.classList.remove('taskly-call-docked');
                if (!dialog.open) document.body.appendChild(dialog);
                throw error;
            } finally {
                delete dialog.showModal;
            }
        };
    }

    // A window rotation or resize must never hide an already-active call in a
    // conversation pane that has just disappeared from the responsive layout.
    window.addEventListener('resize', () => {
        const dialog = document.querySelector('#chat-workspace .cw-thread > .taskly-call-docked[open]');
        if (!dialog || eligibleHost()) return;
        dialog.classList.remove('taskly-call-docked');
        dialog.classList.add('taskly-call-floating');
        document.body.appendChild(dialog);
    }, { passive: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patch, { once: true });
    } else {
        patch();
    }
})();
