import assert from 'node:assert/strict';
import {createWorld,performAction} from '../src/game/engine.js';
import {allLevels} from '../src/game/levels.js';
import {shortestDistance} from '../src/game/searchLevels.js';
for(const l of allLevels){
  assert.equal(l.map.length,8);
  assert(l.map.every(r=>r.length===8));
  assert.notEqual(l.map[l.start.y][l.start.x],'#');
  if(l.target) assert(Number.isFinite(shortestDistance(l.map,l.start,l.target)));
}
const l=allLevels.find(l=>l.id==='2-3'), w=createWorld(l);
const act=(name,arg)=>performAction(w,name,arg);
assert.equal(act('can_move','up').value,false);
assert.equal(act('can_move','right').value,true);
act('mark',JSON.stringify([0,0,'frontier']));
act('mark',JSON.stringify([0,0,'visited']));
assert.equal(w.tick,0);assert.equal(w.stats.moves,0);assert.equal(w.stats.explored,1);
assert.throws(()=>act('mark',JSON.stringify([1,1,'visited'])));
assert.throws(()=>act('mark',JSON.stringify([0,0,'red'])));
assert.throws(()=>act('can_move','east'));
act('move','up');assert.equal(w.stats.moves,0);
act('move','right');assert.equal(w.stats.moves,1);
const copy=structuredClone(w);act('move','right');assert.equal(copy.robot.x,1);
assert.equal(l.check({world:w}).pass,false);
const detour=structuredClone(w);detour.robot={...detour.robot,...l.target};detour.stats.moves=16;
assert.equal(l.check({world:detour}).pass,false);
detour.stats.moves=14;assert.equal(l.check({world:detour}).pass,true);
assert.deepEqual(createWorld(l).marks,{});
console.log(`PASS: ${allLevels.length} maps reachable; sensors, marks, snapshots, bounds and shortest-route verdicts`);
