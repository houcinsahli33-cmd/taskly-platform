"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const $ = id => document.getElementById("apv17-" + id);
    const root = document.getElementById("apv17");

    if (!root) return;

    await attendreSession();

    const account = window.utilisateurCourant;
    const role = account?.role;
    const isAdmin = role === "admin";
    const expectedRole = document.body.dataset.requireRole;
    const uid = Number(account?.id);

    if (
        !["admin","client","artisan"].includes(role) ||
        role !== expectedRole ||
        !Number.isSafeInteger(uid) ||
        uid < 1 ||
        uid > 2147483647 ||
        contexteAdminTaskly() !== isAdmin
    ) {
        $("status").textContent = "Session Taskly valide requise.";
        return;
    }

    const base = isAdmin
        ? "/api/admin/taskly-private-v17"
        : "/api/taskly-private-v17";

    if (!isAdmin) {
        $("search").hidden = true;
        $("found").hidden = true;
    }

    let connector = null;
    let selected = null;
    let busy = false;
    let loaded = false;

    function status(message) {
        $("status").textContent = message;
    }

    function enableSend(enabled) {
        $("send").disabled = !enabled;
        $("message").disabled = !enabled;
    }

    function enableVerify(enabled) {
        $("fingerprint").disabled = !enabled;
        $("confirm").disabled = !enabled;
        $("verify-button").disabled = !enabled;
    }

    function clearMessages() {
        $("messages").replaceChildren();
        enableSend(false);
    }

    function clearConversation() {
        clearMessages();
        connector = null;
        selected = null;
        enableVerify(false);
        $("message").value = "";
        $("fingerprint").value = "";
        $("confirm").checked = false;
        $("own-fingerprint").textContent = "—";
        $("name").textContent = "Messagerie privée";
        $("avatar").textContent = "—";
        $("role").textContent = "Sélectionnez un correspondant";
        $("info").textContent = "Aucun correspondant sélectionné.";
    }

    async function request(endpoint, options = {}) {
        if (
            window.utilisateurCourant?.role !== role ||
            Number(window.utilisateurCourant?.id) !== uid ||
            contexteAdminTaskly() !== isAdmin
        ) {
            throw new Error("Session administrative modifiée.");
        }

        const method = options.method || "GET";

        const threadPath =
            /^\/threads(?:\/[1-9][0-9]{0,18}(?:\/(?:keys|messages))?)?$/
                .test(endpoint);

        const contactPath =
            isAdmin &&
            endpoint.startsWith("/contacts?q=") &&
            method === "GET";

        const forbiddenCreation =
            !isAdmin &&
            endpoint === "/threads" &&
            method === "POST";

        if (forbiddenCreation ||
            (!threadPath && !contactPath) ||
            !["GET","POST"].includes(method)) {
            throw new Error("Route non autorisée.");
        }

        const config = { method, cache: "no-store" };

        if (options.body !== undefined) {
            config.body = JSON.stringify(options.body);
        }

        // Existing Taskly session and CSRF protection.
        return requeteAPI(base + endpoint, config);
    }

    async function run(operation) {
        if (busy) return;

        busy = true;

        try {
            await operation();
        } catch (error) {
            enableSend(false);

            if (error.status === 401 || error.status === 403) {
                clearConversation();
                $("list").replaceChildren();
                $("found").replaceChildren();
                loaded = false;
            }

            status(error.status === 404
                ? "Messagerie indisponible ou non activée."
                : error.message || "Opération indisponible.");
        } finally {
            busy = false;
        }
    }

    function contactButton(parent, name, action) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "apv17-contact";
        button.textContent = name;

        button.addEventListener("click", () => run(action));

        parent.append(button);
        return button;
    }

    function roleName(role) {
        return {
            admin: "Administration",
            client: "Client",
            artisan: "Artisan"
        }[role] || "Utilisateur Taskly";
    }

    async function loadThreads() {
        const data = await request("/threads");

        if (!Array.isArray(data.threads)) {
            throw new Error("Liste des conversations invalide.");
        }

        $("list").replaceChildren();

        if (!data.threads.length) {
            $("list").textContent = "Aucune conversation.";
        }

        for (const thread of data.threads) {
            const peer = {
                userId: Number(
                    isAdmin
                        ? thread.member_user_id
                        : thread.admin_user_id
                ),
                role: thread.peer_role,
                name: thread.peer_name || "Utilisateur Taskly"
            };

            const button = contactButton(
                $("list"),
                peer.name + " · " + roleName(peer.role),
                () => selectThread(String(thread.id), peer)
            );

            button.dataset.threadId = String(thread.id);

            if (selected === String(thread.id)) {
                button.setAttribute("aria-current", "true");
            }
        }

        loaded = true;
    }

    async function showMessages() {
        clearMessages();

        const messages = await connector.read();

        for (const message of messages) {
            const bubble = document.createElement("div");

            bubble.className = "apv17-bubble" +
                (message.own ? " own" : "");

            // Messages are always rendered as text, not HTML.
            bubble.textContent = message.content;

            $("messages").append(bubble);
        }

        $("messages").scrollTop = $("messages").scrollHeight;

        enableSend(true);
        status("Conversation accessible sur cet appareil.");
    }

    async function refreshConversation() {
        if (!connector) return;

        clearMessages();
        enableVerify(false);

        const state = await connector.prepare();

        $("own-fingerprint").textContent = state.ownFingerprint;

        enableVerify(state.peerAvailable);

        if (!state.peerAvailable) {
            status("Le correspondant doit initialiser son identité.");
            return;
        }

        await showMessages();
    }

    async function selectThread(thread, peer) {
        clearConversation();

        if (isAdmin
            ? !["client","artisan"].includes(peer.role)
            : peer.role !== "admin") {
            throw new Error("Correspondant invalide.");
        }

        connector = window.TasklyAdminPrivateConnectorV17.create({
            request,
            role,
            userId: uid,
            peerRole: peer.role,
            peerId: Number(peer.userId),
            threadId: thread
        });

        selected = thread;

        $("name").textContent = peer.name;
        $("avatar").textContent =
            peer.name.slice(0,1).toUpperCase();

        $("role").textContent = roleName(peer.role);
        $("info").textContent =
            peer.name + " · Identifiant " + peer.userId;

        $("list").querySelectorAll("[data-thread-id]").forEach(b => {
            b.setAttribute(
                "aria-current",
                String(b.dataset.threadId === selected)
            );
        });

        await refreshConversation();
    }

    $("search").addEventListener("submit", event => {
        event.preventDefault();

        run(async () => {
            if (!isAdmin) return;

            const q = $("query").value.trim();

            if (q.length < 2 || q.length > 100) return;

            const result = await request(
                "/contacts?q=" + encodeURIComponent(q)
            );

            if (!Array.isArray(result.contacts)) {
                throw new Error("Annuaire indisponible.");
            }

            $("found").replaceChildren();

            if (!result.contacts.length) {
                $("found").textContent = "Aucun utilisateur trouvé.";
            }

            for (const peer of result.contacts) {
                contactButton(
                    $("found"),
                    peer.name + " · " + roleName(peer.role),
                    async () => {
                        const result = await request("/threads", {
                            method: "POST",
                            body: {
                                memberUserId: Number(peer.userId)
                            }
                        });

                        await loadThreads();

                        await selectThread(
                            String(result.thread.id), peer
                        );
                    }
                );
            }
        });
    });

    $("verify").addEventListener("submit", event => {
        event.preventDefault();

        run(async () => {
            if (!connector || !$("confirm").checked) return;

            const fingerprint =
                $("fingerprint").value.trim().toLowerCase();

            if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
                throw new Error("Empreinte invalide.");
            }

            await connector.verifyPeer(fingerprint);

            $("fingerprint").value = "";
            $("confirm").checked = false;

            await showMessages();
        });
    });

    $("compose").addEventListener("submit", event => {
        event.preventDefault();

        run(async () => {
            if (!connector || $("send").disabled) return;

            const message = $("message").value;

            if (!message.trim()) return;

            enableSend(false);

            await connector.send(message);

            $("message").value = "";

            await showMessages();
        });
    });

    $("reload").addEventListener("click", () => run(loadThreads));

    $("refresh").addEventListener("click", () => {
        run(refreshConversation);
    });

    root.addEventListener("toggle", () => {
        if (root.open && !loaded) {
            run(loadThreads);
        }
    });

    if (root.open && !loaded) {
        run(loadThreads);
    }

    window.addEventListener("pagehide", clearConversation);

    window.addEventListener("pageshow", event => {
        if (event.persisted) window.location.reload();
    });
});