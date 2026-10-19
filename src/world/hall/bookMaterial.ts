import * as THREE from "three";
import { SPINE_VARIANTS, bookSpines } from "../textures";

const bookShape = new THREE.BoxGeometry(1, 1, 1);
export const books = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0 });
// Spine, page and cover looks come from one atlas by face direction, so every book stays a single instanced draw.
books.onBeforeCompile = (shader) => {
  shader.uniforms.uSpines = { value: bookSpines() };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float aVariant;\nvarying float vVariant;\nvarying vec2 vBookUv;\nvarying vec3 vBookNormal;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvVariant = aVariant;\nvBookUv = uv;\nvBookNormal = normal;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform sampler2D uSpines;\nvarying float vVariant;\nvarying vec2 vBookUv;\nvarying vec3 vBookNormal;")
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec4 spine = texture2D(uSpines, vec2((vVariant + vBookUv.x) / ${SPINE_VARIANTS.toFixed(1)}, vBookUv.y));
      float onSpine = step(0.5, vBookNormal.z);
      float onPages = clamp(step(0.5, abs(vBookNormal.y)) + step(0.5, -vBookNormal.z), 0.0, 1.0);
      float gilt = spine.g * onSpine * (1.0 - onPages);
      vec3 cover = diffuseColor.rgb * (1.0 - spine.r * 0.45 * onSpine);
      cover = mix(cover, cover * 1.7 + 0.04, spine.b * 0.55);
      cover = mix(cover, vec3(0.83, 0.62, 0.24), gilt);
      vec3 pages = vec3(0.8, 0.74, 0.6) * (0.86 + 0.14 * sin(vBookUv.x * 420.0));
      diffuseColor.rgb = mix(cover, pages, onPages);`,
    )
    .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.32, gilt);")
    .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.85, gilt);");
};

export function instancedBooks(list: { variant: number }[]) {
  const geometry = bookShape.clone();
  geometry.setAttribute("aVariant", new THREE.InstancedBufferAttribute(new Float32Array(list.map((book) => book.variant)), 1));
  return geometry;
}
