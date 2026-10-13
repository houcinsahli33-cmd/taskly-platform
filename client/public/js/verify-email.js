document.addEventListener('DOMContentLoaded', async () => {
  const formulaire = document.getElementById('verify-form');
  const champCode = document.getElementById('verify-code');
  const status = document.getElementById('verify-status');
  const adresse = document.getElementById('verify-address');
  const countdown = document.getElementById('verify-countdown');
  const attempts = document.getElementById('attempts-left');
  const renvoyer = document.getElementById('resend-code');
  const soumettre = formulaire.querySelector('[type="submit"]');

  let limiteLocale = 0;
  let essaisRestants = 0;
  let actif = false;
  let timer = null;

  function notification(message, erreur = false) {
    status.textContent = message;
    status.classList.toggle('error', erreur);
  }

  function rendre() {
    const secondes = Math.max(0, Math.ceil((limiteLocale - Date.now()) / 1000));
    countdown.textContent = `${String(Math.floor(secondes / 60)).padStart(2,'0')}:${String(secondes % 60).padStart(2,'0')}`;
    attempts.textContent = String(Math.max(0,essaisRestants));
    soumettre.disabled = !actif || secondes <= 0 || essaisRestants <= 0;
    if (actif && secondes <= 0 && !status.textContent) notification('Code expiré. Demandez un nouveau code.', true);
  }

  function synchroniser(etat) {
    essaisRestants = Math.max(0,Number(etat.tentativesRestantes)||0);
    limiteLocale = Date.now() + Math.max(0,Number(etat.secondesRestantes)||0) * 1000;
    actif = true;
    rendre();
  }

  try {
    const data = await requeteAPI('/api/auth/pending');
    adresse.textContent = data.email;
    synchroniser(data);
  } catch (error) {
    actif = false;
    notification(error.message || 'Aucune vérification en cours. Reconnectez-vous.', true);
    rendre();
    renvoyer.disabled = true;
  }
  timer = setInterval(rendre,1000);

  champCode.addEventListener('input', () => {
    champCode.value = champCode.value.replace(/\D/g,'').slice(0,6);
  });

  formulaire.addEventListener('submit',async (event) => {
    event.preventDefault();
    if (!actif || soumettre.disabled) return;
    const code = champCode.value.trim();
    if (!/^\d{6}$/.test(code)) return notification('Entrez les 6 chiffres de votre code.',true);
    soumettre.disabled = true;
    notification('Vérification en cours…');
    try {
      const data = await requeteAPI('/api/auth/verify-email',{
        method:'POST',body:JSON.stringify({code})
      });
      actif = false;
      clearInterval(timer);
      if(data.choixCompteRequis){window.location.replace(data.choixUrl);return;}
      if(data.supportSeulement){window.location.replace(data.supportUrl);return;}
      notification('Code validé ! Ouverture de votre espace…');
      const role = data.utilisateur?.role;
      const pending=Number(sessionStorage.getItem('tasklyReportPending'));
      if(role==='client' && Number.isSafeInteger(pending) && pending>0){
        window.location.replace('/espace/client/demandes?signaler='+pending);return;
      }
      window.location.replace(role === 'artisan' ? '/artisan-dashboard.html' : '/client-dashboard.html');
    } catch (error) {
      notification(error.message || 'Le code n’a pas pu être vérifié.',true);
      if (error.data && typeof error.data.tentativesRestantes === 'number') synchroniser(error.data);
      else {
        try { synchroniser(await requeteAPI('/api/auth/pending')); }
        catch { actif = false; }
      }
      rendre();
    }
  });

  renvoyer.addEventListener('click',async () => {
    renvoyer.disabled = true;
    notification('Envoi d’un nouveau code…');
    try {
      const data = await requeteAPI('/api/auth/resend-email', {method:'POST',body:'{}'});
      champCode.value = '';
      synchroniser(data);
      notification('Nouveau code envoyé. Consultez votre boîte Gmail.');
    } catch (error) {
      notification(error.message || 'Envoi impossible. Réessayez dans quelques instants.',true);
      try { synchroniser(await requeteAPI('/api/auth/pending')); }
      catch { actif = false; }
    } finally {
      renvoyer.disabled = !actif;
      rendre();
    }
  });
});
