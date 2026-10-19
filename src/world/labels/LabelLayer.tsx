import { type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { attachLabelElement, detachLabelElement, measureLabelElements, readLabels, setSafeArea, subscribeLabels } from "./labelStore";

type SlotProps = { id: string; observer: ResizeObserver; children: ReactNode };

function LabelSlot({ id, observer, children }: SlotProps) {
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = slot.current;
    if (!element) {
      return;
    }
    attachLabelElement(id, element);
    observer.observe(element);
    return () => {
      observer.unobserve(element);
      detachLabelElement(id);
    };
  }, [id, observer]);
  return (
    <div ref={slot} className="scene-label">
      {children}
    </div>
  );
}

export function LabelLayer({ besideSidebar }: { besideSidebar: boolean }) {
  const labels = useSyncExternalStore(subscribeLabels, readLabels);
  const [observer] = useState(() => new ResizeObserver(measureLabelElements));
  const safeArea = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = safeArea.current;
    if (!frame) {
      return;
    }
    const tracker = new ResizeObserver(() => setSafeArea(frame.getBoundingClientRect()));
    tracker.observe(frame);
    return () => tracker.disconnect();
  }, []);
  useEffect(() => () => observer.disconnect(), [observer]);

  return (
    <div className="scene-labels" aria-hidden="true">
      <div ref={safeArea} className={`label-safe-area${besideSidebar ? " beside-sidebar" : ""}`} />
      {labels.map(({ id, content }) => (
        <LabelSlot key={id} id={id} observer={observer}>
          {content}
        </LabelSlot>
      ))}
    </div>
  );
}
