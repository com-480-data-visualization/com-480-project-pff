import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VERT = /* glsl */`
attribute float aMade;
attribute float aDelay;
attribute float aTargetY;
attribute float aYear;

uniform float uProgress;
uniform float uSelectedYear;

varying vec3  vColor;
varying float vAlpha;

void main() {
  vec3 nbaBlue = vec3(23.0, 64.0, 139.0) / 255.0;
  vec3 missRed = vec3(239.0, 68.0, 68.0) / 255.0;
  vColor = aMade > 0.5 ? nbaBlue : missRed;

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
  vec3 col = vColor;
  // Boost NBA blue under additive blending so made shots read clearly
  if (vColor.b > vColor.r + 0.15) col *= 1.45;
  gl_FragColor = vec4(col, vAlpha * soft);
}
`;

// ── Court geometry ────────────────────────────────────────────────────────────
function makeCourt() {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0xC9082A, transparent: true, opacity: 0.45 });

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

  // Elevated rim/backboard for the landing-page shot animation.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.055, 12, 48),
    new THREE.MeshBasicMaterial({ color: 0xC9082A })
  );
  rim.position.set(0, 3.05, -5.25);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3.4),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    })
  );
  board.position.set(0, 3.35, -4.25);
  group.add(board);

  return group;
}

function makeShotAnimator(scene, rawTrajectory) {
  if (!rawTrajectory?.shots?.length) {
    return { update() {} };
  }

  const madeShots = rawTrajectory.shots
    .filter(s => s[2] === 1)
    .slice(0, 120)
    .map(s => ({ x: s[0], y: s[1], season: s[3] }));

  if (!madeShots.length) {
    return { update() {} };
  }

  const group = new THREE.Group();
  scene.add(group);

  const trailMaterial = () => new THREE.LineBasicMaterial({
    color: 0x17408B,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
  });

  const MAX_ACTIVE_SHOTS = 5;
  const SHOT_INTERVAL = 0.3;
  const TRAIL_FADE_SECONDS = 3;
  const liveTrails = [];
  const activeShots = [];
  let index = 0;
  let timer = 0;
  let started = false;

  function pointFromShot(x, y, height = 0.5) {
    return new THREE.Vector3(x, height, -y);
  }

  function curveForShot(shot) {
    const start = pointFromShot(shot.x, shot.y, 0.55);
    const end = pointFromShot(0, 5.25, 3.05);
    const lateral = Math.abs(shot.x);
    const distance = Math.max(8, Math.hypot(shot.x, shot.y - 5.25));
    const apex = Math.min(15, 6.8 + distance * 0.22 + lateral * 0.05);
    const control = new THREE.Vector3(shot.x * 0.42, apex, -(shot.y + 5.25) * 0.5);

    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const a = start.clone().multiplyScalar((1 - t) * (1 - t));
      const b = control.clone().multiplyScalar(2 * (1 - t) * t);
      const c = end.clone().multiplyScalar(t * t);
      pts.push(a.add(b).add(c));
    }
    return pts;
  }

  function startShot() {
    const shot = madeShots[index % madeShots.length];
    index += 1;
    const points = curveForShot(shot);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setDrawRange(0, 1);

    const line = new THREE.Line(geometry, trailMaterial());
    group.add(line);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x17408B })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.84, 20, 14),
      new THREE.MeshBasicMaterial({
        color: 0x17408B,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    group.add(ball, glow);

    activeShots.push({
      line,
      ball,
      glow,
      points,
      progress: 0,
      duration: 1.05 + Math.random() * 0.35,
    });
  }

  return {
    update(delta, particleProgress) {
      if (!started) {
        if (particleProgress < 0.38) return;
        started = true;
      }

      timer += delta;
      while (timer > SHOT_INTERVAL && activeShots.length < MAX_ACTIVE_SHOTS) {
        timer -= SHOT_INTERVAL;
        startShot();
      }

      for (let i = activeShots.length - 1; i >= 0; i--) {
        const shot = activeShots[i];
        shot.progress = Math.min(1, shot.progress + delta / shot.duration);
        const eased = 1 - Math.pow(1 - shot.progress, 3);
        const drawCount = Math.max(2, Math.floor(eased * shot.points.length));
        shot.line.geometry.setDrawRange(0, drawCount);

        const current = shot.points[Math.min(drawCount - 1, shot.points.length - 1)];
        shot.ball.position.copy(current);
        shot.glow.position.copy(current);
        shot.glow.material.opacity = 0.13 + 0.14 * Math.sin(shot.progress * Math.PI);

        if (shot.progress >= 1) {
          shot.line.geometry.setDrawRange(0, shot.points.length);
          liveTrails.push({ line: shot.line, age: 0 });
          group.remove(shot.ball);
          group.remove(shot.glow);
          shot.ball.geometry.dispose();
          shot.ball.material.dispose();
          shot.glow.geometry.dispose();
          shot.glow.material.dispose();
          activeShots.splice(i, 1);
        }
      }

      for (let i = liveTrails.length - 1; i >= 0; i--) {
        const trail = liveTrails[i];
        trail.age += delta;
        trail.line.material.opacity = Math.max(0, 0.52 * (1 - trail.age / TRAIL_FADE_SECONDS));
        if (trail.age >= TRAIL_FADE_SECONDS) {
          group.remove(trail.line);
          trail.line.geometry.dispose();
          trail.line.material.dispose();
          liveTrails.splice(i, 1);
        }
      }
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function initHero() {
  const [data, trajectoryData] = await Promise.all([
    fetch('./data/hero_particles.json').then(r => r.json()),
    fetch('./data/trajectory_samples.json').then(r => r.json()).catch(() => null),
  ]);
  const N = data.x.length;

  const canvas = document.getElementById('hero-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 500);
  camera.position.set(58, 20, -18);
  camera.lookAt(0, 1.8, -18);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = true;
  controls.autoRotateSpeed = -0.8;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.target.set(0, 1.8, -18);
  controls.maxPolarAngle = Math.PI / 1.9;
  controls.minDistance = 18;
  controls.maxDistance = 120;
  controls.update();

  scene.add(makeCourt());
  const shotAnimator = makeShotAnimator(scene, trajectoryData);

  // ── Particles ──────────────────────────────────────────
  const positions = new Float32Array(N * 3);
  const madeFlags = new Float32Array(N);
  const delays    = new Float32Array(N);
  const targetY   = new Float32Array(N);
  const years     = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const made   = data.made[i] === 1;
    const startH = 14 + Math.random() * 16;
    positions[i*3]   = data.x[i];
    positions[i*3+1] = startH;
    positions[i*3+2] = -data.y[i];
    targetY[i] = made ? 0.4 : 0.15;
    madeFlags[i] = made ? 1 : 0;
    delays[i]  = Math.random() * 0.7;
    years[i]   = data.season[i];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aMade',    new THREE.BufferAttribute(madeFlags, 1));
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

  // ── Render loop ─────────────────────────────────────────
  const clock = new THREE.Clock();
  let prog = 0;

  (function render() {
    requestAnimationFrame(render);
    const delta = clock.getDelta();
    prog = Math.min(prog + delta / 2.8, 1);
    mat.uniforms.uProgress.value = prog;
    shotAnimator.update(delta, prog);
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
