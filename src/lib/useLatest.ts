import { useRef } from "react";

// The latest value without making it an effect dependency, for effects that must run only on a specific trigger.
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
