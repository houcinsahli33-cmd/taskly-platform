// Executer avec k6 sur un environnement DE TEST uniquement : k6 run scripts/load-test.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';
export const options={stages:[{duration:'1m',target:100},{duration:'2m',target:1000},{duration:'2m',target:0}],
  thresholds:{http_req_failed:['rate<0.01'],http_req_duration:['p(95)<2000']}};
const base=__ENV.TARGET_URL||'http://localhost:3000';
export default function(){const r=http.get(base+'/api/services');check(r,{'HTTP 200':v=>v.status===200});sleep(Math.random()*3+1);}
// NE PAS lancer 10 000 utilisateurs sans capacite de test adaptee et consentement de l'hebergeur.
