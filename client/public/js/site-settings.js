document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('site-settings-form');
  if (!form) return;
  await attendreSession();
  if (window.utilisateurCourant?.role !== 'admin') return;
  const status = document.getElementById('site-settings-status');
  const fields = form.querySelector('fieldset');
  const keys = ['email','facebook','instagram','twitter','linkedin'];
  fields.disabled = true;
  try {
    const {compte} = await requeteAPI('/api/admin-settings/me');
    document.getElementById('tab-site').hidden = compte.niveau !== 'principal';
    if (compte.niveau !== 'principal') {
      status.textContent = 'La modification des coordonnées du site est réservée à l’administrateur principal.';
      return;
    }
    const {parametres} = await requeteAPI('/api/admin-settings/site');
    keys.forEach(key => {form.elements.namedItem(key).value = parametres[key];});
    fields.disabled = false;
  } catch (error) {status.textContent = error.message;}
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (fields.disabled) return;
    const body = Object.fromEntries(keys.map(key => [key,form.elements.namedItem(key).value]));
    fields.disabled = true;
    status.textContent = 'Enregistrement en cours…';
    try {
      const response = await requeteAPI('/api/admin-settings/site', {method:'PUT',body:JSON.stringify(body)});
      keys.forEach(key => {form.elements.namedItem(key).value = response.parametres[key];});
      status.textContent = response.message;
    } catch (error) {status.textContent = error.message;}
    finally {fields.disabled = false;}
  });
});
