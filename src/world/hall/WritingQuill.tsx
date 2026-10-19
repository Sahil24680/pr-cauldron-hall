import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { paintCanvas } from "../textures";
import { merged, placed, woodBlock } from "./geometryKit";
import { hallClock } from "./hallClock";
import { DISPLAY_FONT, useFontsReady } from "./hallFonts";

type Props = { deskTop: number; deskDepth: number };
type Inscription = { points: Float32Array; delays: Float32Array; count: number; writing: number };

const MESSAGES = [
  ["Sahil's", "Cauldron Keep"],
  ["Mischief", "managed"],
  ["Brewing PRs", "since 2026"],
  ["Mind the", "merge conflicts"],
];
// Written on the wall above the painting, between the zone crests, where the third-person avatar's hat never reaches from Home.
const WRITING = { width: 5.2, lineHeight: 0.85, bottom: 7.2, out: 0.32 };
const PIXELS_PER_METRE = 150;
const FONT_PX = 104;
const SAMPLE_STEP = 4;
const INK_THRESHOLD = 128;
const SECONDS_PER_LETTER = 0.16;
const MIN_WRITING_SECONDS = 2.5;
const HOLD_SECONDS = 3.5;
const FADE_SECONDS = 1.5;
const INK_SIZE = 0.06;
const QUILL_TILT = -0.55;
const QUILL_FOLLOW = 12;
const QUILL_SCALE = 3;
const QUILL_REST = new THREE.Vector3(WRITING.width / 2 + 0.4, WRITING.lineHeight / 2, 0);
const BOOK = { width: 0.5, depth: 0.34, pageLift: 0.025 };

const inkVertex = /* glsl */ `
  attribute float aDelay;
  uniform float uTime;
  uniform float uStart;
  uniform float uHalfHeight;
  uniform float uSize;
  varying float vFresh;
  void main() {
    float age = uTime - uStart - aDelay;
    vFresh = age < 0.0 ? -1.0 : exp(-age * 2.0);
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (1.0 + vFresh) * projectionMatrix[1][1] * uHalfHeight / -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const inkFragment = /* glsl */ `
  uniform float uFade;
  varying float vFresh;
  void main() {
    if (vFresh < 0.0) {
      discard;
    }
    float glow = 1.0 - smoothstep(0.0, 1.0, length(gl_PointCoord * 2.0 - 1.0));
    vec3 color = mix(vec3(1.0, 0.76, 0.32), vec3(1.7, 1.55, 1.2), vFresh);
    gl_FragColor = vec4(color, glow * uFade * (0.7 + 0.3 * vFresh));
  }
