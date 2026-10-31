import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {evaluate,inspect,safeError} from './evaluator.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const port=Number(process.env.PORT||4173);
const remote=process.env.POWERFX_NATIVE_URL;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json; charset=utf-8'};
function json(res,body,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
async function body(req){let raw='';for await(const part of req){raw+=part.toString();if(raw.length>1048576)throw new Error('Solicitud demasiado grande');}return JSON.parse(raw);}
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(req.method==='GET'&&pathname==='/api/status')return json(res,{ok:true,nativeCanvas:Boolean(remote),version:'0.2.0',flow:'WDL subset',localCanvas:'Power Fx subset'});
    if(req.method==='POST'&&['/api/evaluate','/api/analyze'].includes(pathname)){
      const data=await body(req);
      if(typeof data.formula!=='string')return json(res,{success:false,error:{message:'Falta formula'}},400);
      if(pathname==='/api/analyze')return json(res,inspect(data));
      if(data.platform==='canvas'&&remote){
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3500);
        try{
          const response=await fetch(new URL('/evaluate',remote),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
          return json(res,await response.json(),response.ok?200:422);
        }finally{clearTimeout(timer);}
      }
      return json(res,evaluate(data));
    }
    if(req.method!=='GET')return json(res,{error:'Método no permitido'},405);
    let filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!filename.startsWith(root+path.sep)&&filename!==root)return json(res,{error:'Ruta prohibida'},403);
    try{const s=await stat(filename);if(s.isDirectory())filename=path.join(filename,'index.html');}
    catch{return json(res,{error:'No encontrado'},404);}
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'"});res.end(await readFile(filename));
  }catch(e){json(res,safeError(e),422);}
});
server.listen(port,()=>console.log(`Power Fx Playground → http://localhost:${port} (${remote?'native Canvas':'local Canvas subset'})`));
