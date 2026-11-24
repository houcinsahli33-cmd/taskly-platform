"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function fixture(role, enabled) {
    const file = path.resolve(
        __dirname,
        "../server/routes/" + role +
        "WorkspaceNavigation.js"
    );

    const module = { exports: {} };

    let routeHandlers;
    let reads = 0;

    const auth = (req, res, next) => {
        if (!req.session?.utilisateur) {
            return res.status(401).send("Session requise");
        }
        return next();
    };

    const dependencies = {
        "node:path": path,
        "node:fs/promises": {
            async readFile(filename, encoding) {
                reads++;
                return fs.promises.readFile(filename, encoding);
            }
        },
        "../middleware/authMiddleware": {
            verifierConnexion: auth
        },
        "../services/chatCallPilot": {
            autoriseCompte: () => false,
            interfaceDemande: () => ""
        },
        "../services/professionalMailAccess": {
            modeClient: () => false,
            modeGeneral: () => false
        }
    };

    vm.runInNewContext(
        fs.readFileSync(file, "utf8"),
        {
            module,
            exports: module.exports,
            __dirname: path.dirname(file),
            process: {
                env: {
                    TASKLY_ADMIN_PRIVATE_V17_ENABLED:
                        enabled ? "true" : "false",
                    TASKLY_CHAT_WORKSPACE_ENABLED: "true"
                }
            },
            require(name) {
                if (!(name in dependencies)) {
                    throw new Error(
                        "Unexpected dependency: " + name
                    );
                }
                return dependencies[name];
            }
        }
    );

    module.exports({
        get(url, ...handlers) {
            assert.equal(url, "/espace/" + role + "/:page");
            routeHandlers = handlers;
        }
    });

    assert.equal(routeHandlers[0], auth);

    async function request(
        page,
        accountRole = role,
        embed = false
    ) {
        const result = {
            status: 200,
            body: "",
            headers: {},
            next: false
        };

        const req = {
            params: { page },
            session: accountRole
                ? {
                    utilisateur: {
                        id: 2,
                        role: accountRole
                    }
                }
                : {},
            query: embed
                ? { ["taskly_" + role + "_embed"]: "1" }
                : {},
            get() {
                return undefined;
            }
        };

        const res = {
            status(code) {
                result.status = code;
                return this;
            },
            type() {
                return this;
            },
            set(name, value) {
                result.headers[name] = value;
                return this;
            },
            send(body) {
                result.body = body;
                return this;
            },
            json(body) {
                result.body = body;
                return this;
            }
        };

        await routeHandlers[0](req,res,() =>
            routeHandlers[1](req,res,() => {
                result.next = true;
            })
        );

        return result;
    }

    return {
        request,
        reads: () => reads
    };
}

for (const role of ["client","artisan"]) {

    test(
        "V17 navigation " + role + ": feature disabled",
        async () => {
            const f = fixture(role,false);

            const page = await f.request(
                "messagerie-administration"
            );

            assert.equal(page.status,404);
            assert.equal(f.reads(),0);

            const legacy = await f.request("messagerie");

            assert.equal(legacy.status,200);
            assert.doesNotMatch(
                legacy.body,
                /data-dashboard-link="messagerie-administration"/
            );
        }
    );

    test(
        "V17 navigation " + role + ": authorized shell",
        async () => {
            const f = fixture(role,true);

            const result = await f.request(
                "messagerie-administration"
            );

            assert.equal(result.status,200);

            assert.match(
                result.body,
                /data-dashboard-link="messagerie-administration"/
            );

            assert.ok(
                result.body.includes(
                    "taskly-" + role + "-content-frame"
                )
            );

            assert.match(
                result.body,
                /data-dashboard-link="messagerie"/
            );

            assert.equal(
                result.headers["Cache-Control"],
                "no-store, private"
            );
        }
    );

    test(
        "V17 navigation " + role + ": embedded workspace",
        async () => {
            const f = fixture(role,true);

            const result = await f.request(
                "messagerie-administration",role,true
            );

            assert.equal(result.status,200);
            assert.match(result.body,/id="apv17"/);
            assert.doesNotMatch(
                result.body,
                /id="chat-workspace"/
            );

            assert.equal(
                result.headers["X-Frame-Options"],
                "SAMEORIGIN"
            );

            assert.equal(
                result.headers["Content-Security-Policy"],
                "frame-ancestors 'self'"
            );
        }
    );

    test(
        "V17 navigation " + role + ": other roles rejected",
        async () => {
            const f = fixture(role,true);

            const other = role === "client"
                ? "artisan" : "client";

            for (const account of [other,"admin",null]) {
                const result = await f.request(
                    "messagerie-administration",
                    account,true
                );

                assert.equal(
                    result.status,
                    account ? 403 : 401
                );
            }

            assert.equal(f.reads(),0);
        }
    );
}