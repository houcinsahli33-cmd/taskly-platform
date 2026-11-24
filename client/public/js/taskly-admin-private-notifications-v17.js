"use strict";

document.addEventListener("DOMContentLoaded",async()=>{
    const badges = [
        ...document.querySelectorAll("[data-apv17-unread]")
    ];

    if(!badges.length) return;

    await attendreSession();

    const account = window.utilisateurCourant;
    const role = account?.role;
    const uid = Number(account?.id);

    if(!["admin","client","artisan"].includes(role) ||
       role !== document.body.dataset.requireRole ||
       !Number.isSafeInteger(uid) ||
       uid < 1 ||
       contexteAdminTaskly() !== (role === "admin")) {
        return;
    }

    const base = role === "admin"
        ? "/api/admin/taskly-private-v17"
        : "/api/taskly-private-v17";

    let busy = false;
    let stopped = false;
    let lastRequest = 0;
    let readTimer = null;

    function render(count) {
        for(const badge of badges) {
            badge.textContent =
                count > 99 ? "99+" : String(count);

            badge.hidden = count === 0;

            if(count > 0) {
                badge.setAttribute(
                    "aria-label",
                    count + " message(s) non lu(s)"
                );
            } else {
                badge.removeAttribute("aria-label");
            }
        }
    }

    function hideUnknown() {
        for(const badge of badges) {
            badge.hidden = true;
            badge.textContent = "";
            badge.removeAttribute("aria-label");
        }
    }

    async function refresh() {
        if(stopped || busy ||
           document.visibilityState !== "visible" ||
           Date.now() - lastRequest < 5000) return;

        if(Number(window.utilisateurCourant?.id) !== uid ||
           window.utilisateurCourant?.role !== role) {
            hideUnknown();
            stopped = true;
            clearInterval(timer);
            return;
        }

        busy = true;
        lastRequest = Date.now();

        try {
            const data = await requeteAPI(
                base + "/unread",
                { method:"GET",cache:"no-store" }
            );

            if(stopped) return;

            if(!Number.isSafeInteger(data.total) ||
               data.total < 0) {
                throw new Error("Invalid unread count");
            }

            render(data.total);

        } catch(error) {
            hideUnknown();

            if([401,403,404].includes(error.status)) {
                stopped = true;
                clearInterval(timer);
            }
        } finally {
            busy = false;
        }
    }

    const timer = setInterval(refresh,60000);

    document.addEventListener(
        "visibilitychange",refresh
    );

    function refreshAfterRead() {
        if(stopped) return;

        clearTimeout(readTimer);

        readTimer = setTimeout(()=>{
            if(stopped) return;

            if(busy) {
                refreshAfterRead();
                return;
            }

            refresh();
        },5000);
    }

    window.addEventListener(
        "taskly:apv17-read",refreshAfterRead
    );

    window.addEventListener("pagehide",()=>{
        clearTimeout(readTimer);
        stopped = true;
        clearInterval(timer);
        hideUnknown();
    });

    window.addEventListener("pageshow",event=>{
        if(event.persisted) location.reload();
    });

    await refresh();
});