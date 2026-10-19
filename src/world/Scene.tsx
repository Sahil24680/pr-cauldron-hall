import { QuadraticBezierLine } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PullRequest, Stage } from "../../shared/board";
import { findStage } from "../../shared/stage";
import { useLatest } from "../lib/useLatest";
import { Burst, type BurstSpec } from "./effects/Burst";
import { Hall } from "./hall/Hall";
import { FRONT_Z, type Point, type Station, hallBounds, layoutHall, zoneX } from "./layout";
import { DEFAULT_FOV, PlayerController } from "./player/PlayerController";
import { type Player, type ViewMode, startingPlayer } from "./player/player";
import { Cauldron } from "./pullRequests/Cauldron";
import { Headmaster } from "./pullRequests/Headmaster";
import { type Departure, Wizard } from "./pullRequests/PullRequestWizard";
import { targetId } from "./pullRequests/targets";

export type CameraFocus = { id: number; target: { kind: "home" } | { kind: "zone"; stage: Stage } | { kind: "pr"; number: number } };
export type DepartingWizard = { key: string; pr: PullRequest; station: Station; departure: Departure };

type Props = {
  pullRequests: PullRequest[];
  viewer: string;
  now: number;
  mode: ViewMode;
  selected: number | null;
  hovered: number | null;
  nearby: number | null;
  arrivals: Set<number>;
  departing: DepartingWizard[];
  bursts: BurstSpec[];
  focus: CameraFocus;
  onSelect: (number: number | null) => void;
  onHover: (number: number | null) => void;
  onNearby: (number: number | null) => void;
  onRead: (number: number) => void;
  onPickZone: (stage: Stage) => void;
  onOpenStack: (stage: Stage) => void;
};

const WALL_CLEARANCE = 0.6;
const STACK_LINE_HEIGHT = 2.6;
const TAKEOFF_SPEED = 3;
// The third-person avatar fills the screen just left of centre, so it stands left of the stage to keep every cauldron,
// the Headmaster and the students to its right.
const ZONE_VIEW_OFFSET: Record<ViewMode, Point> = { first: { x: 0, z: 3.2 }, third: { x: -3.1, z: 4.3 } };
const CAULDRON_VIEW_DISTANCE = 2.3;
const NO_SELECTION = () => undefined;

