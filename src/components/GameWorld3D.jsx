/**
 * Isometric 3D Game World — procedural models only (no external assets).
 * Three.js via @react-three/fiber + @react-three/drei.
 *
 * Grid cell (x, y) maps to world (x - 3.5, 0, y - 3.5); tile tops sit at y = 0.
 * Crops/tiles are pre-merged into single vertex-colored geometries (1 draw call each).
 * The robot is the AP Lab mascot: orange round head, white visor, molecule antenna.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, ContactShadows, Grid, SoftShadows } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GROW_TICKS } from '../game/engine.js';

const OFF = 3.5; // grid -> world offset (8x8 island centred on origin)
const gx = (x) => x - OFF;

/* ---------------- procedural geometry helpers ---------------- */

function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...p),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
      new THREE.Vector3(...s)
    )
  );
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

const box = (w, h, d) => new RoundedBoxGeometry(w, h, d, 2, Math.min(0.045, h / 4));
const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const octa = (r) => new THREE.OctahedronGeometry(r, 0);

const CROP_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, flatShading: false });

/* Tiles: geo spans y -0.3 .. +0.3, mesh placed at y=-0.3 so the top is y=0 */
const GRASS_TILE = mergeGeometries([
  part(box(0.94, 0.44, 0.94), '#c08b57', { p: [0, -0.08, 0] }),
  part(box(0.94, 0.16, 0.94), '#90d077', { p: [0, 0.22, 0] }),
]);
const SOIL_TILE = mergeGeometries([
  part(box(0.94, 0.44, 0.94), '#b07a46', { p: [0, -0.08, 0] }),
  part(box(0.94, 0.16, 0.94), '#7c4f28', { p: [0, 0.22, 0] }),
  part(box(0.86, 0.035, 0.1), '#5f3a1c', { p: [0, 0.31, -0.26] }),
  part(box(0.86, 0.035, 0.1), '#5f3a1c', { p: [0, 0.31, 0] }),
  part(box(0.86, 0.035, 0.1), '#5f3a1c', { p: [0, 0.31, 0.26] }),
]);

/* Crops & props */
const WHEAT = (() => {
  const spots = [
    [-0.24, -0.18, 0.1],
    [0.04, -0.26, -0.06],
    [0.26, -0.08, 0.14],
    [-0.14, 0.14, -0.12],
    [0.1, 0.22, 0.06],
    [0.28, 0.24, -0.1],
  ];
  const parts = [];
  for (const [x, z, tilt] of spots) {
    parts.push(part(cyl(0.028, 0.04, 0.5, 6), '#d7a844', { p: [x, 0.25, z], r: [tilt, 0, -tilt] }));
    parts.push(part(cone(0.075, 0.24, 6), '#eec45f', { p: [x + tilt * 0.5, 0.58, z - tilt * 0.5], r: [tilt, 0, -tilt] }));
  }
  for (const [x,z] of spots) {
    for (let i=0;i<3;i++) for (const side of [-1,1]) {
      parts.push(part(new THREE.SphereGeometry(.044,6,4), '#ffd57b', {p:[x+side*.045,.45+i*.065,z],s:[.65,1.5,.65],r:[0,0,side*-.6]}));
    }
    parts.push(part(cone(.05,.25,5), '#8ba455', {p:[x+.04,.22,z],r:[0,0,-.6],s:[1,1,.35]}));
  }
  return mergeGeometries(parts);
})();

const SPROUT = mergeGeometries([
  part(cyl(0.022, 0.035, 0.24, 6), '#4f9e3f', { p: [0, 0.12, 0] }),
  part(new THREE.SphereGeometry(0.085, 7, 5), '#67bd55', { p: [-0.07, 0.24, 0.02], s: [1.3, 0.5, 0.8] }),
  part(new THREE.SphereGeometry(0.085, 7, 5), '#67bd55', { p: [0.07, 0.27, -0.02], s: [1.3, 0.55, 0.8] }),
]);

const TREE = mergeGeometries([
  part(cyl(0.085, 0.12, 0.3, 7), '#8a5a33', { p: [0, 0.15, 0] }),
  part(cone(0.36, 0.42, 8), '#3f9243', { p: [0, 0.48, 0] }),
  part(cone(0.28, 0.38, 8), '#4aa94f', { p: [0, 0.74, 0] }),
  part(cone(0.18, 0.32, 8), '#58bb5a', { p: [0, 1.0, 0] }),
]);

