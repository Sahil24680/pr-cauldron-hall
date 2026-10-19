import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Stage } from "../../../shared/board";
import { STAGE_THEMES, type StageTheme } from "../../lib/theme";
import { WALL_HEIGHT, type Zone } from "../layout";
import { useCameraBlocker } from "../player/cameraBlockers";
import { paintCanvas, softDot, starPath, toTexture } from "../textures";
import { TIE_BEAM_HEIGHT } from "./Ceiling";
import { merged, placed } from "./geometryKit";
import { DISPLAY_FONT, useFontsReady } from "./hallFonts";
import { gold } from "./materials";
import { STAGE_SHADES } from "./stagePalette";

type CrestProps = { stage: Stage; x: number; z: number; count: number; onPick: () => void };
type Props = { zones: Zone[]; z: number; counts: Record<Stage, number>; onPickZone: (stage: Stage) => void };

const CREST_Y = 5.6;
const SHIELD = { width: 1.9, height: 2.3 };
const RIBBON = { width: 4.2, height: 0.95, drop: 0.15 };
const FACE_LIFT = 0.04;
const RIBBON_LIFT = 0.1;
const CHAIN_LINK = { radius: 0.035, tube: 0.008, spacing: 0.09 };
const CHAIN_SPREAD = 0.6;
const TIE_BEAM_UNDERSIDE = WALL_HEIGHT - TIE_BEAM_HEIGHT / 2;
const SHIELD_PIXELS = 512;
const RIBBON_PIXELS = { width: 2048, height: Math.round((2048 * RIBBON.height) / RIBBON.width) };
const RIBBON_TAIL_SHARE = 0.05;
const RIBBON_TITLE = { heightShare: 0.5, widthShare: 0.84, ink: "#2a1405", weight: 900 };
const GLOW = { base: 0.55, flicker: 0.08 };
const RIBBON_GLOW = 0.4;

function shieldOutline(width: number, height: number): [number, number][] {
  const half = width / 2;
  const points: [number, number][] = [
    [-half, height],
    [-half * 0.55, height * 0.96],
    [0, height],
    [half * 0.55, height * 0.96],
    [half, height],
    [half, height * 0.45],
  ];
  for (let step = 1; step <= 10; step++) {
    const t = step / 10;
    points.push([half * (1 - t) ** 0.8 * Math.cos((t * Math.PI) / 2), height * 0.45 * (1 - t)]);
  }
  const mirrored = points
    .slice(5, -1)
    .reverse()
    .map(([x, y]): [number, number] => [-x, y]);
  return [...points, ...mirrored, [-half, height * 0.45]];
}

function gildedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  const gilt = context.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1);
  gilt.addColorStop(0, "#fff2b8");
  gilt.addColorStop(0.5, "#e0b04a");
  gilt.addColorStop(1, "#8a6420");
  context.shadowColor = "rgba(0,0,0,0.7)";
  context.shadowBlur = size * 0.12;
  context.shadowOffsetY = size * 0.05;
  context.lineWidth = size * 0.06;
  context.strokeStyle = "#3a2608";
  context.strokeText(text, x, y);
  context.shadowColor = "transparent";
  context.fillStyle = gilt;
  context.fillText(text, x, y);
}

