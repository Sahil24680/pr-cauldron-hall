import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { compartmentShade, runeStrip } from "../textures";
import { type BillboardSize, Billboards } from "./Billboards";
import { PotionSet } from "./PotionSet";
import { ShelfCharms } from "./ShelfCharms";
import { books, instancedBooks } from "./bookMaterial";
import { type Book, type BookcaseSpot, buildBookcases } from "./bookcaseParts";
import { merged } from "./geometryKit";
import { billboardQuad, createGlowMaterial, flameQuad } from "./glowShaders";
import { candleFlame, candleHalo, candleWax, carvedOak, clearGlass, crystal, darkOak, gold, sealBrass, shadowWood } from "./materials";
import type { Spill } from "./potionParts";

type Props = { spots: BookcaseSpot[] };

const SEED = 17;
const RUNE_PULSE_RATE = 0.6;
const RUNE_GLOW = { low: 0.18, high: 0.42 };
const FLAME_SIZES: BillboardSize[] = [[0.045, 0.1]];
const CANDLE_HALO_SIZES: BillboardSize[] = [[0.26, 0.26]];
const CURIO_GLOW_SIZES: BillboardSize[] = [[0.34, 0.34]];
const NO_SPILLS: Spill[] = [];

const runes = new THREE.MeshBasicMaterial({
  map: runeStrip(),
  color: new THREE.Color("#7fb8ff"),
  transparent: true,
  opacity: RUNE_GLOW.low,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const compartmentDark = new THREE.MeshBasicMaterial({ color: "#000000", alphaMap: compartmentShade(), transparent: true, opacity: 0.8, depthWrite: false });
const parchment = new THREE.MeshStandardMaterial({ color: "#d8c49a", roughness: 0.9 });
const bone = new THREE.MeshStandardMaterial({ color: "#d9cdb2", roughness: 0.65 });
const soot = new THREE.MeshStandardMaterial({ color: "#151215", roughness: 0.9 });
const ribbon = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
const sand = new THREE.MeshStandardMaterial({ color: "#d9a650", roughness: 1, emissive: "#ffb347", emissiveIntensity: 0.25 });
const orbCore = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false });
const curioGlow = createGlowMaterial({ color: "#ffffff", intensity: 0.4, pulse: 0.15 });

function ShelvedBooks({ list }: { list: Book[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => instancedBooks(list), [list]);
  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) {
      return;
    }
    list.forEach((book, index) => {
      instances.setMatrixAt(index, book.matrix);
      instances.setColorAt(index, book.color);
    });
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) {
      instances.instanceColor.needsUpdate = true;
    }
    instances.computeBoundingSphere();
  }, [list]);
  return <instancedMesh ref={mesh} args={[geometry, books, list.length]} />;
}

export function Bookcases({ spots }: Props) {
  const built = useMemo(() => buildBookcases(spots, SEED), [spots]);
  const curios = useMemo(
    () => ({
      parchment: merged(built.curios.parchment),
      bone: merged(built.curios.bone),
      brass: merged(built.curios.brass),
      soot: merged(built.curios.soot),
      wood: merged(built.curios.wood),
      ribbon: merged(built.curios.ribbon),
      sand: merged(built.curios.sand),
      clearGlass: merged(built.curios.clearGlass),
      crystals: merged(built.curios.crystals),
      wax: merged(built.curios.wax),
      orbCores: merged(built.curios.orbCores),
      glowAt: built.curios.glows.map((glow) => glow.at),
      glowTints: built.curios.glows.map((glow) => glow.color),
    }),
    [built],
  );
  useFrame((state) => {
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * RUNE_PULSE_RATE);
    runes.opacity = THREE.MathUtils.lerp(RUNE_GLOW.low, RUNE_GLOW.high, pulse);
  });
  return (
    <group>
      <mesh geometry={built.frame.oak} material={carvedOak} />
      <mesh geometry={built.frame.dark} material={darkOak} />
      <mesh geometry={built.frame.shadow} material={shadowWood} />
      <mesh geometry={built.frame.brass} material={gold} />
      <mesh geometry={built.frame.runes} material={runes} />
      <mesh geometry={built.frame.shade} material={compartmentDark} />
      <mesh geometry={built.frame.seal} material={sealBrass} />
      <ShelvedBooks list={built.books} />
      <ShelfCharms floating={built.floating} sliding={built.sliding} dusters={built.dusters} />
      <mesh geometry={curios.parchment} material={parchment} />
      <mesh geometry={curios.bone} material={bone} />
      <mesh geometry={curios.brass} material={gold} />
      <mesh geometry={curios.soot} material={soot} />
      <mesh geometry={curios.wood} material={darkOak} />
      <mesh geometry={curios.ribbon} material={ribbon} />
      <mesh geometry={curios.sand} material={sand} />
      <mesh geometry={curios.crystals} material={crystal} />
      <mesh geometry={curios.wax} material={candleWax} />
      <mesh geometry={curios.orbCores} material={orbCore} />
      <mesh geometry={curios.clearGlass} material={clearGlass} />
      <Billboards at={built.curios.flames} sizes={FLAME_SIZES} geometry={flameQuad} material={candleFlame} />
      <Billboards at={built.curios.flames} sizes={CANDLE_HALO_SIZES} geometry={billboardQuad} material={candleHalo} />
      <Billboards at={curios.glowAt} sizes={CURIO_GLOW_SIZES} geometry={billboardQuad} material={curioGlow} tints={curios.glowTints} />
      <PotionSet potions={built.potions} spills={NO_SPILLS} seed={SEED} />
    </group>
  );
}
