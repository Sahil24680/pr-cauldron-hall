import * as THREE from "three";

export function darken(color: string, factor: number) {
  return `#${new THREE.Color(color).multiplyScalar(factor).getHexString()}`;
}
