import * as THREE from "three";

// LatheGeometry faces outward only when the profile climbs; profiles here are written top down, so they are flipped.
export function lathe(points: [number, number][], segments = 28, phiStart = 0, phiLength = Math.PI * 2) {
  const climbing = [...points].sort((a, b) => a[1] - b[1]);
  return new THREE.LatheGeometry(
    climbing.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
    phiStart,
    phiLength,
  );
}

// Per-vertex brightness so one material can show shadow, base and highlight shades.
export function shadeByHeight(geometry: THREE.BufferGeometry, shade: (y: number) => number) {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index++) {
    const value = shade(position.getY(index));
    colors.set([value, value, value], index * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export const FLAT = new THREE.Euler(-Math.PI / 2, 0, 0);

// A curved strip that thins along its length: a tube whose rings shrink toward the end.
export function taperedTube(points: [number, number, number][], startRadius: number, endRadius: number, segments = 20) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const radial = 8;
  const geometry = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const position = geometry.getAttribute("position");
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let ring = 0; ring <= segments; ring++) {
    const along = ring / segments;
    curve.getPointAt(along, center);
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, along);
    for (let side = 0; side <= radial; side++) {
      const index = ring * (radial + 1) + side;
      vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(radius).add(center);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}
