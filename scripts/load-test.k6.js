// Test limité aux lectures publiques. Jamais contre la production.
// Test local : TASKLY_LOAD_TEST=YES k6 run scripts/load-test.k6.js
// Préproduction : TASKLY_LOAD_TEST=YES TARGET_URL=https://<preview> PREVIEW_HOST=<preview> k6 run scripts/load-test.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';
const base=String(__ENV.TARGET_URL||'http://localhost:3000').replace(/\/$/,'');
const local=/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(base);
const preview=/^https:\/\/([a-z0-9][a-z0-9.-]*\.vercel\.app)$/.exec(base);
if(__ENV.TASKLY_LOAD_TEST!=='YES'||(!local&&(!preview||preview[1]!==__ENV.PREVIEW_HOST||preview[1]==='taskly-platform-sigma.vercel.app'))){
 throw new Error('Test refusé : utilisez localhost ou indiquez explicitement un hôte Vercel de préproduction autorisé.');
}
const vus=Number(__ENV.TASKLY_VUS||5);
if(!Number.isInteger(vus)||vus<1||vus>25)throw new Error('Maximum 25 utilisateurs virtuels pour ce test initial.');
export const options={stages:[{duration:'15s',target:vus},{duration:'45s',target:vus},{duration:'15s',target:0}],
  thresholds:{http_req_failed:['rate<0.01'],checks:['rate>0.99'],http_req_duration:['p(95)<2000']},maxRedirects:0};
export default function(){const r=http.get(base+'/api/services',{timeout:'10s',redirects:0});check(r,{'HTTP 200':v=>v.status===200});sleep(Math.random()*3+1);}