const GEM = mergeGeometries([
  part(ico(0.16), '#9aa2ad', { p: [0, 0.07, 0], s: [1.2, 0.55, 1.2] }),
  part(octa(0.17), '#39c2dc', { p: [0, 0.3, 0], r: [0, 0.4, 0.12], s: [1, 1.5, 1] }),
  part(octa(0.09), '#6fdcef', { p: [-0.18, 0.16, 0.08], r: [0.3, 0, -0.3], s: [1, 1.4, 1] }),
  part(octa(0.07), '#6fdcef', { p: [0.16, 0.14, -0.12], r: [-0.2, 0, 0.35], s: [1, 1.3, 1] }),
]);

const ROCK = mergeGeometries([
  part(ico(0.3), '#a7adb8', { p: [-0.08, 0.2, 0.05], r: [0.3, 0.6, 0], s: [1.25, 0.95, 1.1] }),
  part(ico(0.18), '#8f96a3', { p: [0.24, 0.13, -0.2], r: [0.8, 0.2, 0.4] }),
  part(ico(0.13), '#b8bec9', { p: [0.18, 0.09, 0.26], r: [0.1, 0.9, 0.2] }),
]);

const LOG = mergeGeometries([
  part(cyl(0.1, 0.1, 0.5, 8), '#8a5a33', { r: [0, 0, Math.PI / 2] }),
  part(cyl(0.102, 0.102, 0.03, 8), '#c89a66', { p: [0.25, 0, 0], r: [0, 0, Math.PI / 2] }),
  part(cyl(0.102, 0.102, 0.03, 8), '#c89a66', { p: [-0.25, 0, 0], r: [0, 0, Math.PI / 2] }),
]);

const LAB_TILE = mergeGeometries([
  part(box(.94,.48,.94), '#35445d', {p:[0,-.06,0]}),
  part(box(.9,.12,.9), '#d5dfe8', {p:[0,.24,0]}),
  part(box(.65,.014,.026), '#a7bccd', {p:[0,.307,-.29]}),
]);
const LAB_WALL = mergeGeometries([
  part(box(.86,.16,.86), '#33435e', {p:[0,.08,0]}),
  part(box(.75,.5,.75), '#72869e', {p:[0,.38,0]}),
  part(box(.81,.1,.81), '#a5b8ca', {p:[0,.66,0]}),
  part(box(.42,.045,.012), '#56cede', {p:[0,.43,.382]}),
  part(box(.012,.045,.42), '#56cede', {p:[.382,.43,0]}),
]);
const MARK_COLORS = {frontier:'#f4ba4b', visited:'#55b8ea', path:'#4ed6a0'};

const POP_GEOS = { wheat: WHEAT, wood: LOG, ore: GEM };

/* Axis labels as canvas sprites (no font download needed) */
function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 42px Consolas, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#95a1b8';
  g.fillText(text, 32, 36);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}
const LABELS = Array.from({ length: 8 }, (_, i) => makeLabel(String(i)));

/* ---------------- scene pieces ---------------- */

function Tiles({ world }) {
  return (
    <group>
      {world.cells.map((row, y) =>
        row.map((cell, x) => {
          const soil = cell.type === 'soil' || cell.type === 'wheat';
          return (
            <mesh
              key={`${x}-${y}`}
              geometry={world.theme === 'lab' ? LAB_TILE : soil ? SOIL_TILE : GRASS_TILE}
              material={CROP_MAT}
              position={[gx(x), -0.3, gx(y)]}
              receiveShadow
              castShadow
            />
          );
        })
      )}
      {LABELS.map((tex, i) => (
        <React.Fragment key={i}>
          <sprite position={[gx(i), 0.18, -OFF - 0.95]} scale={0.42}>
            <spriteMaterial map={tex} transparent depthWrite={false} />
          </sprite>
          <sprite position={[-OFF - 0.95, 0.18, gx(i)]} scale={0.42}>
            <spriteMaterial map={tex} transparent depthWrite={false} />
          </sprite>
        </React.Fragment>
      ))}
    </group>
  );
}

