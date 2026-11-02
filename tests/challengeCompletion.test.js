import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
async function setup(completed = [], conflict = false) {
 const commits = [];
 const context = vm.createContext({ console, Date, Intl, String, Array, Error });
 const dependency = new vm.SyntheticModule(['getAuthUserByIdToken','getDocumentVersion','commitUserPointDelta'],function(){
  this.setExport('getAuthUserByIdToken',async()=>({uid:'student'}));
  this.setExport('getDocumentVersion',async()=>({data:{points:7,completedChallenges:completed},updateTime:'version-1'}));
  this.setExport('commitUserPointDelta',async payload=>{commits.push(payload);if(conflict)throw Object.assign(new Error('Conflict'),{statusCode:409});completed=payload.userFields.completedChallenges;return {pointsAwarded:payload.points};});
 },{context});
 const mod = new vm.SourceTextModule(await fs.readFile(new URL('../api/points/challenge.js',import.meta.url),'utf8'),{context});
 await mod.link(()=>dependency);await mod.evaluate();
 const request = async body => {const res={code:0,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(){}};await mod.namespace.default({method:'POST',headers:{authorization:'Bearer test'},body},res);return res;};
 return {request,commits};
}
test('automatic completion is idempotent and retains completed lessons',async()=>{
 const {request,commits}=await setup(['other']);
 assert.equal((await request({challengeId:'lesson',action:'complete'})).body.pointsAwarded,7);
 assert.equal((await request({challengeId:'lesson',action:'complete'})).body.pointsAwarded,0);
 assert.equal(commits.length,1);assert.equal(commits[0].userUpdateTime,'version-1');
 assert.deepEqual(Array.from(commits[0].userFields.completedChallenges),['other','lesson']);
});
test('manual toggle still removes completion and points',async()=>{
 const {request}=await setup(['lesson']);const res=await request({challengeId:'lesson'});assert.equal(res.body.pointsAwarded,-7);assert.equal(res.body.completedChallenges.length,0);
});
test('concurrent change reports conflict instead of success',async()=>{
 const {request}=await setup([],true);assert.equal((await request({challengeId:'lesson',action:'complete'})).code,409);
});
