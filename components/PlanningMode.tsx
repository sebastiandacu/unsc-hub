"use client";

/**
 * Planning Mode 3D — holographic projection of an event-bearing planet
 * with a UNSC frigate orbiting it. Each event becomes a ping anchored
 * either to a deterministic surface point or to the ship hull, depending
 * on its planningTarget. Drag to rotate, wheel to zoom, click the planet
 * name to rename it.
 *
 * Heavy module — three.js + GLB loader. Always import via
 * next/dynamic({ ssr: false }) to keep it out of the initial bundle.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  setPlanetName as setPlanetNameAction,
  setShipName as setShipNameAction,
} from "@/lib/actions/planning";

export type PlanningEvent = {
  /** Stable code: usually slug of the title. */
  code: string;
  title: string;
  /** "planet" = surface pin, "ship" = on the frigate. */
  target: "planet" | "ship";
  color: "primary" | "amber" | "red" | "green";
};

const COLOR_MAP: Record<PlanningEvent["color"], number> = {
  primary: 0x4dd0ff,
  amber: 0xffb547,
  red: 0xff5252,
  green: 0x4ade80,
};

// ---------------------------------------------------------------
// Deterministic hash → lat/lon for surface pin distribution
// ---------------------------------------------------------------
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function eventToLatLon(code: string): { lat: number; lon: number } {
  const h = hashCode(code);
  const lat = ((h % 1000) / 1000) * Math.PI - Math.PI / 2;
  const lon = (((h / 1000) | 0) % 1000) / 1000 * Math.PI * 2;
  return { lat, lon };
}
function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    r * Math.cos(lat) * Math.sin(lon),
  );
}

// ---------------------------------------------------------------
// Procedural fallback frigate (used until the GLB loads)
// ---------------------------------------------------------------
function buildFrigate(): THREE.Group {
  const group = new THREE.Group();
  const primary = 0x4dd0ff;
  const amber = 0xffb547;

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x2a3140,
    metalness: 0.55,
    roughness: 0.62,
    emissive: 0x06121e,
    emissiveIntensity: 0.25,
  });
  const hullDark = new THREE.MeshStandardMaterial({
    color: 0x1a2030,
    metalness: 0.6,
    roughness: 0.6,
  });
  const accentLine = new THREE.LineBasicMaterial({ color: primary, transparent: true, opacity: 0.55 });
  const glowCyan = new THREE.MeshBasicMaterial({ color: primary, transparent: true, opacity: 0.85 });
  const glowAmber = new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0.85 });

  // Main hull (extruded arrowhead shape)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 3.4);
  hullShape.lineTo(0.55, 1.6);
  hullShape.lineTo(0.72, -0.4);
  hullShape.lineTo(0.62, -2.4);
  hullShape.lineTo(0.0, -2.8);
  hullShape.lineTo(-0.62, -2.4);
  hullShape.lineTo(-0.72, -0.4);
  hullShape.lineTo(-0.55, 1.6);
  hullShape.lineTo(0, 3.4);

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  hullGeo.center();
  hullGeo.rotateX(-Math.PI / 2);
  group.add(new THREE.Mesh(hullGeo, hullMat));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(hullGeo, 18), accentLine));

  // Dorsal MAC spine + barrel
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 4.4), hullMat);
  spine.position.set(0, 0.28, 0);
  group.add(spine);
  const macBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 1.2, 12),
    hullDark,
  );
  macBarrel.rotation.x = Math.PI / 2;
  macBarrel.position.set(0, 0.28, 2.6);
  group.add(macBarrel);

  // Bridge
  const bridgeBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.7), hullMat);
  bridgeBase.position.set(0, 0.42, 0.9);
  group.add(bridgeBase);
  const bridgeWindow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.45), glowCyan);
  bridgeWindow.position.set(0, 0.65, 1.05);
  group.add(bridgeWindow);

  // Wing sponsons (angled)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(1.6, 0.3);
  wingShape.lineTo(1.7, -0.4);
  wingShape.lineTo(0, -0.7);
  wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  wingGeo.center();
  wingGeo.rotateX(-Math.PI / 2);
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo.clone(), hullMat);
    wing.scale.x = sx;
    wing.rotation.z = sx * (-25 * Math.PI / 180);
    wing.position.set(sx * 0.55, -0.05, -0.2);
    group.add(wing);

    const angle = 25 * Math.PI / 180;
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.9, 12), hullDark);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(
      sx * (0.55 + 1.5 * Math.cos(angle)),
      -0.05 - 1.5 * Math.sin(angle),
      -0.4,
    );
    group.add(pod);

    const podThrust = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), glowAmber);
    podThrust.position.copy(pod.position);
    podThrust.position.z -= 0.5;
    podThrust.scale.z = 1.6;
    group.add(podThrust);
  }

  // Engine block
  const engBlock = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.42, 0.7), hullMat);
  engBlock.position.set(0, 0, -2.55);
  group.add(engBlock);
  const nozzles: [number, number, number, number][] = [
    [-0.34, -0.04, 0.18, 0.20],
    [0.0, -0.04, 0.20, 0.22],
    [0.34, -0.04, 0.18, 0.20],
    [-0.22, 0.24, 0.12, 0.14],
    [0.22, 0.24, 0.12, 0.14],
  ];
  for (const [x, y, rTop, rBot] of nozzles) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 0.36, 14), hullDark);
    noz.rotation.x = Math.PI / 2;
    noz.position.set(x, y, -3.0);
    group.add(noz);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(rTop * 0.85, 16),
      new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0.95 }),
    );
    inner.position.set(x, y, -3.17);
    group.add(inner);
  }

  group.scale.setScalar(0.95);
  return group;
}

