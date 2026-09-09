import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { Walker } from './physics.js';

const $ = s => document.querySelector(s);
const canvas = $('#world'), menu = $('#menu'), hud = $('#hud'), enter = $('#enter');
const testMode = new URLSearchParams(location.search).has('test');
const coarse = matchMedia('(pointer: coarse)').matches;
let renderer, walker, model, ready = false, state = 'loading', yaw = Math.PI, pitch = 0;
let quality = 1, toastUntil = 0, target = null, drag = null, previousTime = 0, elapsed = 0;
const keys = new Set(), found = new Set(), collectibles = [], blockers = [], waterMaps = [];
const scene = new THREE.Scene();
scene.background = new THREE.Color('#adb7a3');
scene.fog = new THREE.FogExp2('#adb7a3', .007);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, .06, 350);
camera.rotation.order = 'YXZ';
const ray = new THREE.Raycaster(), forward = new THREE.Vector3(), delta = new THREE.Vector3();
const labels = {TeaCup: 'Tea cup', BathTowel: 'Bath towel', RoomKey: 'Room key'};
const exitPosition = new THREE.Vector3(-6, 1.05, 10.2);
let exitMarker;

function say(text) { $('#toast').textContent = text; toastUntil = performance.now() + 4200; }
function fail(error) {
  console.error(error);
  state = 'error'; menu.hidden = false; hud.hidden = true;
  $('#menu-title').textContent = 'A small detour.';
  $('#menu-copy').textContent = 'The scene could not start. Use a browser with WebGL 2 and hardware acceleration, then reload. For local play, open this site through the included local server instructions.';
  $('#load-status').textContent = error.message || String(error);
  enter.disabled = false; enter.textContent = 'Try again ↗'; enter.onclick = () => location.reload();
}

