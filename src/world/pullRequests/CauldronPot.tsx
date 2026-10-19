import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { CiState } from "../../../shared/stage";
import { darken } from "../../lib/color";
import { bubbleAt, smokePuffAt } from "../effects/brewMotion";
import { smokePuff } from "../effects/smokePuff";
import { softDot } from "../effects/softDot";
import { Chains } from "./Chains";
import type { Brew } from "./brew";
import { MAGIC_COLORS } from "./magicColors";

type Props = { brew: Brew; aimed: boolean; surging: { current: boolean } };

const BUBBLE_COUNT = 7;
const SMOKE_COUNT = 10;
const SMOKE = { color: "#4a4850", opacity: 1, speed: 0.22, spin: 0.25, sway: 0.12, base: 0.02 };
const POP_FLASH = { size: 0.32, opacity: 0.85 };
const BREW_Y = 0.66;
const RIM_Y = 0.84;
const BUBBLE_RISE = 0.45;
const BUBBLE_SPEED: Record<CiState, number> = { running: 1.6, passing: 0.6, failing: 1, none: 0.25 };
const SURGE_SPEED = 4;
const SURGE_RISE = 4;
const AIM_GLOW = { color: "#ffe9a8", opacity: 0.4, pulse: 0.12, speed: 4 };

const box = new THREE.BoxGeometry(1, 1, 1);
const potGeometry = new THREE.CylinderGeometry(0.58, 0.44, 0.72, 20, 1, true);
const potBase = new THREE.CircleGeometry(0.44, 20);
const rimGeometry = new THREE.TorusGeometry(0.58, 0.06, 8, 24);
const aimRimGeometry = new THREE.TorusGeometry(0.67, 0.035, 8, 40);
const brewGeometry = new THREE.CircleGeometry(0.54, 24);
const bubbleGeometry = new THREE.SphereGeometry(0.07, 16, 12);
const flameGeometry = new THREE.ConeGeometry(0.14, 0.4, 5);
const readyRing = new THREE.TorusGeometry(0.88, 0.06, 6, 32);
const flat = new THREE.Euler(-Math.PI / 2, 0, 0);

// A failing build outshines a ready one, so a stack with both still reads as needing attention.
function brewColors({ stale, ci, ready }: Brew) {
  if (stale) {
    return { surface: "#6f7175", bubble: "#8d8f93" };
  }
  if (ready && ci !== "failing") {
    return { surface: "#ffd166", bubble: "#fff1b0" };
  }
  return { surface: MAGIC_COLORS[ci], bubble: MAGIC_COLORS[ci] };
}

