"""Chromium component test, no connection to production. Requires playwright and Chromium.
Run: python tests/browser/request-wizard.py [output_directory]
"""
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import base64, mimetypes, os, re, sys
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2] / 'client/public'
OUT = Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/taskly-request-screens')
OUT.mkdir(parents=True, exist_ok=True)
ARTISAN = dict(id=270003, nom='SAHLI', prenom='Hocine', service_nom='Électricité', ville='Larbaâ Nath Irathen', experience=2, moyenne_notes=0, total_demandes=1, description='Électricien spécialisé dans l’installation, l’entretien et le dépannage électrique. Je propose des services de réparation de pannes, installation de prises, éclairages et tableaux électriques. Travail sérieux, rapide et soigné.')
# All displayed data are fixtures. No HTTP API or database is accessed.
BOOKED=(datetime.now(ZoneInfo('Africa/Algiers')).date()+timedelta(days=1)).isoformat()
CSS=['base.css','components.css','layout.css','auth.css','dashboards.css','responsive.css','artisan-directory-fidele.css','taskly-artisans-map.css','taskly-request-calendar.css','taskly-request-wizard.css']
def data_uri(file):
 return 'data:'+mimetypes.guess_type(file)[0]+';base64,'+base64.b64encode((ROOT/file).read_bytes()).decode()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 for width,height in [(1440,900),(390,844)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda r:r.abort())
  html=(ROOT/'artisans.html').read_text()
  html=re.sub(r'<script[^>]*>[\s\S]*?</script>','',html);html=re.sub(r'<link[^>]*>','',html)
  css='\n'.join((ROOT/'css'/f).read_text() for f in CSS);css=re.sub(r'^@import.*$','',css,flags=re.M)
  html=html.replace('</head>','<style>'+css+'</style></head>')
  logo=data_uri('images/logo/taskly-logo.svg');avatar=data_uri('images/defaults/avatar.png')
  html=html.replace('/images/logo/taskly-logo.svg',logo).replace('/images/defaults/avatar.png',avatar)
  page.set_content(html)
  page.evaluate('''({avatar,booked,logo})=>{
    window.sent=[];window.failSend=false;window.DEFAULT_AVATAR=avatar;
    window.nomComplet=a=>a.prenom+' '+a.nom;window.imageProfil=()=>avatar;
    window.utilisateurCourant={role:'client'};window.afficherToast=()=>{};
    window.echapperHTML=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    window.afficherEtoiles=()=>'';window.noteArtisan=()=> 'Nouveau';
    window.requeteAPI=async(url,opts)=>{if(url==='/api/artisans/270003')return {artisan:window.fixture};if(url.includes('dates-indisponibles'))return {dates:[booked]};if(url==='/api/demandes'){sent.push(JSON.parse(opts.body));if(failSend)throw Error('Échec simulé');return {demandeId:123};}throw Error('Unexpected API');};
    document.querySelector('#site-header').innerHTML='<header class="site-header"><div class="container header-inner"><a class="brand"><img src="'+logo+'" alt="Taskly"></a></div></header>';
  }''',{'avatar':avatar,'booked':BOOKED,'logo':logo})
  # Use the real card generator, without bootstrapping the unrelated network-backed directory.
  cards=(ROOT/'js/artisans.js').read_text().split('// La page ne conserve')[0]
  page.add_script_tag(content=cards)
  page.evaluate('''a=>{document.querySelector('#artisans-grid').innerHTML=carteArtisan(a)+carteArtisan({...a,id:270002,service_nom:'Plomberie'});document.querySelector('#artisans-grid').scrollIntoView({block:'center'});}''',ARTISAN)
  for script in ['taskly-request-calendar.js','taskly-request-wizard.js']:
   page.add_script_tag(content=(ROOT/'js'/script).read_text())
  page.evaluate('a=>window.fixture=a',ARTISAN)
  source=(ROOT/'js/artisans.js').read_text();page.add_script_tag(content=source[source.index('// Ouvrir la modale de demande'):source.index('// Charger le profil public')])
  page.evaluate('document.dispatchEvent(new Event("DOMContentLoaded")); initialiserDemandeArtisan()')
  page.locator('[data-open-request]').first.click();page.locator('#request-modal[open]').wait_for()
  page.locator('#rw-next').click();assert page.locator('#rw-error').is_visible()
  page.locator('#request-message').fill('Mon compteur disjoncte régulièrement.')
  page.locator('.rw-types label').first.click();page.screenshot(path=str(OUT/f'Taskly_demandes_{width}.png'))
  page.locator('#rw-next').click();page.locator('#rw-next').click();assert page.locator('#rw-error').is_visible()
  page.locator('#request-address').fill('Adresse de test');page.locator('#rw-back').click();assert page.locator('#request-message').input_value()=='Mon compteur disjoncte régulièrement.'
  page.locator('#rw-next').click();assert page.locator('#request-address').input_value()=='Adresse de test';page.locator('#rw-next').click()
  page.locator('.taskly-calendar-launch').click();page.locator('[data-calendar-day]').first.wait_for()
  booked=page.locator(f'[data-calendar-day="{BOOKED}"]')
  if not booked.count():
   page.locator('[data-calendar-next]').click();booked=page.locator(f'[data-calendar-day="{BOOKED}"]')
  assert booked.is_disabled();page.screenshot(path=str(OUT/f'Taskly_calendrier_{width}.png'))
  page.locator('[data-calendar-day]:not([disabled])').first.click();selected=page.locator('#request-date').input_value();assert selected
  page.evaluate('window.failSend=true');page.locator('#rw-submit').click();assert page.locator('#rw-error').is_visible();assert not page.locator('#rw-success').is_visible()
  page.evaluate('window.failSend=false;window.sent=[]');page.locator('#rw-submit').click();page.locator('#rw-success').wait_for()
  sent=page.evaluate('window.sent');assert len(sent)==1 and sent[0]['artisanId']==270003 and sent[0]['dateSouhaitee']==selected and 'Dépannage' in sent[0]['message']
  assert page.locator('#rw-success a').is_visible() and not errors
  print(f'{width}x{height}: formulaire, validations, retour, indisponibilités, erreur API et réussite OK; aucune exception JS')
  page.close()
 browser.close()