export function Scene(props: Props) {
  const {
    pullRequests,
    viewer,
    now,
    mode,
    selected,
    hovered,
    nearby,
    arrivals,
    departing,
    bursts,
    focus,
    onSelect,
    onHover,
    onNearby,
    onRead,
    onPickZone,
    onOpenStack,
  } = props;
  const player = useRef<Player>(startingPlayer());
  const { stations, stacks, zones, backZ, obstacles } = useMemo(() => layoutHall(pullRequests), [pullRequests]);
  const bounds = useMemo(() => hallBounds(backZ, WALL_CLEARANCE), [backZ]);
  const counts = useMemo(() => {
    const byStage: Record<Stage, number> = { draft: 0, review: 0, changes: 0, approved: 0 };
    for (const pr of pullRequests) {
      byStage[findStage(pr)] += 1;
    }
    return byStage;
  }, [pullRequests]);

  const toggleFlight = useCallback(() => {
    const you = player.current;
    you.flying = !you.flying;
    if (you.flying && you.y === 0) {
      you.verticalSpeed = TAKEOFF_SPEED;
    }
  }, []);

  const latestStations = useLatest(stations);
  const latestMode = useLatest(mode);
  useEffect(() => {
    const target = focus.target;
    const you = player.current;
    if (target.kind === "zone") {
      const offset = ZONE_VIEW_OFFSET[latestMode.current];
      Object.assign(you, {
        x: zoneX(target.stage) + offset.x,
        z: FRONT_Z + offset.z,
        yaw: Math.PI,
        facing: Math.PI,
        pitch: 0,
        velocityX: 0,
        velocityZ: 0,
        verticalSpeed: 0,
      });
      return;
    }
    if (target.kind === "pr") {
      const station = latestStations.current.get(target.number);
      if (station) {
        Object.assign(you, {
          x: station.cauldron.x,
          z: station.cauldron.z + CAULDRON_VIEW_DISTANCE,
          yaw: Math.PI,
          pitch: -0.15,
          velocityX: 0,
          velocityZ: 0,
          verticalSpeed: 0,
        });
      }
      return;
    }
    if (focus.id !== 0) {
      player.current = { ...startingPlayer(), flying: you.flying };
    }
  }, [focus, latestStations, latestMode]);

  const parentLines = useMemo(() => {
    const focusNumber = selected ?? hovered ?? nearby;
    if (focusNumber === null) {
      return [];
    }
    return pullRequests
      .filter((pr) => pr.parent !== null && (pr.number === focusNumber || pr.parent === focusNumber))
      .flatMap((pr) => {
        const child = stations.get(pr.number);
        const parent = pr.parent === null ? undefined : stations.get(pr.parent);
        return child && parent && child !== parent ? [{ key: `${pr.number}-${pr.parent}`, child: child.cauldron, parent: parent.cauldron }] : [];
      });
  }, [pullRequests, stations, selected, hovered, nearby]);

  return (
    <Canvas camera={{ fov: DEFAULT_FOV, near: 0.1, far: 300 }} dpr={[1, 2]} onPointerMissed={() => onSelect(null)}>
      <PlayerController
        mode={mode}
        player={player}
        obstacles={obstacles}
        bounds={bounds}
        stations={stations}
        onNearby={onNearby}
        onRead={onRead}
        onToggleFlight={toggleFlight}
        paused={selected !== null}
      />
      <Hall zones={zones} backZ={backZ} counts={counts} onPickZone={onPickZone} />
      {pullRequests.map((pr) => {
        const station = stations.get(pr.number);
        if (!station || station.stacked) {
          return null;
        }
        return (
          <group key={pr.number}>
            <Cauldron pr={pr} at={station.cauldron} now={now} departure={null} aimed={nearby === pr.number} onSelect={onSelect} />
            <Wizard
              pr={pr}
              station={station}
              now={now}
              arriving={arrivals.has(pr.number)}
              departure={null}
              selected={selected === pr.number}
              showTag={selected === pr.number || hovered === pr.number || nearby === pr.number || pr.author === viewer}
              onSelect={onSelect}
              onHover={onHover}
            />
          </group>
        );
      })}
      {[...stacks.values()].map((stack) => {
        const stacked = pullRequests.filter((pr) => stack.numbers.includes(pr.number));
        return (
          <Headmaster
            key={stack.stage}
            stack={stack}
            pullRequests={stacked}
            now={now}
            aimed={nearby === targetId({ kind: "stack", stage: stack.stage })}
            onOpen={onOpenStack}
          />
        );
      })}
      {departing.map((wizard) => (
        <group key={wizard.key}>
          <Cauldron pr={wizard.pr} at={wizard.station.cauldron} now={now} departure={wizard.departure} aimed={false} onSelect={NO_SELECTION} />
          <Wizard
            pr={wizard.pr}
            station={wizard.station}
            now={now}
            arriving={false}
            departure={wizard.departure}
            selected={false}
            showTag={false}
            onSelect={NO_SELECTION}
            onHover={NO_SELECTION}
          />
        </group>
      ))}
      {parentLines.map((line) => (
        <QuadraticBezierLine
          key={line.key}
          start={[line.child.x, STACK_LINE_HEIGHT, line.child.z]}
          mid={[(line.child.x + line.parent.x) / 2, STACK_LINE_HEIGHT + 3, (line.child.z + line.parent.z) / 2]}
          end={[line.parent.x, STACK_LINE_HEIGHT, line.parent.z]}
          color="#ffd166"
          lineWidth={2.5}
          dashed
          dashSize={0.3}
          gapSize={0.2}
        />
      ))}
      {bursts.map((spec) => (
        <Burst key={spec.id} spec={spec} />
      ))}
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={1.1} intensity={2.2} distanceFalloff={0.8} />
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.9} luminanceSmoothing={0.15} />
        <Vignette offset={0.28} darkness={0.65} />
      </EffectComposer>
    </Canvas>
  );
}
