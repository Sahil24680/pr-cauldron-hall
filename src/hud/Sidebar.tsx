import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useMemo } from "react";
import type { PullRequest, Stage } from "../../shared/board";
import { findStage } from "../../shared/stage";
import { FLAGS, type Filters, type FlagId } from "../board/filters";
import { STAGE_ORDER, STAGE_THEMES, robeColorOf } from "../lib/theme";

const MIN_FILL_PERCENT = 6;

type Props = {
  pullRequests: PullRequest[];
  viewer: string;
  now: number;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onPickTable: (stage: Stage) => void;
  onPlayDemo: () => void;
};

function CountUp({ value }: { value: number }) {
  const count = useMotionValue(value);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  useEffect(() => {
    const controls = animate(count, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [count, value]);
  return <motion.span>{rounded}</motion.span>;
}

export function Sidebar({ pullRequests, viewer, now, filters, onFiltersChange, onPickTable, onPlayDemo }: Props) {
  const counts = useMemo(() => {
    const byStage: Record<Stage, number> = { draft: 0, review: 0, changes: 0, approved: 0 };
    for (const pr of pullRequests) {
      byStage[findStage(pr)] += 1;
    }
    return byStage;
  }, [pullRequests]);
  const tallest = Math.max(1, ...Object.values(counts));
  const authors = useMemo(() => {
    const byAuthor = new Map<string, { name: string; count: number }>();
    for (const pr of pullRequests) {
      const entry = byAuthor.get(pr.author) ?? { name: pr.authorName, count: 0 };
      byAuthor.set(pr.author, { ...entry, count: entry.count + 1 });
    }
    return [...byAuthor.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [pullRequests]);

  const togglePerson = (login: string) => {
    const people = filters.people.includes(login) ? filters.people.filter((person) => person !== login) : [...filters.people, login];
    onFiltersChange({ ...filters, people });
  };
  const toggleFlag = (flag: FlagId) => onFiltersChange({ ...filters, flag: filters.flag === flag ? null : flag });
  const onlyMine = filters.people.length === 1 && filters.people[0] === viewer;

  return (
    <aside className="sidebar panel">
      <section aria-label="Pull requests per stage" className="hourglasses">
        {STAGE_ORDER.map((stage) => (
          <button key={stage} type="button" className="hourglass" onClick={() => onPickTable(stage)} title={`Go to ${STAGE_THEMES[stage].plain}`}>
            <span className="hourglass-glass">
              <motion.span
                className="hourglass-gems"
                style={{ background: STAGE_THEMES[stage].banner }}
                initial={false}
                animate={{ height: `${Math.max(MIN_FILL_PERCENT, (counts[stage] / tallest) * 100)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
              />
            </span>
            <span className="hourglass-count">
              <CountUp value={counts[stage]} />
            </span>
            <span className="hourglass-name">{STAGE_THEMES[stage].plain}</span>
          </button>
        ))}
      </section>

      <section aria-label="Filters" className="filters">
        <input
          id="search"
          className="search"
          type="search"
          placeholder="Search PRs"
          aria-label="Search title, branch or number"
          value={filters.query}
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
        />
        <div className="chip-row">
          {authors.length > 1 && (
            <button type="button" className="chip" aria-pressed={onlyMine} onClick={() => onFiltersChange({ ...filters, people: onlyMine ? [] : [viewer] })}>
              Mine
            </button>
          )}
          {FLAGS.map((flag) => (
            <button key={flag.id} type="button" className="chip" aria-pressed={filters.flag === flag.id} title={flag.hint} onClick={() => toggleFlag(flag.id)}>
              {flag.label} <span className="chip-count">{pullRequests.filter((pr) => flag.test(pr, now)).length}</span>
            </button>
          ))}
        </div>
        {authors.length > 1 && (
          <div className="chip-row">
            {authors.map(([login, author]) => (
              <button key={login} type="button" className="chip person" aria-pressed={filters.people.includes(login)} onClick={() => togglePerson(login)}>
                <span className="robe-dot" style={{ background: robeColorOf(login) }} />
                {author.name} <span className="chip-count">{author.count}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <button type="button" className="ghost-button demo-button" onClick={onPlayDemo}>
        Demo
      </button>
    </aside>
  );
}