function CropMesh({ geo, x, z, scale = 1, appear = true }) {
  const ref = useRef();
  const cur = useRef(appear ? 0.001 : scale);
  useFrame((_, dt) => {
    cur.current += (scale - cur.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 9));
    if (ref.current) ref.current.scale.setScalar(cur.current);
  });
  return <mesh ref={ref} geometry={geo} material={CROP_MAT} position={[x, 0, z]} castShadow receiveShadow />;
}

function Crops({ world }) {
  const items = [];
  world.cells.forEach((row, y) =>
    row.forEach((cell, x) => {
      const key = `${x}-${y}-${cell.type}`;
      if (cell.type === 'wheat') {
        const ripe = cell.growth >= GROW_TICKS;
        const s = ripe ? 1 : 0.35 + 0.6 * (cell.growth / GROW_TICKS);
        items.push(<CropMesh key={key} geo={ripe ? WHEAT : SPROUT} x={gx(x)} z={gx(y)} scale={s} />);
      } else if (cell.type === 'tree') {
        items.push(<CropMesh key={key} geo={TREE} x={gx(x)} z={gx(y)} appear={false} />);
      } else if (cell.type === 'ore') {
        items.push(<CropMesh key={key} geo={GEM} x={gx(x)} z={gx(y)} appear={false} />);
      } else if (cell.type === 'rock') {
        items.push(<CropMesh key={key} geo={world.theme === 'lab' ? LAB_WALL : ROCK} x={gx(x)} z={gx(y)} appear={false} />);
      }
    })
  );
  return <group>{items}</group>;
}

function TargetPad({ target }) {
  const mat = useRef();
  const ring = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 0.55 + 0.45 * Math.sin(t * 3);
    if (mat.current) mat.current.emissiveIntensity = 0.4 + pulse * 0.5;
    if (ring.current) {
      ring.current.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
      ring.current.material.opacity = 0.5 + 0.3 * pulse;
    }
  });
  if (!target) return null;
  const x = gx(target.x);
  const z = gx(target.y);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <cylinderGeometry args={[0.38, 0.42, 0.07, 24]} />
        <meshStandardMaterial ref={mat} color="#f5a623" emissive="#ffb13d" emissiveIntensity={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={ring} position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.018, 8, 32]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.3, 0.35, -0.3]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
      <mesh position={[0.21, 0.52, -0.3]} castShadow>
        <boxGeometry args={[0.2, 0.13, 0.02]} />
        <meshStandardMaterial color="#f15a24" />
      </mesh>
    </group>
  );
}

/* ---------------- AP Lab mascot robot ---------------- */

