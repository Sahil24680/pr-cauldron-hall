import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { softDot } from "./softDot";

export type BurstKind = "fireworks" | "smoke" | "gold" | "curse" | "charm";
export type BurstSpec = { id: string; kind: BurstKind; x: number; z: number };

type Recipe = { count: number; colors: string[]; speed: number; gravity: number; size: number; lifetime: number; height: number };

const RECIPES: Record<BurstKind, Recipe> = {
  fireworks: { count: 140, colors: ["#ff5a5a", "#ffd166", "#7cf29c", "#6cb8ff", "#d68cff"], speed: 6, gravity: 3, size: 0.22, lifetime: 2.4, height: 7 },
  smoke: { count: 60, colors: ["#c9c4bd", "#9e9891", "#ffffff"], speed: 1.3, gravity: -0.6, size: 0.35, lifetime: 1.6, height: 0.8 },
  gold: { count: 70, colors: ["#ffd166", "#ffe9a8", "#f5b83d"], speed: 2.4, gravity: 1.2, size: 0.16, lifetime: 1.8, height: 2 },
  curse: { count: 50, colors: ["#ff4b3a", "#ff8a5c", "#5a0f0f"], speed: 2.8, gravity: 2, size: 0.15, lifetime: 1.3, height: 2.4 },
  charm: { count: 50, colors: ["#5ce08a", "#b6ffcf", "#2fbf71"], speed: 2.2, gravity: 0.8, size: 0.15, lifetime: 1.4, height: 2.4 },
};

export function Burst({ spec }: { spec: BurstSpec }) {
  const recipe = RECIPES[spec.kind];
  const points = useRef<THREE.Points>(null);
  const age = useRef(0);
  const { geometry, velocities, material } = useMemo(() => {
    const positions = new Float32Array(recipe.count * 3);
    const colors = new Float32Array(recipe.count * 3);
    const velocities = new Float32Array(recipe.count * 3);
    const color = new THREE.Color();
    for (let index = 0; index < recipe.count; index++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = recipe.speed * (0.4 + Math.random() * 0.6);
      velocities.set([Math.sin(phi) * Math.cos(theta) * speed, Math.abs(Math.cos(phi)) * speed, Math.sin(phi) * Math.sin(theta) * speed], index * 3);
      positions.set([spec.x, recipe.height, spec.z], index * 3);
      color.set(recipe.colors[index % recipe.colors.length] ?? "#ffffff");
      colors.set([color.r, color.g, color.b], index * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: recipe.size,
      map: softDot(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, velocities, material };
  }, [recipe, spec.x, spec.z]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    age.current += delta;
    const position = geometry.getAttribute("position");
    for (let index = 0; index < recipe.count; index++) {
      velocities[index * 3 + 1] = (velocities[index * 3 + 1] ?? 0) - recipe.gravity * delta;
      position.setXYZ(
        index,
        position.getX(index) + (velocities[index * 3] ?? 0) * delta,
        position.getY(index) + (velocities[index * 3 + 1] ?? 0) * delta,
        position.getZ(index) + (velocities[index * 3 + 2] ?? 0) * delta,
      );
    }
    position.needsUpdate = true;
    material.opacity = Math.max(0, 1 - age.current / recipe.lifetime);
    if (points.current) {
      points.current.visible = material.opacity > 0;
    }
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

export function burstLifetimeMs(kind: BurstKind) {
  return RECIPES[kind].lifetime * 1000 + 200;
}
