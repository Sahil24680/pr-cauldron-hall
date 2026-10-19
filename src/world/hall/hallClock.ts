import { useFrame } from "@react-three/fiber";

export const hallClock = {
  uTime: { value: 0 },
  uHalfHeight: { value: 400 },
};

export function useHallClock() {
  useFrame((state) => {
    hallClock.uTime.value = state.clock.elapsedTime;
    hallClock.uHalfHeight.value = (state.size.height * state.viewport.dpr) / 2;
  });
}