// ---------------------------------------------------------------
// Planet
// ---------------------------------------------------------------
function buildPlanet(radius = 2.6): THREE.Group {
  const group = new THREE.Group();
  const primary = 0x4dd0ff;

  const wire = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 36, 18),
    new THREE.MeshBasicMaterial({ color: primary, wireframe: true, transparent: true, opacity: 0.45 }),
  );
  group.add(wire);

  const solid = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.985, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x040a18 }),
  );
  group.add(solid);

  for (const [r, op, ty] of [
    [radius * 1.001, 0.9, 0],
    [radius * 0.92, 0.5, radius * 0.4],
    [radius * 0.92, 0.5, -radius * 0.4],
  ] as const) {
    const ringR = Math.sqrt(r * r - ty * ty);
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(ringR, 0.012, 8, 64),
      new THREE.MeshBasicMaterial({ color: primary, transparent: true, opacity: op }),
    );
    torus.rotation.x = Math.PI / 2;
    torus.position.y = ty;
    group.add(torus);
  }

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.18, 32, 16),
    new THREE.MeshBasicMaterial({
      color: primary,
      transparent: true,
      opacity: 0.10,
      side: THREE.BackSide,
    }),
  );
  group.add(halo);

  // Surface scatter dots
  const dotGeo = new THREE.BufferGeometry();
  const dotPositions: number[] = [];
  for (let i = 0; i < 220; i++) {
    const lat = (Math.random() - 0.5) * Math.PI;
    const lon = Math.random() * Math.PI * 2;
    const p = latLonToVec3(lat, lon, radius * 1.005);
    dotPositions.push(p.x, p.y, p.z);
  }
  dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(dotPositions, 3));
  group.add(
    new THREE.Points(
      dotGeo,
      new THREE.PointsMaterial({ color: primary, size: 0.025, transparent: true, opacity: 0.7 }),
    ),
  );

  return group;
}

// ---------------------------------------------------------------
// Pings
// ---------------------------------------------------------------
function buildPing(lat: number, lon: number, radius: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const pos = latLonToVec3(lat, lon, radius * 1.01);
  group.position.copy(pos);
  group.lookAt(pos.clone().multiplyScalar(2));

  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 12, 12),
      new THREE.MeshBasicMaterial({ color }),
    ),
  );

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.6, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
  );
  beacon.rotation.x = Math.PI / 2;
  beacon.position.z = 0.3;
  group.add(beacon);

  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.07, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    group.add(ring);
    rings.push(ring);
  }
  group.userData = { rings };
  return group;
}