function paintShield(theme: StageTheme, count: number) {
  const shades = STAGE_SHADES[theme.id];
  const height = SHIELD_PIXELS * (SHIELD.height / SHIELD.width);
  return paintCanvas(SHIELD_PIXELS, height, 7, (context) => {
    const scale = SHIELD_PIXELS / SHIELD.width;
    const outline = shieldOutline(SHIELD.width, SHIELD.height).map(([x, y]): [number, number] => [(x + SHIELD.width / 2) * scale, height - y * scale]);
    const trace = (inset: number) => {
      context.beginPath();
      for (const [x, y] of outline) {
        const towardCentre = new THREE.Vector2(SHIELD_PIXELS / 2 - x, height * 0.45 - y).normalize().multiplyScalar(inset);
        context.lineTo(x + towardCentre.x, y + towardCentre.y);
      }
      context.closePath();
    };
    const field = context.createLinearGradient(0, 0, 0, height);
    field.addColorStop(0, theme.banner);
    field.addColorStop(1, shades.deep);
    trace(0);
    context.fillStyle = field;
    context.fill();
    context.save();
    trace(0);
    context.clip();
    context.strokeStyle = "rgba(255,255,255,0.07)";
    context.lineWidth = 3;
    for (let y = 30; y < height; y += 64) {
      for (let x = 32; x < SHIELD_PIXELS; x += 64) {
        context.beginPath();
        context.moveTo(x, y - 22);
        context.lineTo(x + 16, y);
        context.lineTo(x, y + 22);
        context.lineTo(x - 16, y);
        context.closePath();
        context.stroke();
      }
    }
    softDot(context, SHIELD_PIXELS / 2, height * 0.48, SHIELD_PIXELS * 0.45, `${shades.glow}55`);
    context.restore();
    context.lineJoin = "round";
    context.strokeStyle = "#e0b04a";
    context.lineWidth = 14;
    trace(10);
    context.stroke();
    context.strokeStyle = "#8a6420";
    context.lineWidth = 4;
    trace(30);
    context.stroke();
    context.fillStyle = shades.glow;
    starPath(context, SHIELD_PIXELS / 2, height * 0.15, 34, 9);
    context.fill();
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    const digits = String(count);
    const size = digits.length > 2 ? 190 : 260;
    context.font = `900 ${size}px ${DISPLAY_FONT}, serif`;
    gildedText(context, digits, SHIELD_PIXELS / 2, height * 0.62, size);
  });
}

function paintRibbon(theme: StageTheme) {
  return paintCanvas(RIBBON_PIXELS.width, RIBBON_PIXELS.height, 9, (context) => {
    const { width, height } = RIBBON_PIXELS;
    const tail = width * RIBBON_TAIL_SHARE;
    const cloth = context.createLinearGradient(0, 0, 0, height);
    cloth.addColorStop(0, "#f8ecc6");
    cloth.addColorStop(0.55, "#ecd8a0");
    cloth.addColorStop(1, "#c4a466");
    context.fillStyle = "#8a6a34";
    for (const side of [0, 1]) {
      const x = side === 0 ? 0 : width;
      const inward = side === 0 ? 1 : -1;
      context.beginPath();
      context.moveTo(x, height * 0.25);
      context.lineTo(x + inward * tail, height * 0.2);
      context.lineTo(x + inward * tail, height * 0.95);
      context.lineTo(x, height * 0.9);
      context.lineTo(x + inward * tail * 0.45, height * 0.58);
      context.closePath();
      context.fill();
    }
    context.fillStyle = cloth;
    context.beginPath();
    context.moveTo(tail * 0.8, height * 0.1);
    context.quadraticCurveTo(width / 2, height * 0.02, width - tail * 0.8, height * 0.1);
    context.lineTo(width - tail * 0.8, height * 0.82);
    context.quadraticCurveTo(width / 2, height * 0.74, tail * 0.8, height * 0.82);
    context.closePath();
    context.fill();
    context.strokeStyle = "#8a6420";
    context.lineWidth = 8;
    context.stroke();
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    const tallest = height * RIBBON_TITLE.heightShare;
    context.font = `${RIBBON_TITLE.weight} ${tallest}px ${DISPLAY_FONT}, serif`;
    const fitted = Math.min(tallest, (tallest * width * RIBBON_TITLE.widthShare) / context.measureText(theme.plain).width);
    context.font = `${RIBBON_TITLE.weight} ${fitted}px ${DISPLAY_FONT}, serif`;
    const glyphs = context.measureText(theme.plain);
    const clothMiddle = height * 0.45;
    context.fillStyle = RIBBON_TITLE.ink;
    context.fillText(theme.plain, width / 2, clothMiddle + (glyphs.actualBoundingBoxAscent - glyphs.actualBoundingBoxDescent) / 2);
  });
}

