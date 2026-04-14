import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VERT = /* glsl */`
attribute vec3  aColor;
attribute float aDelay;
attribute float aTargetY;
attribute float aYear;

uniform float uProgress;
uniform float uSelectedYear;

varying vec3  vColor;
varying float vAlpha;

void main() {
  vColor = aColor;

  // Staggered fall: each particle has a start delay (0–0.7)
  // Each particle's local t goes 0→1 over 0.3 of total progress
  float t = clamp((uProgress - aDelay) / 0.3, 0.0, 1.0);
  t = 1.0 - pow(1.0 - t, 3.0); // ease-out cubic

  vec3 pos = position;
  pos.y = mix(pos.y, aTargetY, t);

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp(280.0 / (-mvPos.z), 1.5, 9.0);
  gl_Position  = projectionMatrix * mvPos;

  float yearMatch = (uSelectedYear < 1.0 || abs(aYear - uSelectedYear) < 0.5) ? 1.0 : 0.05;
  vAlpha = t * yearMatch;
}
`;

const FRAG = /* glsl */`
varying vec3  vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.1, d);
  gl_FragColor = vec4(vColor, vAlpha * soft);
}
`;

// ── Court geometry ────────────────────────────────────────────────────────────
function makeCourt() {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0xf7820b, transparent: true, opacity: 0.45 });

  // Convert court-space [x, y] → Three.js Vector3 (Y-up, Z toward camera)
  function v(x, y) { return new THREE.Vector3(x, 0.06, -y); }

  function line(pts) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map(([x,y]) => v(x,y)));
    return new THREE.Line(geo, mat);
  }

  function arc(cx, cy, r, a0, a1, n = 64) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return line(pts);
  }

  const cornerY = 5.25 + Math.sqrt(23.75 ** 2 - 22 ** 2); // ≈ 14.2
  const thetaCorner = Math.atan2(cornerY - 5.25, 22);      // ≈ 22°

  // Court surface (dark)
  const surf = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 42.5),
    new THREE.MeshBasicMaterial({ color: 0x0a0f1e })
  );
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(0, 0, -21.25);
  group.add(surf);

  // Lines
  group.add(line([[-25, 0], [25, 0]]));               // baseline
  group.add(line([[-25, 0], [-25, 42.5]]));             // sidelines
  group.add(line([[25, 0], [25, 42.5]]));
  group.add(line([[-8, 0], [-8, 19], [8, 19], [8, 0]])); // paint
  group.add(line([[-3, 4.25], [3, 4.25]]));             // backboard
  group.add(arc(0, 5.25, 0.75, 0, Math.PI * 2));       // hoop
  group.add(arc(0, 19, 6, 0, Math.PI));                 // free-throw arc
  group.add(arc(0, 5.25, 4, 0, Math.PI));              // restricted area
  group.add(line([[-22, 0], [-22, cornerY]]));          // corner 3 lines
  group.add(line([[22, 0], [22, cornerY]]));
  group.add(arc(0, 5.25, 23.75, thetaCorner, Math.PI - thetaCorner)); // 3pt arc

  return group;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function initHero() {
  const data = await fetch('./data/hero_particles.json').then(r => r.json());
  const N = data.x.length;

  const canvas = document.getElementById('hero-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 500);
  camera.position.set(0, 42, 22);
  camera.lookAt(0, 0, -18);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0, -18);
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 18;
  controls.maxDistance = 120;
  controls.update();

  scene.add(makeCourt());

  // ── Particles ──────────────────────────────────────────
  const positions = new Float32Array(N * 3);
  const colors    = new Float32Array(N * 3);
  const delays    = new Float32Array(N);
  const targetY   = new Float32Array(N);
  const years     = new Float32Array(N);

  const cMade = new THREE.Color('#22c55e');
  const cMiss = new THREE.Color('#ef4444');

  for (let i = 0; i < N; i++) {
    const made   = data.made[i];
    const startH = 14 + Math.random() * 16;
    positions[i*3]   = data.x[i];
    positions[i*3+1] = startH;
    positions[i*3+2] = -data.y[i];
    targetY[i] = made ? 0.4 : 0.15;
    delays[i]  = Math.random() * 0.7;
    years[i]   = data.season[i];
    const c = made ? cMade : cMiss;
    colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aDelay',   new THREE.BufferAttribute(delays, 1));
  geo.setAttribute('aTargetY', new THREE.BufferAttribute(targetY, 1));
  geo.setAttribute('aYear',    new THREE.BufferAttribute(years, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms: {
      uProgress:     { value: 0 },
      uSelectedYear: { value: 0 },
    },
    transparent:  true,
    blending:     THREE.AdditiveBlending,
    depthWrite:   false,
  });

  scene.add(new THREE.Points(geo, mat));

  // ── Year scrubber ───────────────────────────────────────
  const seasons = [...new Set(data.season)].sort();
  const slider  = document.getElementById('hero-year');
  const label   = document.getElementById('hero-year-label');
  const allBtn  = document.getElementById('hero-all-btn');

  slider.min = seasons[0];
  slider.max = seasons[seasons.length - 1];
  slider.value = seasons[0];
  label.textContent = seasons[0];

  allBtn.addEventListener('click', () => {
    mat.uniforms.uSelectedYear.value = 0;
    label.textContent = 'All';
    allBtn.classList.add('active');
  });
  slider.addEventListener('input', () => {
    const yr = +slider.value;
    mat.uniforms.uSelectedYear.value = yr;
    label.textContent = yr;
    allBtn.classList.remove('active');
  });

  // ── Render loop ─────────────────────────────────────────
  const clock = new THREE.Clock();
  let prog = 0;

  (function render() {
    requestAnimationFrame(render);
    prog = Math.min(prog + clock.getDelta() / 2.8, 1);
    mat.uniforms.uProgress.value = prog;
    controls.update();
    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

initHero();