function syncCamera() {
  camera.position.set(walker.x, 1.62 + walker.height, walker.z);
  camera.rotation.set(pitch, yaw, 0);
  camera.updateMatrixWorld();
}
function reset() {
  found.clear(); keys.clear(); elapsed = 0;
  target = null; toastUntil = 0; $('#toast').textContent = ''; $('#prompt').hidden = true;
  walker.x = 0; walker.z = 1.2; yaw = Math.PI; pitch = 0;
  walker.resetJump();
  collectibles.forEach(c => { c.object.visible = true; c.marker.visible = true; });
  syncCamera(); updateObjectives();
}
function updateObjectives() {
  $('#counter').textContent = `${found.size} / 3`;
  for (const [id] of Object.entries(labels)) {
    const li = $(`[data-item="${id}"]`); li.classList.toggle('found', found.has(id));
    li.querySelector('span').textContent = found.has(id) ? '✓' : '○';
  }
  $('#next-step').textContent = found.size === 3 ? 'All packed. Step onto the balcony and press E at the golden marker.' : 'Find your three belongings.';
  exitMarker.material.color.set(found.size === 3 ? '#ffe0a0' : '#aabbaa');
}
function showMenu(kind) {
  state = kind; keys.clear(); target = null;
  if (document.pointerLockElement) document.exitPointerLock();
  menu.hidden = false; hud.hidden = true; $('#pause-button').hidden = true;
  document.body.classList.remove('playing');
  $('#menu-actions').hidden = false;
  $('#load-status').textContent = 'WASD / arrows to walk · Mouse / drag to look · E to collect · Space to jump · Shift to sprint';
  if (kind === 'won') {
    $('#menu-kicker').textContent = 'YOUR STAY IS COMPLETE';
    $('#menu-title').innerHTML = 'Until<br><em>next time.</em>';
    $('#menu-copy').textContent = 'Tea cup, towel, room key. Everything is with you. Take the quiet of the valley into the rest of your day.';
    enter.innerHTML = 'Explore again <span>↗</span>';
  } else {
    $('#menu-kicker').textContent = 'TAKE YOUR TIME';
    $('#menu-title').innerHTML = 'A moment<br><em>of stillness.</em>';
    $('#menu-copy').textContent = `${found.size} of 3 belongings gathered. Your room is just as you left it.`;
    enter.innerHTML = 'Continue your stay <span>↗</span>';
  }
  enter.focus();
}
async function play() {
  if (!ready) return;
  if (state === 'ready' || state === 'won') reset();
  state = 'playing'; menu.hidden = true; hud.hidden = false; $('#pause-button').hidden = false;
  document.body.classList.add('playing');
  if (!coarse && !testMode) {
    try { await canvas.requestPointerLock(); }
    catch { say('Click and drag to look. You can also use the arrow keys.'); }
  }
  canvas.focus();
}
function marker(position, color) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.065), new THREE.MeshBasicMaterial({color, transparent: true, opacity: .82, depthWrite: false}));
  mesh.position.copy(position); mesh.userData.baseY = position.y;
  scene.add(mesh); return mesh;
}
function roomName() {
  const x = -walker.x, z = walker.z;
  if (z > 9.04) return 'Forest balcony';
  if (x < 1) return 'Timber corridor';
  if (x < 7) return z > 4 ? 'Hinoki bath' : 'Tatami dining room';
  return z > 4 ? 'Valley lounge' : 'Futon bedroom';
}
function updateTarget() {
  target = null;
  camera.getWorldDirection(forward);
  let bestScore = -1;
  for (const c of collectibles) {
    if (found.has(c.id)) continue;
    delta.copy(c.center).sub(camera.position);
    const distance = delta.length(), score = forward.dot(delta.normalize());
    if (distance > 2.25 || score < .97 || score <= bestScore) continue;
    ray.set(camera.position, delta); ray.far = distance - .08;
    if (ray.intersectObjects(blockers, false).length) continue;
    target = c; bestScore = score;
  }
  if (Math.hypot(walker.x - exitPosition.x, walker.z - exitPosition.z) < 1.0) target = {id: 'exit'};
  const prompt = $('#prompt'); prompt.hidden = !target;
  $('#crosshair').classList.toggle('active', !!target);
  if (target) prompt.innerHTML = target.id === 'exit'
    ? (found.size === 3 ? '<kbd>E</kbd> Say goodbye to the valley' : `Gather your belongings first · ${found.size} / 3`)
    : `<kbd>E</kbd> Take ${labels[target.id].toLowerCase()}`;
}
function interact() {
  if (state !== 'playing') return;
  updateTarget();
  if (!target) { say('Move closer and look at a golden marker.'); return; }
  if (target.id === 'exit') {
    if (found.size === 3) showMenu('won');
    else say('A few belongings are still inside.');
    return;
  }
  found.add(target.id); target.object.visible = false; target.marker.visible = false;
  say(`${labels[target.id]} packed. ${found.size === 3 ? 'The balcony is waiting.' : `${3 - found.size} more to find.`}`);
  updateObjectives(); updateTarget();
}
function step(dt) {
  if (state !== 'playing') return;
  elapsed += dt;
  walker.updateJump(dt);
  if (keys.has('ArrowLeft')) yaw += dt * 1.6;
  if (keys.has('ArrowRight')) yaw -= dt * 1.6;
  if (keys.has('PageUp')) pitch = Math.min(1.35, pitch + dt);
  if (keys.has('PageDown')) pitch = Math.max(-1.35, pitch - dt);
  let x = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  let z = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const length = Math.hypot(x, z);
  if (length) {
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.8 : 2.3) * dt / length;
    walker.move((Math.cos(yaw) * x - Math.sin(yaw) * z) * speed, (-Math.sin(yaw) * x - Math.cos(yaw) * z) * speed);
  }
  syncCamera(); updateTarget();
  $('#room').textContent = roomName();
  $('#map-player').setAttribute('cx', 12 + (walker.x + 11.85) / 12.85 * 136);
  $('#map-player').setAttribute('cy', 12 + (11 - walker.z) * 10);
}
function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (renderer) { renderer.setPixelRatio(Math.min(devicePixelRatio, [.85, 1.25, 2][quality])); renderer.setSize(innerWidth, innerHeight); }
}
function setQuality() {
  quality = (quality + 1) % 3;
  $('.quality').textContent = `Quality: ${['Low', 'Balanced', 'High'][quality]}`;
  renderer.shadowMap.enabled = quality > 0;
  // Material programs include the shadow defines, so refresh when switching.
  model.traverse(o => { if (o.isMesh) o.material.needsUpdate = true; });
  resize();
}
function frame(now) {
  const dt = Math.min((now - previousTime) / 1000 || 0, .05); previousTime = now;
  if (ready) {
    step(dt);
    for (const c of collectibles) {
      c.marker.rotation.y = now * .0007;
      c.marker.position.y = c.marker.userData.baseY + Math.sin(now * .002) * .022;
    }
    exitMarker.rotation.y = now * .0003;
    for (const map of waterMaps) { map.offset.x = now * .000006; map.offset.y = now * .000003; }
    $('#toast').style.opacity = now < toastUntil ? '1' : '0';
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    resize();
    scene.add(new THREE.HemisphereLight('#e0e8cd', '#796447', 2.0));
    const sun = new THREE.DirectionalLight('#ffe5b1', 2.4);
    sun.position.set(-18, 24, 30); sun.target.position.set(-5, 0, 3);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {left:-15,right:15,top:15,bottom:-15,near:1,far:70});
    sun.shadow.normalBias = .025; sun.shadow.bias = -.0002;
    scene.add(sun, sun.target);
    for (const [x, y, z, power] of [[.7,1.8,1,9],[.7,1.8,4.1,9],[.7,1.8,7.1,9],[-3,2.5,.5,15],[-3,2.5,5,15],[-9.5,2.5,.5,15],[-9.5,2.5,6,12]]) {
      const light = new THREE.PointLight('#ffdb9a', power, 6, 2); light.position.set(x,y,z); scene.add(light);
    }
    const [gltf, boxes] = await Promise.all([
      new GLTFLoader().loadAsync('./assets/retreat.glb', e => {
        $('#load-status').textContent = e.total ? `Preparing the rooms · ${Math.round(e.loaded / e.total * 100)}%` : `Preparing the rooms · ${(e.loaded / 1048576).toFixed(1)} MB`;
      }),
      fetch('./assets/collision.json').then(r => { if (!r.ok) throw new Error('Could not load room collision.'); return r.json(); })
    ]);
    model = gltf.scene; scene.add(model); model.updateMatrixWorld(true);
    const environmentGroups = new Set(['Walls','Timber','Shoji','Furniture','Bath','BathroomSeating','Details']);
    model.traverse(o => {
      if (!o.isMesh) return;
      let root = o; while (root.parent && root.parent !== model) root = root.parent;
      o.castShadow = !['Forest','Landscape','Pebbles','Water'].includes(root.name);
      o.receiveShadow = true;
      if (environmentGroups.has(root.name)) blockers.push(o);
      const mat = o.material;
      if (mat.map) mat.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (mat.name === 'Water') { mat.roughness = .16; mat.metalness = .18; if (mat.normalMap) waterMaps.push(mat.normalMap); }
    });
    for (const id of Object.keys(labels)) {
      const object = model.getObjectByName(id);
      if (!object) throw new Error(`Missing belonging: ${id}`);
      const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
      collectibles.push({id, object, center, marker: marker(center.clone().add(new THREE.Vector3(0, .23, 0)), '#ffdc95')});
    }
    exitMarker = marker(exitPosition, '#aabbaa'); exitMarker.scale.setScalar(2);
    walker = new Walker(boxes); reset();
    // A bath view introduces the setting; entering starts at the corridor.
    camera.position.set(-2.0, 1.62, 4.7); camera.lookAt(-4.7, 1.05, 8.8);
    ready = true; state = 'ready';
    // Compile once before enabling play to reduce the initial shader hitch.
    await renderer.compileAsync(scene, camera);
    enter.disabled = false; enter.innerHTML = 'Enter the ryokan <span>↗</span>';
    $('#load-status').textContent = 'No rush. There is no timer.';
    requestAnimationFrame(frame);
    if (testMode) installTestAPI();
  } catch (e) { fail(e); }
}
enter.onclick = play;
$('#pause-button').onclick = () => showMenu('paused');
$('#restart').onclick = () => { reset(); play(); };
$('.quality').onclick = setQuality;
$('#touch-use').onclick = interact;
addEventListener('resize', resize);
addEventListener('blur', () => { keys.clear(); if (state === 'playing') showMenu('paused'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') showMenu('paused'); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing' && !testMode) showMenu('paused');
});
addEventListener('keydown', e => {
  if (e.target.closest('button') && ['Space','Enter'].includes(e.code)) return;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','PageUp','PageDown'].includes(e.code)) e.preventDefault();
  if (state !== 'playing') return;
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'Space') walker.jump();
  if (e.code === 'KeyE') interact();
  if (e.code === 'Escape') showMenu('paused');
  if (e.code === 'KeyR') { reset(); say('A fresh start.'); }
  if (e.code === 'KeyM') $('#map').hidden = !$('#map').hidden;
});
addEventListener('keyup', e => keys.delete(e.code));
function look(dx, dy) {
  yaw -= dx * .0023; pitch = THREE.MathUtils.clamp(pitch - dy * .0023, -1.35, 1.35);
}
document.addEventListener('mousemove', e => { if (state === 'playing' && document.pointerLockElement === canvas) look(e.movementX, e.movementY); });
canvas.addEventListener('pointerdown', e => {
  if (state !== 'playing' || document.pointerLockElement) return;
  drag = {id:e.pointerId,x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId || state !== 'playing') return;
  look(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
for (const b of document.querySelectorAll('[data-move]')) {
  b.addEventListener('pointerdown', e => { e.preventDefault(); keys.add(b.dataset.move); b.setPointerCapture(e.pointerId); });
  for (const event of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(event, () => keys.delete(b.dataset.move));
}
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(new Error('Graphics context lost. Reload to start again.')); });
function installTestAPI() {
  // Explicit developer mode only; used by the reproducible browser smoke test.
  window.komorebiTest = {
    snapshot: () => ({state, found:[...found], position:[walker.x,1.62+walker.height,walker.z], grounded:walker.grounded, verticalSpeed:walker.verticalSpeed, yaw, pitch, room:roomName(), target:target?.id, triangles:renderer.info.render.triangles, draws:renderer.info.render.calls}),
    teleport: (x,z,lookAt) => { walker.x=x; walker.z=z; walker.resetJump(); syncCamera(); if (lookAt) { camera.lookAt(...lookAt); yaw=camera.rotation.y; pitch=camera.rotation.x; } updateTarget(); },
    advance: (seconds, codes=[]) => { keys.clear(); codes.forEach(c=>keys.add(c)); for(let t=0;t<seconds;t+=1/60) step(Math.min(1/60,seconds-t)); keys.clear(); },
    colliders: () => walker.boxes,
    walkRoute: points => {
      const positions = [];
      for (const [x,z] of points) {
        const dx=x-walker.x, dz=z-walker.z, seconds=Math.hypot(dx,dz)/2.3;
        yaw=Math.atan2(-dx,-dz); keys.clear(); keys.add('KeyW');
        for(let t=0;t<seconds;t+=1/60) step(Math.min(1/60,seconds-t));
        positions.push([walker.x,walker.z]);
      }
      keys.clear(); return positions;
    },
    collectible: id => collectibles.find(c=>c.id===id).center.toArray(),
    reset, interact
  };
}
init();
