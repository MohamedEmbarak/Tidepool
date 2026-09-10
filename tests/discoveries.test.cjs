const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript');
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),{exports,require:n=>deps[n]});return exports}
const catalog=load('src/world/catalog.ts'),{DiscoveryLocks}=load('src/world/discoveries.ts',{'./catalog':catalog});

test('the fish requires holding, the arch takes three strikes, and the chest must open before collection',()=>{
  const found=new Set(),locks=new DiscoveryLocks(found);
  assert.equal(locks.interact('amber','tap'),'hold-needed');assert.equal(catalog.canCollect('amber',found,locks.opened),false);
  assert.equal(locks.interact('amber','hold'),'opened');assert.equal(locks.interact('amber','tap'),'collect');
  for(const expected of ['cracked','cracked','opened'])assert.equal(locks.interact('rune','tap'),expected);
  assert.equal(locks.interact('rune','tap'),'collect');assert.equal(locks.archHits,3);
  assert.equal(locks.interact('medallion','tap'),'opened');assert.equal(locks.interact('medallion','tap'),'collect');
  assert.equal(locks.interact('moon','tap'),'sealed');
  for(const id of catalog.SEAL_IDS)found.add(id);
  assert.equal(locks.interact('moon','tap'),'collect');found.add('moon');assert.equal(locks.interact('moon','tap'),'none');
  locks.reset();assert.equal(locks.opened.size,0);assert.equal(locks.archHits,0);
});

test('legacy hiding places and finds survive the expansion while the moon requires every new seal',()=>{
  const random=catalog.randomSequence(42173),locations=catalog.discoveryLocations(42173);
  for(const id of ['pearl','bottle','compass','key','lantern','moon']){const at=locations.find(r=>r.id===id);assert.equal(at.x,(random()-.5)*6.4);assert.equal(at.z,.3+random()*2.1)}
  const legacy=catalog.readFinds('["pearl","bottle","compass","key","lantern","moon"]');
  assert.equal(legacy.length,5);assert.ok(!legacy.includes('moon'));assert.ok(legacy.includes('lantern'));
  assert.equal(catalog.readFinds(JSON.stringify(catalog.RELICS.map(r=>r.id))).length,9);
});

test('rune seals match all prerequisites, break individually, and reuse buffers and texture over resets',async()=>{
  const T=await import('three'),{createSeals}=load('src/world/seals.ts',{three:T,'./catalog':catalog});
  const found=new Set(),seals=createSeals(found),mesh=seals.root.children[0],geometry=mesh.geometry,material=mesh.material,texture=material.uniforms.uGlyphs.value,progress=seals.progress;
  assert.equal(seals.count,catalog.RELICS.length-1);assert.equal(seals.remaining(),8);assert.equal(seals.root.children.length,1);
  for(const [i,id]of catalog.SEAL_IDS.entries()){assert.equal(seals.breakSeal(id),true);assert.equal(seals.breakSeal(id),false);seals.update(.5,1,new T.Quaternion(),false);assert.ok(progress[i]>0&&progress[i]<1);assert.equal(seals.remaining(),7-i)}
  seals.update(2,2,new T.Quaternion(),false);assert.equal(mesh.visible,false);
  for(let i=0;i<40;i++){seals.reset(found);seals.update(0,0,new T.Quaternion(),true);assert.equal(seals.remaining(),8);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(seals.progress,progress);assert.equal(material.uniforms.uGlyphs.value,texture)}
  assert.ok(texture.image.data.byteLength<=128*1024);assert.ok(geometry.attributes.position.count<300);
  const {disposeObject}=load('src/world/assets.ts',{three:T});let released=0;texture.addEventListener('dispose',()=>released++);
  disposeObject(seals.root);assert.equal(released,1,'shader-owned inscription texture is released during teardown');
});

test('drawing buffers stay capped even on large high-density displays and memory-constrained devices',()=>{
  const {renderPixelRatio}=load('src/world/resources.ts');
  for(const [w,h,dpr,memory]of [[390,844,3,4],[3840,2160,3,8],[844,390,3,2],[320,568,1,8]]){
    const r=renderPixelRatio(w,h,dpr,memory);assert.ok(w*h*r*r<=(memory<=4?1000000:2000000)+1);assert.ok(r>0&&r<=dpr);
  }
});

test('the scallop opens about its rear hinge and preserves its bowl and geometry',async()=>{
  const T=await import('three'),buffers=await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const models=load('src/world/models.ts',{three:T,'./catalog':catalog,'three/examples/jsm/utils/BufferGeometryUtils.js':buffers});
  const shell=models.shellModel(),hinge=shell.lid.position.clone(),lower=shell.group.children[0];shell.group.updateMatrixWorld(true);
  const before=new T.Box3().setFromObject(lower);shell.lid.rotation.x=-1.18;shell.group.updateMatrixWorld(true);
  assert.ok(new T.Box3().setFromObject(lower).equals(before));assert.ok(shell.lid.position.equals(hinge));assert.ok(new T.Box3().setFromObject(shell.lid).max.y>.8);
  const geos=new Set(),mats=new Set();shell.group.traverse(o=>{if(o.isMesh){geos.add(o.geometry);mats.add(o.material)}});assert.equal(geos.size,4);geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
});