function buildShipPing(color: number, scale = 1): THREE.Group {
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.05 * scale, 12, 12),
      new THREE.MeshBasicMaterial({ color }),
    ),
  );
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.06 * scale, 0.085 * scale, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    group.add(ring);
    rings.push(ring);
  }
  group.userData = { rings };
  return group;
}

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------
export function PlanningMode({
  events,
  initialPlanetName,
  initialShipName,
  canEditLabels = false,
}: {
  events: PlanningEvent[];
  initialPlanetName: string;
  initialShipName: string;
  /** When true, the planet AND ship labels become click-to-edit (admin only). */
  canEditLabels?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [autoOrbit, setAutoOrbit] = useState(true);

  // Planet label state
  const [editingPlanet, setEditingPlanet] = useState(false);
  const [planetName, setPlanetName] = useState(initialPlanetName);
  const [planetDraft, setPlanetDraft] = useState(initialPlanetName);

  // Ship label state
  const [editingShip, setEditingShip] = useState(false);
  const [shipName, setShipName] = useState(initialShipName);
  const [shipDraft, setShipDraft] = useState(initialShipName);

  const [pending, start] = useTransition();
  const stateRef = useRef<{ autoEnabled?: boolean; setAutoOrbit?: (v: boolean) => void }>({});

  useEffect(() => {
    const mount = mountRef.current;
    const labelsEl = labelsRef.current;
    if (!mount || !labelsEl) return;

    const W = mount.clientWidth;
    const H = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
    camera.position.set(0, 1.5, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x4dd0ff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(5, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x4dd0ff, 0.9);
    rim.position.set(-6, 2, -4);
    scene.add(rim);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starPos: number[] = [];
    for (let i = 0; i < 600; i++) {
      const r = 40 + Math.random() * 30;
      const lat = (Math.random() - 0.5) * Math.PI;
      const lon = Math.random() * Math.PI * 2;
      const p = latLonToVec3(lat, lon, r);
      starPos.push(p.x, p.y, p.z);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xa0c8ff, size: 0.06, transparent: true, opacity: 0.55 }),
      ),
    );

    const PLANET_R = 2.6;
    const planet = buildPlanet(PLANET_R);
    scene.add(planet);

    const frigateOrbit = new THREE.Group();
    scene.add(frigateOrbit);
    const shipMount = new THREE.Group();
    shipMount.position.set(0, 1.0, 4.2);
    shipMount.rotation.y = -Math.PI / 2;
    frigateOrbit.add(shipMount);

    let shipModel: THREE.Object3D = buildFrigate();
    let shipBBox = new THREE.Box3().setFromObject(shipModel);
    shipMount.add(shipModel);

    const shipPingsGroup = new THREE.Group();
    shipMount.add(shipPingsGroup);

    // Build pings
    const planetPings: THREE.Group[] = [];
    const shipPings: THREE.Group[] = [];
    events.forEach((ev, i) => {
      const color = COLOR_MAP[ev.color] ?? COLOR_MAP.primary;
      if (ev.target === "ship") {
        const ping = buildShipPing(color, 1.0);
        ping.userData.event = ev;
        ping.userData.color = color;
        shipPings.push(ping);
        shipPingsGroup.add(ping);
      } else {
        const { lat, lon } = eventToLatLon(ev.code + i);
        const ping = buildPing(lat, lon, PLANET_R, color);
        ping.userData.event = ev;
        ping.userData.color = color;
        planet.add(ping);
        planetPings.push(ping);
      }
    });

    function placeShipPings(bbox: THREE.Box3) {
      const size = new THREE.Vector3();
      bbox.getSize(size);
      shipPings.forEach((ping) => {
        const ev = ping.userData.event as PlanningEvent;
        const h = hashCode(ev.code + "ship");
        const fx = (h % 1000) / 1000;
        const fy = ((h / 1000) | 0) % 1000 / 1000;
        const fz = ((h / 1000000) | 0) % 1000 / 1000;
        const inflate = 1.18;
        ping.position.set(
          (bbox.min.x + fx * size.x) * inflate,
          (bbox.min.y + fy * size.y) * inflate + size.y * 0.5,
          (bbox.min.z + fz * size.z) * inflate,
        );
      });
    }
    placeShipPings(shipBBox);

    // Try the GLB; fall back silently if absent or blocked.
    try {
      const loader = new GLTFLoader();
      loader.load(
        "/models/unsc_frigate.glb",
        (gltf) => {
          shipMount.remove(shipModel);
          const ship = gltf.scene;
          const box = new THREE.Box3().setFromObject(ship);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const fit = 3.5 / maxDim;
          ship.scale.setScalar(fit);
          ship.position.sub(center.multiplyScalar(fit));

          const holoColor = new THREE.Color(0x4dd0ff);
          ship.traverse((obj) => {
            const m = obj as THREE.Mesh;
            if ((m as THREE.Mesh).isMesh) {
              m.material = new THREE.MeshStandardMaterial({
                color: holoColor,
                emissive: holoColor,
                emissiveIntensity: 0.55,
                metalness: 0.1,
                roughness: 0.4,
                transparent: true,
                opacity: 0.42,
                depthWrite: false,
                side: THREE.DoubleSide,
              });
              if (m.geometry) {
                const wire = new THREE.LineSegments(
                  new THREE.EdgesGeometry(m.geometry, 20),
                  new THREE.LineBasicMaterial({ color: holoColor, transparent: true, opacity: 0.55 }),
                );
                m.add(wire);
              }
            }
          });

          shipBBox = new THREE.Box3().setFromObject(ship);
          shipMount.add(ship);
          shipModel = ship;
          placeShipPings(shipBBox);
        },
        undefined,
        () => {
          /* silent fallback */
        },
      );
    } catch {
      /* GLB not available — keep procedural */
    }

    // Camera control
    const camState = {
      theta: Math.PI / 6,
      phi: 0.2,
      dist: 9,
      target: new THREE.Vector3(0, 0, 0),
      vTheta: 0.0008,
    };
    const applyCam = () => {
      const x = camState.dist * Math.cos(camState.phi) * Math.sin(camState.theta);
      const y = camState.dist * Math.sin(camState.phi);
      const z = camState.dist * Math.cos(camState.phi) * Math.cos(camState.theta);
      camera.position.set(x, y, z);
      camera.lookAt(camState.target);
    };
    applyCam();

    // Drag + zoom
    let drag = false;
    let lastX = 0;
    let lastY = 0;
    const el = renderer.domElement;
    el.style.cursor = "grab";
    const onPointerDown = (e: PointerEvent) => {
      drag = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.style.cursor = "grabbing";
      stateRef.current.autoEnabled = false;
    };
    const onPointerUp = () => {
      drag = false;
      el.style.cursor = "grab";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      camState.theta -= dx * 0.005;
      camState.phi = Math.max(-1.2, Math.min(1.2, camState.phi + dy * 0.005));
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camState.dist = Math.max(5, Math.min(20, camState.dist + e.deltaY * 0.005));
    };
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    el.addEventListener("wheel", onWheel, { passive: false });

    // Labels
    const allPings = [...planetPings, ...shipPings];
    const labelDivs = allPings.map((p) => {
      const ev = p.userData.event as PlanningEvent;
      const d = document.createElement("div");
      d.className = "plan-label";
      const isShip = ev.target === "ship";
      d.innerHTML = `
        <div class="plan-label-inner">
          <span class="plan-label-code">${ev.code}${isShip ? " · NAVE" : ""}</span>
          <span class="plan-label-name">${ev.title}</span>
        </div>
        <div class="plan-label-stem"></div>
      `;
      d.style.setProperty("--c", "#" + (p.userData.color as number).toString(16).padStart(6, "0"));
      labelsEl.appendChild(d);
      return d;
    });

    // Animation loop
    let t0 = performance.now();
    let raf = 0;
    stateRef.current.autoEnabled = true;
    stateRef.current.setAutoOrbit = (v: boolean) => {
      stateRef.current.autoEnabled = v;
    };

    const animate = () => {
      const t = (performance.now() - t0) / 1000;
      planet.rotation.y = t * 0.04;
      frigateOrbit.rotation.y = t * 0.05;
      shipMount.rotation.x = Math.sin(t * 0.6) * 0.03;
      shipMount.position.y = 1.0 + Math.sin(t * 0.6) * 0.08;

      if (stateRef.current.autoEnabled) camState.theta += camState.vTheta;
      applyCam();

      allPings.forEach((ping, i) => {
        const isShip = shipPings.includes(ping);
        const rings = ping.userData.rings as THREE.Mesh[];
        rings.forEach((ring, ri) => {
          const p = ((t * (isShip ? 0.7 : 0.5)) + ri / 3 + i * 0.07) % 1;
          const s = (isShip ? 0.3 : 0.4) + p * (isShip ? 4 : 6);
          ring.scale.set(s, s, 1);
          (ring.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.7;
          if (isShip) ring.lookAt(camera.getWorldPosition(new THREE.Vector3()));
        });
      });

      // Position HTML labels
      const rect = el.getBoundingClientRect();
      const planetWorld = new THREE.Vector3();
      planet.getWorldPosition(planetWorld);
      allPings.forEach((ping, i) => {
        const worldPos = new THREE.Vector3();
        ping.getWorldPosition(worldPos);
        let facing = true;
        if (planetPings.includes(ping)) {
          const toPing = worldPos.clone().sub(planetWorld);
          const toCam = camera.position.clone().sub(planetWorld);
          facing = toPing.dot(toCam) > 0;
        }
        const proj = worldPos.clone().project(camera);
        const sx = (proj.x * 0.5 + 0.5) * rect.width;
        const sy = (-proj.y * 0.5 + 0.5) * rect.height;
        const div = labelDivs[i];
        div.style.transform = `translate(${sx}px, ${sy}px)`;
        div.style.opacity = facing && proj.z < 1 ? "1" : "0";
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.remove();
      labelDivs.forEach((d) => d.remove());
    };
  }, [events]);

  useEffect(() => {
    if (stateRef.current.setAutoOrbit) stateRef.current.setAutoOrbit(autoOrbit);
  }, [autoOrbit]);

  function commitPlanet() {
    setEditingPlanet(false);
    const trimmed = planetDraft.trim().toUpperCase();
    if (!trimmed || trimmed === planetName) return;
    setPlanetName(trimmed);
    start(async () => {
      try {
        await setPlanetNameAction(trimmed);
      } catch (e) {
        console.error("[planning] persist planet name failed", e);
      }
    });
  }

  function commitShip() {
    setEditingShip(false);
    const trimmed = shipDraft.trim().toUpperCase();
    if (!trimmed || trimmed === shipName) return;
    setShipName(trimmed);
    start(async () => {
      try {
        await setShipNameAction(trimmed);
      } catch (e) {
        console.error("[planning] persist ship name failed", e);
      }
    });
  }

  const planetCount = events.filter((e) => e.target !== "ship").length;
  const shipCount = events.filter((e) => e.target === "ship").length;

  return (
    <div
      className="relative w-full overflow-hidden border border-[var(--color-border)]"
      style={{
        height: 620,
        background: "linear-gradient(180deg, #02060e 0%, #050a18 60%, #02060e 100%)",
      }}
    >
      {/* Corner brackets */}
      <div className="plan-corner" style={{ top: 14, left: 14, borderTop: "1px solid var(--color-accent)", borderLeft: "1px solid var(--color-accent)" }} />
      <div className="plan-corner" style={{ top: 14, right: 14, borderTop: "1px solid var(--color-accent)", borderRight: "1px solid var(--color-accent)" }} />
      <div className="plan-corner" style={{ bottom: 14, left: 14, borderBottom: "1px solid var(--color-accent)", borderLeft: "1px solid var(--color-accent)" }} />
      <div className="plan-corner" style={{ bottom: 14, right: 14, borderBottom: "1px solid var(--color-accent)", borderRight: "1px solid var(--color-accent)" }} />

      {/* Top-left HUD with editable ship name */}
      <div
        className="absolute z-[5] uppercase"
        style={{
          top: 22,
          left: 24,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-muted)",
          letterSpacing: "0.22em",
        }}
      >
        // PLANNING MODE · HOLO-PROYECCIÓN
        <br />
        NAVE:&nbsp;
        {editingShip ? (
          <input
            autoFocus
            value={shipDraft}
            onChange={(e) => setShipDraft(e.target.value)}
            onBlur={commitShip}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitShip();
              if (e.key === "Escape") {
                setShipDraft(shipName);
                setEditingShip(false);
              }
            }}
            style={{
              background: "rgba(77,208,255,0.08)",
              border: "1px solid var(--color-accent)",
              padding: "2px 6px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.22em",
              color: "var(--color-accent)",
              textTransform: "uppercase",
              outline: "none",
              width: 280,
            }}
          />
        ) : (
          <span
            onClick={() => canEditLabels && setEditingShip(true)}
            style={{
              color: "var(--color-accent)",
              cursor: canEditLabels ? "pointer" : "default",
            }}
            title={canEditLabels ? "Click para renombrar (admin)" : undefined}
          >
            {shipName}
            {canEditLabels && (
              <span style={{ opacity: 0.5, fontSize: 9, marginLeft: 4 }}>✎</span>
            )}
          </span>
        )}
        <br />
        <span style={{ color: "var(--color-amber)", fontSize: 9 }}>
          {shipCount} EVENTOS A BORDO
        </span>
      </div>

      {/* Top-right HUD with editable planet name */}
      <div
        className="absolute z-[5] uppercase text-right"
        style={{
          top: 22,
          right: 24,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-muted)",
          letterSpacing: "0.22em",
        }}
      >
        OBJETIVO:&nbsp;
        {editingPlanet ? (
          <input
            autoFocus
            value={planetDraft}
            onChange={(e) => setPlanetDraft(e.target.value)}
            onBlur={commitPlanet}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPlanet();
              if (e.key === "Escape") {
                setPlanetDraft(planetName);
                setEditingPlanet(false);
              }
            }}
            style={{
              background: "rgba(77,208,255,0.08)",
              border: "1px solid var(--color-accent)",
              padding: "2px 6px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.22em",
              color: "var(--color-accent)",
              textTransform: "uppercase",
              outline: "none",
              width: 160,
              textAlign: "right",
            }}
          />
        ) : (
          <span
            onClick={() => canEditLabels && setEditingPlanet(true)}
            style={{
              color: "var(--color-accent)",
              cursor: canEditLabels ? "pointer" : "default",
            }}
            title={canEditLabels ? "Click para renombrar (admin)" : undefined}
          >
            {planetName}
            {canEditLabels && (
              <span style={{ opacity: 0.5, fontSize: 9, marginLeft: 4 }}>✎</span>
            )}
          </span>
        )}
        <br />
        <span style={{ color: "var(--color-accent)" }}>
          {planetCount} PUNTOS DE INTERÉS · SUPERFICIE
        </span>
        {pending && (
          <span style={{ color: "var(--color-amber)", display: "block", fontSize: 9, marginTop: 2 }}>
            guardando...
          </span>
        )}
      </div>

      {/* Bottom-left help */}
      <div
        className="absolute z-[5] uppercase"
        style={{
          bottom: 22,
          left: 24,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-muted)",
          letterSpacing: "0.2em",
        }}
      >
        ARRASTRÁ PARA ROTAR · RUEDA PARA ZOOM
      </div>

      {/* Bottom-right control */}
      <div className="absolute z-[5]" style={{ bottom: 22, right: 24 }}>
        <button
          onClick={() => setAutoOrbit(!autoOrbit)}
          className="btn"
          style={{ padding: "5px 10px", fontSize: 9, background: "rgba(0,0,0,0.5)" }}
        >
          {autoOrbit ? "⏸ PAUSAR ÓRBITA" : "▶ AUTO-ÓRBITA"}
        </button>
      </div>

      <div ref={mountRef} className="absolute inset-0" />
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none z-[4]" />
    </div>
  );
}
