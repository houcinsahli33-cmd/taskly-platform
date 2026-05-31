let adminUtilisateurs = [];
let adminSignalements = [];
let adminContacts = [];
let adminServices = [];
let filtreContacts = "";

function activerOngletAdmin(onglet) {
  document.querySelectorAll("[data-admin-tab]").forEach((bouton) => {
    bouton.classList.toggle("active", bouton.dataset.adminTab === onglet);
  });
  document.querySelectorAll(".admin-section").forEach((section) => {
    section.classList.toggle("active", section.id === `admin-${onglet}`);
  });
}

function initialiserNavigationAdmin() {
  document.querySelectorAll("[data-admin-tab]").forEach((bouton) => {
    bouton.addEventListener("click", () => activerOngletAdmin(bouton.dataset.adminTab));
  });
}

async function chargerStatsAdmin() {
  const statsCible = document.getElementById("admin-stats-grid");
  const latestUsers = document.getElementById("admin-latest-users");
  const latestRequests = document.getElementById("admin-latest-requests");
  const latestReviews = document.getElementById("admin-latest-reviews");
  const latestContacts = document.getElementById("admin-latest-contacts");
  if (!statsCible) return;

  statsCible.innerHTML = etatChargement("Chargement des statistiques...");

  try {
    const data = await requeteAPI("/api/admin/stats");
    const s = data.statistiques;
    statsCible.innerHTML = `
      <div class="stat-card"><span>Utilisateurs</span><strong>${s.totalUsers}</strong></div>
      <div class="stat-card"><span>Clients</span><strong>${s.totalClients}</strong></div>
      <div class="stat-card"><span>Artisans</span><strong>${s.totalArtisans}</strong></div>
      <div class="stat-card"><span>Services</span><strong>${s.totalServices}</strong></div>
      <div class="stat-card"><span>Demandes</span><strong>${s.totalDemandes}</strong></div>
      <div class="stat-card"><span>Avis</span><strong>${s.totalAvis}</strong></div>
      <div class="stat-card"><span>Signalements</span><strong>${s.totalSignalements}</strong></div>
      <div class="stat-card"><span>Support</span><strong>${s.totalContactsSupport}</strong></div>
    `;

    latestUsers.innerHTML = tableSimple(
      ["Nom", "Email", "Rôle", "Date"],
      data.derniersUtilisateurs,
      (u) => [nomComplet(u), u.email, u.role, formatDate(u.created_at)]
    );
    latestRequests.innerHTML = tableSimple(
      ["Service", "Client", "Artisan", "Statut"],
      data.dernieresDemandes,
      (d) => [d.service_nom, nomComplet(d, "client_"), nomComplet(d, "artisan_"), libelleStatut(d.statut)]
    );
    latestReviews.innerHTML = tableSimple(
      ["Client", "Artisan", "Note", "Commentaire"],
      data.derniersAvis,
      (a) => [nomComplet(a, "client_"), nomComplet(a, "artisan_"), `${a.note}/5`, tronquer(a.commentaire, 60)]
    );
    latestContacts.innerHTML = tableSimple(
      ["Sujet", "Email", "Statut", "Date"],
      data.derniersContactsSupport,
      (c) => [c.sujet, c.email, libelleStatut(c.statut), formatDate(c.created_at)]
    );
  } catch (error) {
    statsCible.innerHTML = etatVide(error.message);
  }
}

