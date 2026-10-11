'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('actions de compte : même formulaire déplacé dans une fenêtre modale, retour et mot de passe effacé',()=>{
 function node(){return {dataset:{},children:[],listeners:{},append(...items){items.forEach(item=>{item.parent=this;this.children.push(item);});},setAttribute(){},addEventListener(n,fn){this.listeners[n]=fn;},focus(){this.focused=true;},showModal(){this.modal=true;},close(){this.modal=false;this.listeners.close?.();},querySelectorAll:()=>[]};}
 const body=node(),password={value:'secret-de-test'};
 const edit=node();const details=node();details.open=false;details.classList={contains:name=>name==='account-danger'};
 details.querySelector=()=>({textContent:'Supprimer mon compte'});details.querySelectorAll=()=>[password];
 const target=node();target.querySelector=selector=>selector==='#account-edit-form'?edit:selector==='h3'?{remove(){}}:null;
 target.querySelectorAll=()=>[details];
 const sandbox={window:{},document:{body,createElement:node,querySelector:()=>null,getElementById:()=>null,addEventListener(){}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../client/public/js/workspace-dialogs.js'),'utf8'),sandbox);
 const originalHandler=()=>{};edit.listeners.submit=originalHandler;
 sandbox.window.installerActionsCompte(target);
 assert.equal(body.children.length,2);assert.equal(edit.listeners.submit,originalHandler);
 assert.equal(body.children[0].children[1].children[0],edit,'Le formulaire doit être déplacé, jamais cloné');
 const deleteAction=target.children[0].children[1];deleteAction.listeners.click();
 const dialog=body.children[1];assert.equal(dialog.modal,true,'showModal doit désactiver le fond');
 dialog.children[0].children[1].listeners.click();
 assert.equal(dialog.modal,false);assert.equal(password.value,'');assert.equal(deleteAction.focused,true);
 sandbox.window.installerActionsCompte(target);assert.equal(body.children.length,2,'Pas de double installation');
});
