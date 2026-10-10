// Exécute Express avec de vrais objets HTTP Node, sans ouvrir de port TCP.
// Ne remplace ni les middlewares, ni les routes, ni les vérifications testées.
const {IncomingMessage,ServerResponse}=require('node:http');
const {Duplex}=require('node:stream');
module.exports=function request(app,url,options={}){
 return new Promise((resolve,reject)=>{
  const chunks=[];
  const socket=new Duplex({read(){},write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});
  socket.remoteAddress='127.0.0.1';socket.encrypted=false;
  const req=new IncomingMessage(socket);
  req.method=(options.method||'GET').toUpperCase();req.url=url;
  req.httpVersion='1.1';req.httpVersionMajor=1;req.httpVersionMinor=1;
  req.complete=true;
  req.headers=Object.fromEntries(Object.entries(options.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
  req.headers.host='localhost';
  const body=options.body===undefined?null:Buffer.from(options.body);
  if(body)req.headers['content-length']=String(body.length);
  const res=new ServerResponse(req);res.assignSocket(socket);
  const timer=setTimeout(()=>{socket.destroy();reject(Error('La réponse Express ne se termine pas.'));},5000);
  res.on('error',error=>{clearTimeout(timer);reject(error);});
  res.on('finish',()=>{
   clearTimeout(timer);
   const wire=Buffer.concat(chunks),separator=wire.indexOf('\r\n\r\n');
   let data=separator>=0?wire.subarray(separator+4):Buffer.alloc(0);
   if(res.getHeader('transfer-encoding')==='chunked'){
    const pieces=[];let offset=0;
    while(offset<data.length){const line=data.indexOf('\r\n',offset);if(line<0)break;const size=parseInt(data.subarray(offset,line).toString().split(';')[0],16);if(!Number.isFinite(size)||size===0)break;offset=line+2;pieces.push(data.subarray(offset,offset+size));offset+=size+2;}
    data=Buffer.concat(pieces);
   }
   resolve({status:res.statusCode,headers:{get(name){const v=res.getHeader(name);return Array.isArray(v)?v.join(', '):v===undefined?null:String(v);}},json:async()=>JSON.parse(data.toString()),text:async()=>data.toString()});
   socket.destroy();
  });
  app(req,res);
  if(body)req.push(body);req.push(null);
 });
};