const BACKPACK = new RoundedBoxGeometry(.28,.28,.19,3,.04);
const YAW = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };
const MOLECULE = [
  { p: [0.17, 0.1, 0.02], c: '#3b9af5', r: 0.045 },
  { p: [-0.15, 0.13, 0.07], c: '#f6c344', r: 0.042 },
  { p: [0.02, 0.21, -0.12], c: '#8a52e8', r: 0.045 },
  { p: [-0.06, 0.02, 0.17], c: '#2fc8d6', r: 0.04 },
  { p: [0.03, -0.04, -0.16], c: '#f6c344', r: 0.036 },
].map((s) => {
  const v = new THREE.Vector3(...s.p);
  return {
    ...s,
    len: v.length(),
    mid: v.clone().multiplyScalar(0.5).toArray(),
    q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()),
  };
});

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function Mascot({ world, fx, speedMs }) {
  const root = useRef();
  const yawGroup = useRef();
  const spin = useRef();
  const pos = useRef(new THREE.Vector3(gx(world.robot.x), 0, gx(world.robot.y)));
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(YAW[world.robot.dir] ?? 0);
  const anim = useRef(null);
  const live = useRef({ world, speedMs });
  live.current = { world, speedMs };

  useEffect(() => {
    if (fx && ['bump', 'harvest', 'plant', 'fail'].includes(fx.action)) {
      anim.current = { type: fx.action, age: 0 };
    }
  }, [fx?.id, fx]);

  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { world, speedMs } = live.current;
    const t = st.clock.elapsedTime;
    const g = root.current;
    if (!g) return;

    // glide toward the robot's grid cell, speed tied to the queue tempo
    const target = _v1.set(gx(world.robot.x), 0, gx(world.robot.y));
    const rate = Math.min(18, 5200 / speedMs);
    const k = 1 - Math.exp(-dt * rate);
    const delta = _v2.copy(target).sub(pos.current);
    pos.current.addScaledVector(delta, k);
    vel.current.lerp(delta.multiplyScalar(rate), 0.22);

    // face the walking direction (shortest-way turn)
    const targetYaw = YAW[world.robot.dir] ?? 0;
    let dy = ((targetYaw - yaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    yaw.current += dy * (1 - Math.exp(-dt * 10));
    if (yawGroup.current) yawGroup.current.rotation.y = yaw.current;

    // hover + lean into movement
    g.position.set(pos.current.x, 0.34 + Math.sin(t * 2.3) * 0.045, pos.current.z);
    g.rotation.x = THREE.MathUtils.clamp(vel.current.z * 0.05, -0.27, 0.27);
    g.rotation.z = THREE.MathUtils.clamp(-vel.current.x * 0.05, -0.27, 0.27);

    // action effects: bump shake / harvest-plant squash
    let sy = 1;
    if (anim.current) {
      anim.current.age += dt;
      const a = anim.current;
      if (a.type === 'bump' && a.age < 0.35) {
        const amp = Math.sin(a.age * 24) * 0.07 * (1 - a.age / 0.35);
        g.position.x += Math.sin(yaw.current) * amp;
        g.position.z += Math.cos(yaw.current) * amp;
      } else if ((a.type === 'harvest' || a.type === 'plant' || a.type === 'fail') && a.age < 0.3) {
        sy = 1 - 0.26 * Math.sin((Math.PI * a.age) / 0.3);
      } else if (a.age >= 0.35) {
        anim.current = null;
      }
    }
    g.scale.set(0.8 * (2 - sy), 0.8 * sy, 0.8 * (2 - sy));

    if (spin.current) spin.current.rotation.y += dt * 3;
  });

  return (
    <group ref={root} scale={0.8}>
      <group ref={yawGroup}>
        {/* mechanical backpack, shoulder joints and flight stabilizers */}
        <mesh position={[0,.25,-.19]} castShadow>
          <primitive object={BACKPACK} attach="geometry" />
          <meshStandardMaterial color="#283851" metalness={.55} roughness={.28} />
        </mesh>
        {[-1,1].map(side => <group key={side} position={[side*.24,.2,0]}>
          <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.065,.065,.08,16]}/><meshStandardMaterial color="#36475c" metalness={.65} roughness={.25}/></mesh>
          <mesh position={[side*.025,-.05,-.08]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.07,.015,8,20]}/><meshStandardMaterial color="#69e3f4" emissive="#39cce5" emissiveIntensity={1.3}/></mesh>
        </group>)}
        {/* head */}
        <mesh position={[0, 0.62, 0]} scale={[1, 0.95, 1]} castShadow>
          <sphereGeometry args={[0.34, 24, 18]} />
          <meshStandardMaterial color="#f1662a" roughness={0.35} />
        </mesh>
        {/* white face visor + dark rim */}
        <mesh position={[0, 0.63, 0.16]} scale={[1, 0.83, 0.55]}>
          <sphereGeometry args={[0.295, 24, 18]} />
          <meshStandardMaterial color="#fdf6ee" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.63, 0.3]} scale={[1, 0.85, 1]}>
          <torusGeometry args={[0.265, 0.022, 8, 28]} />
          <meshStandardMaterial color="#23262e" roughness={0.5} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.095, 0.655, 0.38]} scale={[1, 1.55, 0.7]}>
          <sphereGeometry args={[0.048, 12, 10]} />
          <meshStandardMaterial color="#17191f" roughness={0.2} />
        </mesh>
        <mesh position={[0.095, 0.655, 0.38]} scale={[1, 1.55, 0.7]}>
          <sphereGeometry args={[0.048, 12, 10]} />
          <meshStandardMaterial color="#17191f" roughness={0.2} />
        </mesh>
        {[-.095,.095].map(x=><mesh key={x} position={[x-.013,.685,.409]}><sphereGeometry args={[.012,8,6]}/><meshBasicMaterial color="white"/></mesh>)}
        {/* direction LED on the forehead */}
        <mesh position={[0, 0.84, 0.27]}>
          <sphereGeometry args={[0.025, 10, 8]} />
          <meshStandardMaterial color="#2fc8d6" emissive="#2fe3f2" emissiveIntensity={2.2} />
        </mesh>
        {/* body + arms + feet */}
        <mesh position={[0, 0.17, 0]} scale={[1, 1.05, 0.92]} castShadow>
          <sphereGeometry args={[0.23, 20, 16]} />
          <meshStandardMaterial color="#f1662a" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0.185]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.095, 0.095, 0.03, 18]} />
          <meshStandardMaterial color="#fdf6ee" roughness={0.35} />
        </mesh>
        <mesh position={[-0.265, 0.21, 0.02]} scale={[0.65, 1.25, 0.65]} castShadow>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color="#e85d20" roughness={0.4} />
        </mesh>
        <mesh position={[0.265, 0.21, 0.02]} scale={[0.65, 1.25, 0.65]} castShadow>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color="#e85d20" roughness={0.4} />
        </mesh>
        <mesh position={[-0.1, -0.03, 0.02]}>
          <sphereGeometry args={[0.075, 10, 8]} />
          <meshStandardMaterial color="#e85d20" roughness={0.4} />
        </mesh>
        <mesh position={[0.1, -0.03, 0.02]}>
          <sphereGeometry args={[0.075, 10, 8]} />
          <meshStandardMaterial color="#e85d20" roughness={0.4} />
        </mesh>
        {/* antenna + spinning molecule */}
        <mesh position={[0, 1.02, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.2, 8]} />
          <meshStandardMaterial color="#23262e" />
        </mesh>
        <group ref={spin} position={[0, 1.2, 0]}>
          <mesh>
            <sphereGeometry args={[0.055, 12, 10]} />
            <meshStandardMaterial color="#e23b3b" roughness={0.3} />
          </mesh>
          {MOLECULE.map((m, i) => (
            <React.Fragment key={i}>
              <mesh position={m.mid} quaternion={m.q}>
                <cylinderGeometry args={[0.012, 0.012, m.len, 6]} />
                <meshStandardMaterial color="#23262e" />
              </mesh>
              <mesh position={m.p}>
                <sphereGeometry args={[m.r, 10, 8]} />
                <meshStandardMaterial color={m.c} roughness={0.3} />
              </mesh>
            </React.Fragment>
          ))}
        </group>
      </group>
    </group>
  );
}