function tableSimple(entetes, lignes, mapper) {
  if (!lignes || !lignes.length) return etatVide("Aucune donnée à afficher.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${entetes.map((e) => `<th>${echapperHTML(e)}</th>`).join("")}</tr></thead>
        <tbody>
          ${lignes.map((ligne) => `<tr>${mapper(ligne).map((cellule) => `<td>${echapperHTML(cellule)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function chargerUtilisateursAdmin() {
  const cible = document.getElementById("admin-users-table");
  if (!cible) return;
  cible.innerHTML = etatChargement("Chargement des utilisateurs...");

  try {
    const { utilisateurs } = await requeteAPI("/api/admin/users");
    adminUtilisateurs = utilisateurs;

    if (!utilisateurs.length) {
      cible.innerHTML = etatVide("Aucun utilisateur.");
      return;
    }

    cible.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Inscription</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${utilisateurs.map((u) => `
              <tr>
                <td><strong>${echapperHTML(nomComplet(u))}</strong>${u.motif_blocage ? `<br><span class="text-small muted">${echapperHTML(tronquer(u.motif_blocage, 80))}</span>` : ""}</td>
                <td>${echapperHTML(u.email)}</td>
                <td>${echapperHTML(u.role)}</td>
                <td>${badgeStatut(u.statut_compte)}</td>
                <td>${formatDate(u.created_at)}</td>
                <td>
                  ${u.role === "admin" ? `<span class="muted">Protégé</span>` : u.statut_compte === "bloque"
                    ? `<button class="btn small outline" type="button" data-unblock-user="${u.id}">Débloquer</button>`
                    : `<button class="btn small danger" type="button" data-open-block="${u.id}">Bloquer</button>`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
  }
}

async function chargerSignalementsAdmin() {
  const cible = document.getElementById("admin-reports-list");
  if (!cible) return;
  cible.innerHTML = etatChargement("Chargement des signalements...");

  try {
    const { signalements } = await requeteAPI("/api/admin/signalements");
    adminSignalements = signalements;

    if (!signalements.length) {
      cible.innerHTML = etatVide("Aucun signalement pour le moment.");
      return;
    }

    cible.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Signalement</th>
              <th>Signalé par</th>
              <th>Utilisateur signalé</th>
              <th>Demande</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${signalements.map((s) => `
              <tr>
                <td><strong>${echapperHTML(s.motif)}</strong><br><span class="muted">${echapperHTML(s.description || "Aucune description.")}</span></td>
                <td>${echapperHTML(nomComplet(s, "signaleur_"))}<br><span class="text-small muted">${echapperHTML(s.signaleur_email)} · ${echapperHTML(s.signaleur_role)}</span></td>
                <td>${echapperHTML(nomComplet(s, "signale_"))}<br><span class="text-small muted">${echapperHTML(s.signale_email)} · ${echapperHTML(s.signale_role)}</span><br>${badgeStatut(s.signale_statut_compte)}</td>
                <td>#${s.demande_id}</td>
                <td>${formatDateHeure(s.created_at)}</td>
                <td>${s.signale_role === "admin" || s.signale_statut_compte === "bloque" ? `<span class="muted">Aucune</span>` : `<button class="btn small danger" type="button" data-open-block="${s.signale_user_id}">Bloquer</button>`}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
  }
}

async function chargerContactsAdmin() {
  const cible = document.getElementById("admin-contacts-list");
  if (!cible) return;
  cible.innerHTML = etatChargement("Chargement des messages support...");

  try {
    const query = filtreContacts ? `?statut=${filtreContacts}` : "";
    const { contacts } = await requeteAPI(`/api/admin/contacts${query}`);
    adminContacts = contacts;

    if (!contacts.length) {
      cible.innerHTML = etatVide("Aucun message support pour ce filtre.");
      return;
    }

    cible.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Message</th>
              <th>Contact</th>
              <th>Statut</th>
              <th>Dates</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${contacts.map((c) => `
              <tr>
                <td><strong>${echapperHTML(c.sujet)}</strong><br><span class="muted">${echapperHTML(tronquer(c.message, 120))}</span></td>
                <td>${echapperHTML(c.nom)}<br><span class="text-small muted">${echapperHTML(c.email)}</span></td>
                <td>${badgeStatut(c.statut)}</td>
                <td>Envoyé : ${formatDateHeure(c.created_at)}${c.date_traitement ? `<br>Traité : ${formatDateHeure(c.date_traitement)}` : ""}</td>
                <td>${c.statut === "nouveau" ? `<button class="btn small primary" type="button" data-mark-contact="${c.id}">Marquer traité</button>` : `<span class="muted">Traité</span>`}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
  }
}

async function chargerServicesAdmin() {
  const cible = document.getElementById("admin-services-list");
  if (!cible) return;
  cible.innerHTML = etatChargement("Chargement des services...");

  try {
    const { services } = await requeteAPI("/api/services");
    adminServices = services;

    if (!services.length) {
      cible.innerHTML = etatVide("Aucun service.");
      return;
    }

    cible.innerHTML = `
      <div class="grid three">
        ${services.map((service) => `
          <article class="card service-card">
            <img class="service-image" src="${echapperHTML(imageService(service))}" alt="${echapperHTML(service.nom)}" data-service-image="${echapperHTML(service.nom)}">
            <div class="card-body">
              <h3>${echapperHTML(service.nom)}</h3>
              <p class="muted">${echapperHTML(service.description || "")}</p>
              <p class="text-small muted">${echapperHTML(service.image || "Aucun chemin image")}</p>
              <div class="request-actions">
                <button class="btn small outline" type="button" data-edit-service="${service.id}">Modifier</button>
                <button class="btn small danger" type="button" data-delete-service="${service.id}">Supprimer</button>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    `;

    cible.querySelectorAll("[data-service-image]").forEach((img) => {
      gererImageService(img, img.dataset.serviceImage);
    });
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
  }
}

function ouvrirBlocage(id) {
  const utilisateur = adminUtilisateurs.find((u) => String(u.id) === String(id))
    || adminSignalements.find((s) => String(s.signale_user_id) === String(id));
  document.getElementById("block-user-id").value = id;
  document.getElementById("block-user-name").textContent = utilisateur
    ? nomComplet(utilisateur.signale_user_id ? utilisateur : utilisateur, utilisateur.signale_user_id ? "signale_" : "")
    : `Utilisateur #${id}`;
  ouvrirModale("block-modal");
}

function ouvrirServiceModal(service = null) {
  document.getElementById("service-form").reset();
  document.getElementById("service-id").value = service?.id || "";
  document.getElementById("service-modal-title").textContent = service ? "Modifier le service" : "Ajouter un service";
  document.getElementById("service-name").value = service?.nom || "";
  document.getElementById("service-description").value = service?.description || "";
  document.getElementById("service-image").value = service?.image || "";
  ouvrirModale("service-modal");
}

function initialiserActionsAdmin() {
  document.addEventListener("click", async (event) => {
    const blocage = event.target.closest("[data-open-block]");
    const debloquer = event.target.closest("[data-unblock-user]");
    const marquerContact = event.target.closest("[data-mark-contact]");
    const editService = event.target.closest("[data-edit-service]");
    const deleteService = event.target.closest("[data-delete-service]");

    if (blocage) ouvrirBlocage(blocage.dataset.openBlock);

    if (debloquer) {
      try {
        await requeteAPI(`/api/admin/users/${debloquer.dataset.unblockUser}/debloquer`, { method: "PUT" });
        afficherToast("Utilisateur débloqué.");
        chargerUtilisateursAdmin();
        chargerSignalementsAdmin();
        chargerStatsAdmin();
      } catch (error) {
        afficherToast(error.message, "error");
      }
    }

    if (marquerContact) {
      try {
        await requeteAPI(`/api/admin/contacts/${marquerContact.dataset.markContact}/traiter`, { method: "PUT" });
        afficherToast("Message marqué comme traité.");
        chargerContactsAdmin();
        chargerStatsAdmin();
      } catch (error) {
        afficherToast(error.message, "error");
      }
    }

    if (editService) {
      const service = adminServices.find((item) => String(item.id) === String(editService.dataset.editService));
      ouvrirServiceModal(service);
    }

    if (deleteService) {
      const service = adminServices.find((item) => String(item.id) === String(deleteService.dataset.deleteService));
      if (!window.confirm(`Supprimer le service "${service?.nom || deleteService.dataset.deleteService}" ?`)) return;

      try {
        await requeteAPI(`/api/admin/services/${deleteService.dataset.deleteService}`, { method: "DELETE" });
        afficherToast("Service supprimé.");
        chargerServicesAdmin();
        chargerStatsAdmin();
      } catch (error) {
        afficherToast(error.message, "error");
      }
    }
  });

  document.getElementById("block-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      await requeteAPI(`/api/admin/users/${document.getElementById("block-user-id").value}/bloquer`, {
        method: "PUT",
        body: JSON.stringify({
          motifBlocage: document.getElementById("block-reason").value.trim()
        })
      });
      afficherToast("Utilisateur bloqué.");
      fermerModale("block-modal");
      form.reset();
      chargerUtilisateursAdmin();
      chargerSignalementsAdmin();
      chargerStatsAdmin();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });

  document.getElementById("service-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = document.getElementById("service-id").value;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    const payload = {
      nom: document.getElementById("service-name").value.trim(),
      description: document.getElementById("service-description").value.trim(),
      image: document.getElementById("service-image").value.trim() || null
    };

    try {
      await requeteAPI(id ? `/api/admin/services/${id}` : "/api/admin/services", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      afficherToast(id ? "Service modifié." : "Service ajouté.");
      fermerModale("service-modal");
      form.reset();
      chargerServicesAdmin();
      chargerStatsAdmin();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });

  document.getElementById("add-service-btn")?.addEventListener("click", () => ouvrirServiceModal());

  document.querySelectorAll("[data-contact-filter]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      filtreContacts = bouton.dataset.contactFilter;
      document.querySelectorAll("[data-contact-filter]").forEach((item) => {
        item.classList.toggle("active", item === bouton);
      });
      chargerContactsAdmin();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  if (!window.utilisateurCourant || window.utilisateurCourant.role !== "admin") return;
  initialiserNavigationAdmin();
  initialiserActionsAdmin();
  chargerStatsAdmin();
  chargerUtilisateursAdmin();
  chargerSignalementsAdmin();
  chargerContactsAdmin();
  chargerServicesAdmin();
});
