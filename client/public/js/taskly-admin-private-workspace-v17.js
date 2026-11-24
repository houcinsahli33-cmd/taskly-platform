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
    let disposed = false;
    let readyToPoll = false;
    let lastSignature = null;
    const confirmedReceipts = new Map();
    const privateTab = isAdmin ? document.getElementById("tmv3-tab-private-v17") : null;
    const privatePanel = privateTab ? document.getElementById("tmv3-view-private-v17") : null;
    const adminDesign = Boolean(privateTab && privatePanel);
    const copiedDesign = adminDesign && root.dataset.apv17Copy === "1";
    let unreadByThread = new Map(), unreadOnly = false;

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
        lastSignature = null;
        $("messages").replaceChildren();
        enableSend(false);
    }

    function clearConversation() {
        readyToPoll = false;
        clearMessages();
        connector = null;
        selected = null;
        if (adminDesign) root.classList.remove("cw-has-selection", "apv17-show-details");
        if (copiedDesign) { $("info-avatar").textContent = "—"; $("info-role").textContent = ""; }
        if (adminDesign) $("details-toggle").setAttribute("aria-expanded", "false");
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
            /^\/threads(?:\/[1-9][0-9]{0,18}(?:\/(?:keys|messages|read))?)?$/
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
            (!threadPath && !contactPath && !(copiedDesign && endpoint === "/unread" && method === "GET")) ||
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
        if (busy || disposed) return;

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
        button.className = adminDesign ? "cw-conversation" : "apv17-contact";
        if (adminDesign) {
            const avatar = document.createElement("span");
            avatar.className = "cw-avatar";
            avatar.textContent = name.trim().slice(0,1).toUpperCase() || "—";
            const copy = document.createElement("span");
            copy.className = "cw-conversation-main";
            const head = document.createElement("span");
            head.className = "cw-conversation-head";
            const label = document.createElement("strong");
            label.textContent = name;
            head.append(label); copy.append(head); button.append(avatar,copy);
        } else button.textContent = name;

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

        if (copiedDesign) {
            try {
                const counts = await request("/unread");
                if (!Array.isArray(counts.threads)) throw new Error("Compteurs invalides.");
                unreadByThread = new Map(counts.threads.map(t => [String(t.id), Number(t.unread) || 0]));
                $("count").textContent = String(counts.total) + " non lu(s)";
                $("unread-label").textContent = "Non lus (" + unreadByThread.size + ")";
            } catch (error) {
                if ([401,403,404].includes(error.status)) throw error;
                unreadByThread.clear(); $("count").textContent = "Compteurs indisponibles";
            }
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
            if (copiedDesign) {
                const head = button.querySelector(".cw-conversation-head");
                head.querySelector("strong").textContent = peer.name;
                const time = document.createElement("time");
                const dt = new Date(thread.updated_at);
                if (thread.updated_at && !Number.isNaN(dt.getTime())) time.textContent = dt.toLocaleDateString("fr-FR", {day:"numeric",month:"short"});
                head.append(time);
                const roleText = document.createElement("small"); roleText.textContent = roleName(peer.role);
                const sub = document.createElement("span"); sub.className = "cw-conversation-sub";
                const count = unreadByThread.get(String(thread.id)) || 0;
                if (count > 0) { const badge = document.createElement("b"); badge.className = "cw-unread"; badge.textContent = count > 99 ? "99+" : String(count); sub.append(badge); }
                button.querySelector(".cw-conversation-main").append(roleText,sub);
                button.hidden = unreadOnly && count === 0;
                button.classList.toggle("active", selected === String(thread.id));
            }

            if (selected === String(thread.id)) {
                button.setAttribute("aria-current", "true");
            }
        }

        loaded = true;
    }

    async function showMessages() {
        const active = connector;
        const threadAtStart = selected;

        if (!active || disposed) return;

        const messages = await active.read();

        if (disposed ||
            active !== connector ||
            threadAtStart !== selected) return;

        readyToPoll = true;

        if (!root.open ||
            document.visibilityState !== "visible") return;

        const container = $("messages");
        const signature = JSON.stringify(messages);

        if (lastSignature !== signature) {
            const firstRender = lastSignature === null;
            const previousScroll = container.scrollTop;

            const nearBottom =
                container.scrollHeight -
                container.scrollTop -
                container.clientHeight < 80;

            const fragment = document.createDocumentFragment();

            for (const message of messages) {
                const bubble = document.createElement("div");

                bubble.className = "apv17-bubble" +
                    (message.own ? " own" : "");

                bubble.textContent = message.content;

                if (adminDesign) {
                    const line = document.createElement("div");
                    line.className = "cw-message-line" + (message.own ? " mine" : "");
                    bubble.className = "cw-bubble";
                    const text = document.createElement("p");
                    text.textContent = message.content;
                    bubble.replaceChildren(text);
                    const date = new Date(message.createdAt);
                    if (message.createdAt && !Number.isNaN(date.getTime())) {
                        const time = document.createElement("small");
                        time.textContent = date.toLocaleString("fr-FR", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
                        bubble.append(time);
                    }
                    if (copiedDesign && !message.own) { const avatar = $("avatar").cloneNode(true); avatar.removeAttribute("id"); avatar.className = "cw-avatar cw-message-avatar"; line.append(avatar); }
                    line.append(bubble); fragment.append(line);
                } else fragment.append(bubble);
            }

            container.replaceChildren(fragment);

            lastSignature = signature;

            container.scrollTop = firstRender || nearBottom
                ? container.scrollHeight
                : previousScroll;
        }

        enableSend(true);
        status("Conversation accessible sur cet appareil.");

        if(root.open &&
           document.visibilityState === "visible" &&
           selected) {

            const thread = selected;

            if(!confirmedReceipts.has(thread)) {
                confirmedReceipts.set(thread,new Set());
            }

            const confirmed = confirmedReceipts.get(thread);

            const messageIds = messages
                .filter(m => !m.own &&
                    !confirmed.has(String(m.id)))
                .map(m => String(m.id));

            if(messageIds.length) {
                try {
                    await request(
                        "/threads/" + thread + "/read",
                        {
                            method:"POST",
                            body:{messageIds}
                        }
                    );

                    messageIds.forEach(
                        id => confirmed.add(id)
                    );
                    if (copiedDesign) await loadThreads();

                    window.dispatchEvent(
                        new Event("taskly:apv17-read")
                    );

                    if(window.parent !== window) {
                        try {
                            window.parent.dispatchEvent(
                                new window.parent.Event("taskly:apv17-read")
                            );
                        } catch {}
                    }

                } catch(error) {
                    if([401,403].includes(error.status)) {
                        throw error;
                    }

                    status(
                        "Messages affiches. Compteur de lecture a actualiser."
                    );
                }
            }
        }
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
        if (adminDesign) root.classList.add("cw-has-selection");

        $("name").textContent = peer.name;
        $("avatar").textContent =
            peer.name.slice(0,1).toUpperCase();

        $("role").textContent = roleName(peer.role);
        $("info").textContent =
            copiedDesign ? peer.name : peer.name + " · Identifiant " + peer.userId;
        if (copiedDesign) { $("info-avatar").textContent = $("avatar").textContent; $("info-role").textContent = roleName(peer.role) + " · Identifiant " + peer.userId; }

        $("list").querySelectorAll("[data-thread-id]").forEach(b => {
            if (copiedDesign) b.classList.toggle("active", b.dataset.threadId === selected);
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
            if (copiedDesign) $("found").hidden = false;

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
                        if (copiedDesign) $("found").hidden = true;

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

    if (copiedDesign) {
        root.querySelectorAll("[data-cw-filter]").forEach(b => b.addEventListener("click", () => {
            unreadOnly = b.dataset.cwFilter === "unread";
            root.querySelectorAll("[data-cw-filter]").forEach(x => x.setAttribute("aria-pressed",String(x === b)));
            run(loadThreads);
        }));
        const picker = $("emoji-picker");
        for (const emoji of ["🙂","😊","👍","👋","✅","🙏","🔧","📅"]) {
            const b = document.createElement("button"); b.type = "button"; b.textContent = emoji;
            b.addEventListener("click", () => { const input = $("message"); if (!input.disabled && input.value.length + emoji.length <= input.maxLength) { input.setRangeText(emoji,input.selectionStart,input.selectionEnd,"end"); input.focus(); } picker.hidden = true; $("emoji-toggle").setAttribute("aria-expanded","false"); }); picker.append(b);
        }
        $("emoji-toggle").addEventListener("click", () => { if ($("message").disabled) return; picker.hidden = !picker.hidden; $("emoji-toggle").setAttribute("aria-expanded",String(!picker.hidden)); });
    }
    // Admin only: the existing three tabs retain their own controller.
    // The V17 tab remains hidden until the authenticated API is available.
    if (adminDesign) {
        const oldTabs = ["support", "mailboxes", "admin-mail"].map(k => document.getElementById("tmv3-tab-" + k));
        const oldPanels = ["support", "mailboxes", "admin-mail"].map(k => document.getElementById("tmv3-view-" + k));
        const tabbar = privateTab.parentElement;
        if (oldTabs.every(Boolean) && oldPanels.every(Boolean) && tabbar) {
            function fitPrivate() {
                if (privatePanel.hidden) return;
                const top = root.getBoundingClientRect().top;
                root.style.setProperty("--apv17-height", Math.max(400, window.innerHeight - top - 20) + "px");
                if (copiedDesign) $("details-toggle").setAttribute("aria-expanded", String(privatePanel.clientWidth > 980 ? !root.classList.contains("apv17-show-details") : root.classList.contains("apv17-show-details")));
            }
            function closePrivate() {
                root.open = false;
                oldPanels.forEach(p => p.removeAttribute("inert"));
                privatePanel.hidden = true;
                privatePanel.setAttribute("inert", "");
                privateTab.setAttribute("aria-selected", "false");
                privateTab.tabIndex = -1;
            }
            function openPrivate() {
                if (privateTab.hidden || disposed) return;
                oldTabs.forEach(t => { t.setAttribute("aria-selected", "false"); t.tabIndex = -1; });
                oldPanels.forEach(p => { p.hidden = true; });
                privatePanel.hidden = false;
                privatePanel.removeAttribute("inert");
                privateTab.setAttribute("aria-selected", "true");
                privateTab.tabIndex = 0;
                root.open = true;
                fitPrivate();
                if (connector && readyToPoll) run(showMessages);
            }
            tabbar.addEventListener("click", event => {
                const target = event.target.closest('[role="tab"]');
                if (oldTabs.includes(target)) closePrivate();
                if (target === privateTab) openPrivate();
            }, true);
            tabbar.addEventListener("keydown", event => {
                if (privateTab.hidden || !["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
                const tabs = [...oldTabs, privateTab];
                const i = tabs.indexOf(event.target);
                if (i < 0) return;
                event.preventDefault(); event.stopPropagation();
                const j = event.key === "Home" ? 0 : event.key === "End" ? tabs.length-1 : (i + (event.key === "ArrowRight" ? 1 : tabs.length-1)) % tabs.length;
                tabs[j].click(); tabs[j].focus();
            }, true);
            $("back").addEventListener("click", () => {
                // Returning to the list hides the conversation, without marking unread messages as read.
                clearConversation();
                $("list").querySelectorAll("[aria-current]").forEach(b => b.setAttribute("aria-current", "false"));
                if (copiedDesign) $("list").querySelectorAll(".active").forEach(b => b.classList.remove("active"));
                $("query").focus();
            });
            $("details-toggle").addEventListener("click", () => {
                const toggled = root.classList.toggle("apv17-show-details");
                const visible = copiedDesign && privatePanel.clientWidth > 980 ? !toggled : toggled;
                $("details-toggle").setAttribute("aria-expanded", String(visible));
            });
            window.addEventListener("resize", fitPrivate);
            // Keep unavailable features out of the production UI; no auth bypass.
            try { await loadThreads(); if (!disposed) privateTab.hidden = false; }
            catch { closePrivate(); }
        }
    }

    root.addEventListener("toggle", () => {
        if (root.open && !loaded) {
            run(loadThreads);
        }
    });

    if (root.open && !loaded) {
        run(loadThreads);
    }

    function refreshOpenConversation() {
        if (disposed ||
            busy ||
            !readyToPoll ||
            !connector ||
            !selected ||
            !root.open ||
            document.visibilityState !== "visible") return;

        run(showMessages);
    }

    const pollingTimer = setInterval(
        refreshOpenConversation,60000
    );

    window.addEventListener("pagehide",()=>{
        disposed = true;
        clearInterval(pollingTimer);
        clearConversation();
    });

    window.addEventListener("pageshow", event => {
        if (event.persisted) window.location.reload();
    });
});