/* ---------------- harvest pop effects ---------------- */

function Pop({ kind, x, z }) {
  const ref = useRef();
  const mat = useRef();
  const age = useRef(0);
  useFrame((_, dt) => {
    age.current += Math.min(dt, 0.1);
    const a = age.current;
    const g = ref.current;
    if (!g) return;
    g.position.set(x, 0.42 + (1 - Math.exp(-a * 5)) * 0.95, z);
    g.rotation.y += dt * 3.5;
    const sIn = Math.min(1, a / 0.12);
    const sOut = a > 0.55 ? Math.max(0, 1 - (a - 0.55) / 0.35) : 1;
    g.scale.setScalar(Math.max(0.001, 0.55 * sIn * sOut));
    if (mat.current) mat.current.opacity = sOut;
  });
  return (
    <group ref={ref} position={[x, 0.42, z]}>
      <mesh geometry={POP_GEOS[kind]}>
        <meshStandardMaterial ref={mat} vertexColors transparent flatShading roughness={0.8} />
      </mesh>
    </group>
  );
}

function FxLayer({ fx }) {
  const [pops, setPops] = useState([]);
  useEffect(() => {
    if (!fx || fx.action !== 'harvest' || !fx.detail || !POP_GEOS[fx.detail]) return;
    const id = fx.id;
    setPops((p) => [...p.slice(-11), { id, kind: fx.detail, x: gx(fx.x), z: gx(fx.y) }]);
    setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 950);
  }, [fx?.id, fx]);
  return (
    <group>
      {pops.map((p) => (
        <Pop key={p.id} kind={p.kind} x={p.x} z={p.z} />
      ))}
    </group>
  );
}

/* ---------------- main component ---------------- */

