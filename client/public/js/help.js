const questionsFaq = [
  {
    categorie: "general",
    question: "Comment trouver un artisan ?",
    reponse: "Ouvrez la page Artisans, choisissez un service, puis utilisez la wilaya et la commune pour affiner les profils disponibles."
  },
  {
    categorie: "clients",
    question: "Comment envoyer une demande ?",
    reponse: "Connectez-vous comme client, ouvrez un profil artisan et indiquez votre message, l'adresse et la date souhaitée."
  },
  {
    categorie: "artisans",
    question: "Comment devenir artisan ?",
    reponse: "La page Devenir artisan permet de créer un compte séparé, de choisir un service et de présenter votre expérience."
  },
  {
    categorie: "avis",
    question: "Comment laisser un avis ?",
    reponse: "Un avis peut être laissé depuis l'espace client uniquement après une demande marquée comme terminée."
  },
  {
    categorie: "support",
    question: "Que faire si mon compte est bloqué ?",
    reponse: "Le message de connexion affiche le motif du blocage. Vous pouvez contacter le support pour demander plus d'informations."
  },
  {
    categorie: "support",
    question: "Comment contacter le support ?",
    reponse: "Utilisez la page Contact. Après l'envoi, Taskly affiche un numéro de suivi à conserver."
  },
  {
    categorie: "avis",
    question: "Comment signaler un utilisateur ?",
    reponse: "Un signalement est possible seulement depuis une demande existante entre le client et l'artisan."
  },
  {
    categorie: "clients",
    question: "Comment suivre l'état de ma demande ?",
    reponse: "L'espace client affiche vos demandes avec leurs statuts : en attente, acceptée, refusée, annulée ou terminée."
  },
  {
    categorie: "support",
    question: "Comment modifier ma photo de profil ?",
    reponse: "Dans votre dashboard, ouvrez Mon profil, choisissez une image JPG, PNG ou WEBP puis validez la mise à jour."
  },
  {
    categorie: "general",
    question: "Comment choisir le bon service ?",
    reponse: "Lisez la description du service et comparez les artisans liés. En cas de doute, choisissez le service le plus proche de votre besoin."
  },
  {
    categorie: "avis",
    question: "Pourquoi je ne peux pas laisser un avis ?",
    reponse: "Taskly autorise un seul avis par demande terminée. Les demandes en attente, refusées ou annulées ne peuvent pas recevoir d'avis."
  },
  {
    categorie: "avis",
    question: "Pourquoi je ne peux pas signaler un utilisateur ?",
    reponse: "Les signalements sont liés à une relation réelle. Il faut donc une demande existante entre les deux comptes."
  },
  {
    categorie: "support",
    question: "Comment suivre un message envoyé au support ?",
    reponse: "Sur la page Contact, entrez le numéro de suivi et l'adresse email utilisée lors de l'envoi."
  },
  {
    categorie: "clients",
    question: "Que faire si aucun artisan n'est disponible dans ma commune ?",
    reponse: "Essayez une commune proche, supprimez le filtre de commune ou consultez un service voisin."
  },
  {
    categorie: "artisans",
    question: "Comment un artisan accepte ou refuse une demande ?",
    reponse: "Depuis l'espace artisan, chaque demande en attente affiche des boutons pour accepter ou refuser."
  },
  {
    categorie: "avis",
    question: "Comment l'admin gère les signalements ?",
    reponse: "L'admin consulte les signalements liés aux demandes et peut bloquer un compte avec un motif clair."
  },
  {
    categorie: "support",
    question: "Est-ce que mes informations sont protégées ?",
    reponse: "Taskly garde les données nécessaires au compte, aux demandes, aux avis et au support. Les règles sont détaillées dans la page Confidentialité."
  }
];

let categorieFaq = "general";

// Afficher les questions du centre d'aide
function afficherFaq() {
  const cible = document.getElementById("faq-list");
  if (!cible) return;

  const recherche = normaliserTexte(document.getElementById("faq-search")?.value || "");
  const questions = questionsFaq.filter((item) => {
    const memeCategorie = categorieFaq === "general" || item.categorie === categorieFaq || item.categorie === "general";
    const memeRecherche = normaliserTexte(item.question + " " + item.reponse).includes(recherche);
    return memeCategorie && memeRecherche;
  });

  if (!questions.length) {
    cible.innerHTML = etatVide("Aucune question ne correspond à votre recherche.");
    return;
  }

  cible.innerHTML = questions.map((item, index) => `
    <article class="faq-item">
      <button class="faq-question" type="button" data-faq-toggle>
        <span>${echapperHTML(item.question)}</span>
        <span>⌄</span>
      </button>
      <div class="faq-answer">
        ${echapperHTML(item.reponse)}
      </div>
    </article>
  `).join("");
}

// Ouvrir et fermer les réponses FAQ
function initialiserFaq() {
  document.getElementById("faq-search")?.addEventListener("input", afficherFaq);

  document.querySelectorAll("[data-faq-category]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      categorieFaq = bouton.dataset.faqCategory;
      document.querySelectorAll("[data-faq-category]").forEach((item) => {
        item.classList.toggle("active", item === bouton);
      });
      afficherFaq();
    });
  });

  document.addEventListener("click", (event) => {
    const bouton = event.target.closest("[data-faq-toggle]");
    if (!bouton) return;
    bouton.closest(".faq-item").classList.toggle("open");
  });

  afficherFaq();
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  initialiserFaq();
});
