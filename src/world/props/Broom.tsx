import * as THREE from "three";

// A besom broom along its local -Y: the handle runs up from the binding, the straw flares out below it.
const SHAFT = { length: 1.5, tip: 0.018, butt: 0.026 };
const STRAW = { length: 0.55, neck: 0.04, flare: 0.17, strands: 18 };
const BINDING = { radius: 0.045, tube: 0.012 };

const shaft = new THREE.CylinderGeometry(SHAFT.tip, SHAFT.butt, SHAFT.length, 10).translate(0, SHAFT.length / 2, 0);
// Ridged rather than smooth, so the bundle reads as straw at a distance.
const straw = (() => {
  const geometry = new THREE.CylinderGeometry(STRAW.neck, STRAW.flare, STRAW.length, STRAW.strands * 2, 4, true).translate(0, -STRAW.length / 2, 0);
  const position = geometry.getAttribute("position");
  const point = new THREE.Vector3();
  for (let vertex = 0; vertex < position.count; vertex++) {
    point.fromBufferAttribute(position, vertex);
    const ridge = 1 + 0.12 * Math.cos(Math.atan2(point.z, point.x) * STRAW.strands);
    position.setXYZ(vertex, point.x * ridge, point.y, point.z * ridge);
  }
  geometry.computeVertexNormals();
  return geometry;
})();
const binding = new THREE.TorusGeometry(BINDING.radius, BINDING.tube, 6, 16).rotateX(Math.PI / 2);

export function Broom({ wood, straw: strawMaterial, cord }: { wood: THREE.Material; straw: THREE.Material; cord: THREE.Material }) {
  return (
    <group>
      <mesh geometry={shaft} material={wood} />
      <mesh geometry={straw} material={strawMaterial} />
      <mesh geometry={binding} material={cord} position={[0, -0.04, 0]} />
      <mesh geometry={binding} material={cord} position={[0, -0.12, 0]} scale={1.25} />
    </group>
  );
}
