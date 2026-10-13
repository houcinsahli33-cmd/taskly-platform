window.TASKLY_ADMIN_CONTEXT = true;
document.addEventListener('DOMContentLoaded', () => {
  if (new URLSearchParams(location.search).get('session') === 'expiree') {
    const message = document.getElementById('admin-alert');
    if (message) {message.textContent='Votre session administrateur a expiré. Reconnectez-vous.';message.setAttribute('role','status');}
  }
  const formulaire = document.getElementById('admin-login-form');
  const codeForm = document.getElementById('admin-code-form');
  const info = document.getElementById('admin-alert');
  const email = document.getElementById('admin-email');
  const password = document.getElementById('admin-password');
  const codeInput = document.getElementById('admin-code');
  const timerElement = document.getElementById('admin-code-timer');
  const title = document.getElementById('admin-title');
  const description = document.getElementById('admin-description');
  const toggle = document.getElementById('admin-toggle-password');
  const back = document.getElementById('admin-back');
  const basePath = window.location.pathname.replace(/\/$/, '');
  const authApiBase = `/api${basePath}/auth`;

  let timer = null;
  let expiration = 0;
  let tentativesLocales = 0;

  function afficherEtat(message, erreur = false) {
    info.textContent = message;
    info.classList.toggle('is-error', erreur);
  }

  function rafraichirCompteur() {
    const restantes = Math.max(0, Math.ceil((expiration - Date.now()) / 1000));
    timerElement.textContent = `${String(Math.floor(restantes / 60)).padStart(2, '0')}:${String(restantes % 60).padStart(2, '0')}`;
    if (restantes === 0) {
      timerElement.classList.add('is-expired');
      codeForm.querySelector('button[type="submit"]').disabled = true;
      afficherEtat('Code expiré. Revenez à la connexion pour en demander un autre.', true);
      clearInterval(timer);
    }
  }

  function afficherEtapeCode() {
    formulaire.hidden = true;
    codeForm.hidden = false;
    title.textContent = 'Vérification sécurisée';
    description.textContent = 'Un code à 6 chiffres a été envoyé sur votre adresse administrateur.';
    afficherEtat('Saisissez le code reçu. Il expire après 3 minutes.');
    expiration = Date.now() + 3 * 60 * 1000;
    tentativesLocales = 0;
    clearInterval(timer);
    rafraichirCompteur();
    timer = setInterval(rafraichirCompteur, 1000);
    codeInput.focus();
  }

  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Masquer' : 'Voir';
    toggle.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    toggle.setAttribute('aria-pressed', String(visible));
  });

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
  });

  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!email.value.trim() || !password.value) return afficherEtat('Saisissez votre e-mail et votre mot de passe.', true);
    const bouton = formulaire.querySelector('button[type="submit"]');
    bouton.disabled = true;
    afficherEtat('Vérification de vos identifiants…');
    try {
      await requeteAPI(`${authApiBase}/login`, {
        method: 'POST',
        body: JSON.stringify({ email: email.value.trim(), motDePasse: password.value })
      });
      password.value = '';
      afficherEtapeCode();
    } catch (err) {
      afficherEtat(err.message || 'Connexion impossible.', true);
    } finally {
      bouton.disabled = false;
    }
  });

  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) return afficherEtat('Le code doit contenir exactement 6 chiffres.', true);
    if (Date.now() >= expiration) return afficherEtat('Code expiré. Revenez à la connexion.', true);
    const bouton = codeForm.querySelector('button[type="submit"]');
    bouton.disabled = true;
    afficherEtat('Validation du code…');
    try {
      await requeteAPI(`${authApiBase}/verify`, {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      clearInterval(timer);
      window.location.replace(`${basePath}/dashboard`);
    } catch (err) {
      tentativesLocales++;
      afficherEtat(err.message || 'Code invalide.', true);
      if (tentativesLocales >= 3) {
        bouton.disabled = true;
        afficherEtat('Trois essais ont été utilisés. Revenez à la connexion pour demander un nouveau code.', true);
      }
    } finally {
      if (tentativesLocales < 3) bouton.disabled = false;
    }
  });

  back.addEventListener('click', () => {
    clearInterval(timer);
    codeForm.hidden = true;
    formulaire.hidden = false;
    codeInput.value = '';
    title.textContent = 'Connexion administrateur';
    description.textContent = 'Accès privé à la gestion des artisans, utilisateurs et signalements.';
    afficherEtat('Pour votre sécurité, une nouvelle connexion demandera un nouveau code.');
  });
});