export function CauldronPot({ brew, aimed, surging }: Props) {
  const { ci, stale, ready, conflicted, heavy, stageColor } = brew;
  const { surface, bubble } = brewColors(brew);

  const materials = useMemo(() => {
    const make = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.5, transparent: true, side: THREE.DoubleSide });
    const glow = (color: string) => new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false });
    return {
      iron: make(stale ? "#8d8f93" : darken(stageColor, 0.7)),
      rim: make(stale ? "#9a9ca0" : stageColor),
      brew: glow(surface),
      bubble: new THREE.MeshStandardMaterial({ color: bubble, emissive: bubble, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.15, transparent: true }),
      flame: glow("#ff9a3c"),
      core: glow("#ffe08a"),
      chain: Object.assign(make("#3b3d42"), { roughness: 0.4, metalness: 0.9 }),
      padlock: Object.assign(make("#a8823a"), { roughness: 0.35, metalness: 0.85 }),
      gold: glow("#ffcc4d"),
      book: make("#7b3f2a"),
      bookAlt: make("#2e5b3a"),
      broom: make("#8a5a2b"),
      bristle: make("#d2b06a"),
    };
  }, [stale, surface, bubble, stageColor]);
  const popFlashes = useMemo(
    () =>
      Array.from(
        { length: BUBBLE_COUNT },
        () =>
          new THREE.SpriteMaterial({
            map: softDot(),
            color: bubble,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
      ),
    [bubble],
  );
  const smokePuffs = useMemo(
    () => Array.from({ length: SMOKE_COUNT }, () => new THREE.SpriteMaterial({ map: smokePuff(), color: SMOKE.color, transparent: true, depthWrite: false })),
    [],
  );
  const aimGlow = useMemo(
    () => new THREE.MeshBasicMaterial({ color: AIM_GLOW.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  );

  const bubbles = useRef<THREE.Group>(null);
  const flashes = useRef<THREE.Group>(null);
  const smoke = useRef<THREE.Group>(null);
  const fire = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const aimRim = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const surge = surging.current;
    const speed = surge ? SURGE_SPEED : BUBBLE_SPEED[ci];
    bubbles.current?.children.forEach((bubble, index) => {
      const progress = (t * speed + index / BUBBLE_COUNT) % 1;
      const angle = index * 2.4;
      const spread = 0.08 + 0.13 * (index % 3);
      const x = Math.cos(angle) * spread;
      const z = Math.sin(angle) * spread;
      const flash = flashes.current?.children[index];
      const flashMaterial = popFlashes[index];
      if (surge) {
        bubble.position.set(x, BREW_Y + progress * BUBBLE_RISE * SURGE_RISE, z);
        bubble.scale.setScalar(stale ? 0 : 0.6 + Math.sin(progress * Math.PI) * 0.7);
        if (flashMaterial) {
          flashMaterial.opacity = 0;
        }
        return;
      }
      const { lift, size, flash: flashing } = bubbleAt(progress);
      bubble.position.set(x, BREW_Y + lift, z);
      bubble.scale.setScalar(stale ? 0 : size);
      flash?.position.set(x, BREW_Y + lift, z);
      flash?.scale.setScalar(POP_FLASH.size * (1.5 - flashing * 0.5));
      if (flashMaterial) {
        flashMaterial.opacity = stale ? 0 : flashing * POP_FLASH.opacity;
      }
    });
    if (smoke.current) {
      smoke.current.visible = ci === "failing" && !stale;
      smoke.current.children.forEach((puff, index) => {
        const material = smokePuffs[index];
        if (!material) {
          return;
        }
        const progress = (t * SMOKE.speed + index / SMOKE_COUNT) % 1;
        const { rise, size, opacity: fade } = smokePuffAt(progress);
        const phase = index * 2.3;
        const drift = SMOKE.sway * (0.5 + progress);
        puff.position.set(Math.sin(phase + t * 0.7) * drift, BREW_Y + SMOKE.base + rise, Math.cos(phase + t * 0.5) * drift);
        puff.scale.setScalar(size);
        material.opacity = fade * SMOKE.opacity;
        material.rotation = phase + t * SMOKE.spin * (index % 2 === 0 ? 1 : -1);
      });
    }
    if (fire.current) {
      fire.current.visible = !stale;
      fire.current.children.forEach((flame, index) => {
        flame.scale.set(1, 0.8 + Math.abs(Math.sin(t * 10 + index * 1.7)) * 0.6, 1);
      });
    }
    if (ring.current) {
      ring.current.rotation.z = t * 0.6;
      ring.current.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
    }
    if (aimRim.current) {
      aimRim.current.visible = aimed;
      aimGlow.opacity = AIM_GLOW.opacity + Math.sin(t * AIM_GLOW.speed) * AIM_GLOW.pulse;
    }
  });

  return (
    <>
      <mesh geometry={potGeometry} material={materials.iron} position={[0, 0.48, 0]} />
      <mesh geometry={potBase} material={materials.iron} rotation={flat} position={[0, 0.12, 0]} />
      <mesh geometry={rimGeometry} material={materials.rim} rotation={flat} position={[0, RIM_Y, 0]} />
      <mesh ref={aimRim} geometry={aimRimGeometry} material={aimGlow} rotation={flat} position={[0, RIM_Y, 0]} visible={false} />
      <mesh geometry={brewGeometry} material={materials.brew} rotation={flat} position={[0, BREW_Y, 0]} />
      {[0, 2.1, 4.2].map((angle) => (
        <mesh key={angle} geometry={box} material={materials.iron} scale={[0.08, 0.2, 0.08]} position={[Math.cos(angle) * 0.36, 0.1, Math.sin(angle) * 0.36]} />
      ))}

      <group ref={fire} position={[0, 0.12, 0]}>
        {[0, 1.6, 3.2, 4.8].map((angle) => (
          <mesh
            key={angle}
            geometry={flameGeometry}
            material={angle === 0 ? materials.core : materials.flame}
            position={[Math.cos(angle) * 0.18, 0.05, Math.sin(angle) * 0.18]}
          />
        ))}
      </group>

      <group ref={bubbles}>
        {Array.from({ length: BUBBLE_COUNT }, (_, index) => (
          <mesh key={index} geometry={bubbleGeometry} material={materials.bubble} renderOrder={1} />
        ))}
      </group>
      <group ref={flashes}>
        {popFlashes.map((material, index) => (
          <sprite key={index} material={material} />
        ))}
      </group>

      <group ref={smoke} visible={false}>
        {smokePuffs.map((material, index) => (
          <sprite key={index} material={material} />
        ))}
      </group>

      {conflicted && <Chains iron={materials.chain} brass={materials.padlock} />}

      {ready && (
        <>
          <mesh ref={ring} geometry={readyRing} material={materials.gold} rotation={flat} position={[0, 0.03, 0]} />
          <group position={[0.7, 0.62, 0.15]} rotation={[0.1, 0, -0.35]}>
            <mesh geometry={box} material={materials.broom} scale={[0.05, 1.2, 0.05]} />
            <mesh geometry={box} material={materials.bristle} scale={[0.18, 0.34, 0.18]} position={[0, -0.62, 0]} />
          </group>
        </>
      )}

      {heavy && (
        <group position={[-0.95, 0, 0.2]}>
          <mesh geometry={box} material={materials.book} scale={[0.42, 0.12, 0.32]} position={[0, 0.06, 0]} />
          <mesh geometry={box} material={materials.bookAlt} scale={[0.38, 0.12, 0.3]} position={[0.02, 0.18, 0]} rotation={[0, 0.3, 0]} />
          <mesh geometry={box} material={materials.book} scale={[0.36, 0.11, 0.28]} position={[-0.01, 0.295, 0]} rotation={[0, -0.25, 0]} />
          <mesh geometry={box} material={materials.bookAlt} scale={[0.34, 0.1, 0.26]} position={[0.01, 0.4, 0]} rotation={[0, 0.5, 0]} />
        </group>
      )}
    </>
  );
}
