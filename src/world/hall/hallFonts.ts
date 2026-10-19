import { useEffect, useState } from "react";

export const DISPLAY_FONT = "Cinzel";
export const BODY_FONT = "Crimson Pro";
const FONT_FACES = [`900 160px ${DISPLAY_FONT}`, `700 64px ${DISPLAY_FONT}`, `italic 40px ${BODY_FONT}`];

// Canvas text drawn before the web fonts arrive falls back to serif, so painters wait on this before their final draw.
export function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all(FONT_FACES.map((face) => document.fonts.load(face)))
      .catch(() => undefined)
      .finally(() => {
        if (live) {
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  return ready;
}