function buildChains(top: number) {
  const link = new THREE.TorusGeometry(CHAIN_LINK.radius, CHAIN_LINK.tube, 5, 10).scale(1, 1.6, 1);
  const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const pieces: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    let index = 0;
    for (let y = SHIELD.height; y < top; y += CHAIN_LINK.spacing) {
      const at = new THREE.Matrix4().makeTranslation(side * CHAIN_SPREAD, y, 0);
      pieces.push(placed(link, index % 2 === 0 ? at : at.multiply(turn)));
      index += 1;
    }
  }
  return merged(pieces);
}

function shieldGeometry() {
  const outline = shieldOutline(SHIELD.width, SHIELD.height).map(([x, y]) => new THREE.Vector2(x, y));
  const face = new THREE.ShapeGeometry(new THREE.Shape(outline), 24);
  const uv = face.attributes.uv;
  const position = face.attributes.position;
  if (uv && position) {
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, position.getX(index) / SHIELD.width + 0.5, position.getY(index) / SHIELD.height);
    }
  }
  const backing = new THREE.ExtrudeGeometry(new THREE.Shape(outline), {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.05,
    bevelSegments: 3,
  }).translate(0, 0, -0.07);
  return { face, backing };
}

const shield = shieldGeometry();

const chains = buildChains(TIE_BEAM_UNDERSIDE - CREST_Y);

function paintedMaterial(canvas: HTMLCanvasElement, glow: number, side: THREE.Side) {
  const texture = toTexture(canvas, true);
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: "#ffffff",
    emissiveIntensity: glow,
    roughness: 0.6,
    transparent: true,
    side,
  });
}

function useDisposal(material: THREE.MeshStandardMaterial) {
  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material],
  );
}

function ZoneCrest({ stage, x, z, count, onPick }: CrestProps) {
  const crest = useRef<THREE.Group>(null);
  useCameraBlocker(crest);
  const theme = STAGE_THEMES[stage];
  const faceMaterial = useMemo(() => paintedMaterial(paintShield(theme, count), GLOW.base, THREE.FrontSide), [theme, count]);
  const ribbonMaterial = useMemo(() => paintedMaterial(paintRibbon(theme), RIBBON_GLOW, THREE.DoubleSide), [theme]);
  useDisposal(faceMaterial);
  useDisposal(ribbonMaterial);
  useFrame((state) => {
    faceMaterial.emissiveIntensity = GLOW.base + Math.sin(state.clock.elapsedTime * 2.1 + x) * GLOW.flicker;
  });
  return (
    <group ref={crest} position={[x, CREST_Y, z]}>
      <mesh geometry={chains} material={gold} />
      <group
        onClick={(event) => {
          event.stopPropagation();
          onPick();
        }}
      >
        <mesh geometry={shield.backing} material={gold} />
        <mesh geometry={shield.face} material={faceMaterial} position={[0, 0, FACE_LIFT]} />
        <mesh material={ribbonMaterial} position={[0, -RIBBON.drop, RIBBON_LIFT]}>
          <planeGeometry args={[RIBBON.width, RIBBON.height]} />
        </mesh>
      </group>
    </group>
  );
}

// Painted inside the scene rather than as DOM labels, so every crest renders and reads from across the hall.
// The key remounts the crests once the web fonts load, repainting them in Cinzel.
export function ZoneCrests({ zones, z, counts, onPickZone }: Props) {
  const fontsReady = useFontsReady();
  return (
    <group>
      {zones.map((zone) => (
        <ZoneCrest key={`${zone.stage}-${fontsReady}`} stage={zone.stage} x={zone.x} z={z} count={counts[zone.stage]} onPick={() => onPickZone(zone.stage)} />
      ))}
    </group>
  );
}