const VIEWS = [
  {name:'ISO', label:'มุมเฉียง', pos:[12,13,12]},
  {name:'TOP', label:'มุมบน', pos:[0,20,.001]},
  {name:'NORTH', label:'มุมกลับ', pos:[-12,13,-12]},
];
function FixedCamera({view}) {
  const {camera, size} = useThree();
  const destination = useMemo(()=>new THREE.Vector3(...VIEWS[view].pos),[view]);
  useFrame((_,dt)=>{
    camera.position.lerp(destination,1-Math.exp(-dt*7));
    camera.lookAt(0,.15,0);
    // Fit the entire island, including coordinate labels, on narrow screens.
    const zoom = Math.min(size.width/13.8, size.height/11.8);
    if(Math.abs(camera.zoom-zoom)>.01) {camera.zoom=zoom;camera.updateProjectionMatrix();}
  });
  return null;
}
function SearchMarks({world}) {
  return <group>{Object.entries(world.marks || {}).map(([key,color])=>{
    const [x,y]=key.split(',').map(Number);
    return <mesh key={key} position={[gx(x),.018,gx(y)]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[.8,.8]}/><meshBasicMaterial color={MARK_COLORS[color]} transparent opacity={.75}/>
    </mesh>;
  })}</group>;
}
function Plinth({lab}) {
  return <group>
    <mesh position={[0,-.64,0]} receiveShadow castShadow>
      <primitive object={PLINTH} attach="geometry"/>
      <meshStandardMaterial color={lab?'#26364f':'#e3cfb6'} roughness={.5} metalness={lab?.3:0}/>
    </mesh>
    {[-1,1].map(side=><mesh key={side} position={[0,-.6,side*4.16]}>
      <boxGeometry args={[6.8,.035,.018]}/><meshStandardMaterial color={lab?'#69d4e5':'#f0ad65'} emissive={lab?'#29a4bd':'#000000'} emissiveIntensity={.7}/>
    </mesh>)}
    {[-3.7,3.7].flatMap(x=>[-3.7,3.7].map(z=><mesh key={`${x},${z}`} position={[x,-.87,z]} castShadow>
      <cylinderGeometry args={[.2,.28,.23,12]}/><meshStandardMaterial color="#44516a" metalness={.5} roughness={.4}/>
    </mesh>))}
  </group>;
}
const PLINTH = new RoundedBoxGeometry(8.45,.35,8.45,3,.12);

export default function GameWorld3D({world,fx,speedMs}) {
  const [view,setView]=useState(0);
  const lab=world.theme==='lab';
  return <div className={`world3d ${lab?'lab-world':''}`}>
    <div className="world-label"><span>{lab?'SUBLEVEL 02 / SEARCH VAULT':'SURFACE 01 / AUTOMATION GARDEN'}</span><small>AP LAB · SIMULATION</small></div>
    <Canvas shadows dpr={[1,1.75]} gl={{antialias:true}}>
      <color attach="background" args={[lab?'#e7edf4':'#f4f3ef']}/>
      <OrthographicCamera makeDefault position={[12,13,12]} zoom={40} near={.1} far={100}/>
      <FixedCamera view={view}/>
      <SoftShadows size={12} samples={8} focus={.5}/>
      <ambientLight intensity={.65}/>
      <hemisphereLight args={['#f7fbff','#b4a8a0',.7]}/>
      <directionalLight position={[5,12,4]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-camera-far={40} shadow-normalBias={.035}/>
      <directionalLight position={[-6,5,-5]} intensity={1.1} color="#abd8ff"/>
      <Plinth lab={lab}/>
      <Tiles world={world}/><SearchMarks world={world}/><Crops world={world}/>
      <TargetPad target={world.target}/>
      <Mascot key={world.theme} world={world} fx={fx} speedMs={speedMs}/>
      <FxLayer fx={fx}/>
      <ContactShadows position={[0,-1.02,0]} opacity={.35} scale={19} blur={2.5} far={4} resolution={512}/>
      <Grid position={[0,-1.04,0]} args={[40,40]} cellSize={1} cellThickness={.5} cellColor="#d3dbe3" sectionSize={4} sectionThickness={1} sectionColor="#bbc8d6" fadeDistance={30} infiniteGrid/>
    </Canvas>
    {lab && <div className="search-legend"><span className="frontier">● รอค้นหา</span><span className="visited">● สำรวจแล้ว</span><span className="path">● เส้นทาง</span></div>}
    <div className="view-controls" role="group" aria-label="มุมกล้อง">
      <span>VIEW</span>{VIEWS.map((v,i)=><button key={v.name} onClick={()=>setView(i)} className={view===i?'selected':''} aria-pressed={view===i} title={v.label}>{v.name}</button>)}
      <button onClick={()=>setView(0)} title="คืนมุมมองเริ่มต้น">↺</button>
    </div>
  </div>;
}
