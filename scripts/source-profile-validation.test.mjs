import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAdminProfiles,adminOperation} from '../worker/admin.js';

const profile=extra=>({id:'profile-one',name:'Nom affiché',enabled:true,priority:25,...extra});
test('Les profils enregistrés utilisent les mêmes adresses canoniques que la recherche',()=>{
 const [value]=validateAdminProfiles([profile({x:'@ANSSI_FR',linkedin:'https://www.linkedin.com/in/chercheur/'})]);
 assert.equal(value.x,'anssi_fr');assert.equal(value.linkedin,'https://www.linkedin.com/in/chercheur/');assert.equal(value.priority,25);
 assert.equal(validateAdminProfiles([profile({x:'https://twitter.com/ANSSI_FR'})])[0].x,'anssi_fr');
});
test('Un compte présent sous deux identifiants de ligne est refusé après canonisation',()=>{
 assert.throws(()=>validateAdminProfiles([profile({x:'ANSSI_FR'}),profile({id:'profile-two',x:'@anssi_fr'})]),/déjà/);
 assert.throws(()=>validateAdminProfiles([profile({linkedin:'https://linkedin.com/in/chercheur'}),profile({id:'profile-two',linkedin:'https://www.linkedin.com/in/chercheur/'})]),/déjà/);
});
test('Les routes sociales et les séparateurs encodés ne sont pas des profils enregistrables',()=>{
 for(const x of ['https://x.com/search','https://x.com/home','https://x.com/anssi_fr/status/123','https://x.com.evil.org/anssi_fr','a'.repeat(16)])assert.throws(()=>validateAdminProfiles([profile({x})]),x);
 for(const linkedin of ['https://www.linkedin.com/company/entreprise/','https://www.linkedin.com/in/personne%2Fposts/','https://www.linkedin.com/in/personne%5Cposts/','https://www.linkedin.com/feed/update/123/'])assert.throws(()=>validateAdminProfiles([profile({linkedin})]),linkedin);
});
test('Les limites de profils et les préférences de lignes restent conservées',()=>{
 assert.throws(()=>validateAdminProfiles(Array.from({length:31},(_,i)=>profile({id:'profile-'+i,x:'account'+i}))));
 const [value]=validateAdminProfiles([profile({name:' Alias personnel ',enabled:false,priority:120})]);assert.equal(value.name,'Alias personnel');assert.equal(value.enabled,false);assert.equal(value.priority,100);
});
test('Un flux existant peut être modifié, mais pas ajouté une seconde fois sous un autre nom',async()=>{
 const data=new Map(),storage={get:async key=>structuredClone(data.get(key)),put:async(key,value)=>data.set(key,structuredClone(value)),delete:async key=>data.delete(key),transaction:work=>work(storage)},source={id:'existing',name:'Source existante',url:'https://www.cert.ssi.gouv.fr/feed/',home:'https://www.cert.ssi.gouv.fr/',enabled:true,intervalMinutes:60};
 const duplicate=await adminOperation(storage,[source],{action:'save',revision:0,source:{...source,id:'custom-other',name:'Autre nom'}});assert.equal(duplicate.status,400);assert.match(duplicate.error,/déjà/);assert.equal(data.has('admin:config'),false);
 const edited=await adminOperation(storage,[source],{action:'save',revision:0,source:{...source,name:'Nom modifié'}});assert.equal(edited.ok,true);assert.equal(data.get('admin:config').overrides.existing.name,'Nom modifié');
});