`;

const inkStart = { value: 0 };
const inkFade = { value: 1 };
const ink = new THREE.ShaderMaterial({
  uniforms: { uTime: hallClock.uTime, uHalfHeight: hallClock.uHalfHeight, uSize: { value: INK_SIZE }, uStart: inkStart, uFade: inkFade },
  vertexShader: inkVertex,
  fragmentShader: inkFragment,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const quillLook = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
const bookLook = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

function buildQuill() {
  const vane = new THREE.Shape();
  vane.moveTo(0, 0.06);
  vane.quadraticCurveTo(0.035, 0.18, 0.012, 0.3);
  vane.quadraticCurveTo(-0.02, 0.2, 0, 0.06);
  return merged([
    placed(new THREE.CylinderGeometry(0.003, 0.0015, 0.3, 6).translate(0, 0.15, 0), new THREE.Matrix4(), "#e8e0cc"),
    placed(new THREE.ShapeGeometry(vane, 8), new THREE.Matrix4(), "#f2ece0"),
    placed(new THREE.ConeGeometry(0.004, 0.025, 6).rotateX(Math.PI).translate(0, -0.012, 0), new THREE.Matrix4(), "#2a2018"),
  ]);
}

function buildOpenBook() {
  const pages: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const tilt = new THREE.Matrix4().makeRotationZ(side * -0.12).setPosition(side * BOOK.width * 0.25, BOOK.pageLift, 0);
    pages.push(placed(woodBlock(BOOK.width / 2, 0.02, BOOK.depth), tilt, "#e8dcbc"));
    pages.push(
      placed(woodBlock(BOOK.width / 2 + 0.02, 0.008, BOOK.depth + 0.02), tilt.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.014, 0)), "#4a1a1a"),
    );
  }
  return merged(pages);
}

// Renders the lines to a canvas and keeps every inked pixel as a point, ordered line by line and left to right,
// so revealing them in order reads as the quill writing.
function inscribe(lines: string[]): Inscription {
  const width = Math.round(WRITING.width * PIXELS_PER_METRE);
  const lineHeight = WRITING.lineHeight * PIXELS_PER_METRE;
  const height = Math.round(lineHeight * lines.length);
  const canvas = paintCanvas(width, height, 1, (context) => {
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    lines.forEach((line, index) => {
      context.font = `700 ${FONT_PX}px ${DISPLAY_FONT}, serif`;
      const fit = Math.min(1, (width * 0.96) / context.measureText(line).width);
      context.font = `700 ${Math.floor(FONT_PX * fit)}px ${DISPLAY_FONT}, serif`;
      context.fillText(line, width / 2, lineHeight * (index + 0.5));
    });
  });
  const pixels = canvas.getContext("2d")?.getImageData(0, 0, width, height).data;
  const inked: { line: number; x: number; y: number }[] = [];
  for (let y = 0; y < height; y += SAMPLE_STEP) {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      if ((pixels?.[(y * width + x) * 4 + 3] ?? 0) > INK_THRESHOLD) {
        inked.push({ line: Math.floor(y / lineHeight), x, y });
      }
    }
  }
  inked.sort((a, b) => a.line - b.line || a.x - b.x || a.y - b.y);
  const writing = Math.max(MIN_WRITING_SECONDS, lines.join("").length * SECONDS_PER_LETTER);
  const points = new Float32Array(inked.length * 3);
  const delays = new Float32Array(inked.length);
  inked.forEach((point, index) => {
    points.set([(point.x - width / 2) / PIXELS_PER_METRE, (height - point.y) / PIXELS_PER_METRE, 0], index * 3);
    delays[index] = (index / inked.length) * writing;
  });
  return { points, delays, count: inked.length, writing };
}

export function WritingQuill({ deskTop, deskDepth }: Props) {
  const quill = useRef<THREE.Mesh>(null);
  const fontsReady = useFontsReady();
  const shapes = useMemo(() => ({ quill: buildQuill(), book: buildOpenBook() }), []);
  const inscriptions = useMemo(() => (fontsReady ? MESSAGES.map(inscribe) : []), [fontsReady]);
  const trail = useMemo(() => {
    const capacity = Math.max(1, ...inscriptions.map((inscription) => inscription.count));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
    geometry.setAttribute("aDelay", new THREE.BufferAttribute(new Float32Array(capacity), 1));
    geometry.setDrawRange(0, 0);
    return { geometry, shown: -1, startedAt: 0 };
  }, [inscriptions]);
  const pen = useMemo(() => ({ at: QUILL_REST.clone(), target: new THREE.Vector3() }), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const current = inscriptions[trail.shown];
    const finished = !current || t - trail.startedAt > current.writing + HOLD_SECONDS + FADE_SECONDS;
    if (finished && inscriptions.length > 0) {
      trail.shown = (trail.shown + 1) % inscriptions.length;
      trail.startedAt = t;
      const next = inscriptions[trail.shown];
      const positions = trail.geometry.attributes.position;
      const delays = trail.geometry.attributes.aDelay;
      if (next && positions && delays) {
        positions.array.set(next.points);
        delays.array.set(next.delays);
        positions.needsUpdate = true;
        delays.needsUpdate = true;
        trail.geometry.setDrawRange(0, next.count);
      }
    }
    const shown = inscriptions[trail.shown];
    if (!shown) {
      return;
    }
    const elapsed = t - trail.startedAt;
    inkStart.value = trail.startedAt;
    inkFade.value = 1 - THREE.MathUtils.smoothstep(elapsed, shown.writing + HOLD_SECONDS, shown.writing + HOLD_SECONDS + FADE_SECONDS);
    const writing = elapsed < shown.writing;
    const tip = Math.min(shown.count - 1, Math.floor((elapsed / shown.writing) * shown.count));
    if (writing) {
      pen.target.set(shown.points[tip * 3] ?? 0, shown.points[tip * 3 + 1] ?? 0, 0);
    } else {
      pen.target.copy(QUILL_REST);
    }
    pen.at.lerp(pen.target, Math.min(1, delta * QUILL_FOLLOW));
    if (quill.current) {
      quill.current.position.copy(pen.at);
      quill.current.rotation.set(0.2 + Math.sin(t * 7) * 0.05, 0, QUILL_TILT + Math.sin(t * 11) * (writing ? 0.08 : 0.02));
    }
  });

  return (
    <group position={[0, deskTop, deskDepth / 2]}>
      <mesh geometry={shapes.book} material={bookLook} />
      <group position={[0, WRITING.bottom - deskTop, WRITING.out]}>
        <mesh ref={quill} geometry={shapes.quill} material={quillLook} scale={QUILL_SCALE} />
        <points geometry={trail.geometry} material={ink} frustumCulled={false} />
      </group>
    </group>
  );
}
