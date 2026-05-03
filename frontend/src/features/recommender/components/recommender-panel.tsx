import type { Recommendation } from "../hooks/use-recommender";

const PRIORITY_COLOR = {
  low: "text-green-400 border-green-900/50",
  medium: "text-yellow-400 border-yellow-900/50",
  high: "text-red-500 border-red-900/60",
};

const PRIORITY_LABEL = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
};

type Props = { rec: Recommendation | null };

export const RecommenderPanel = ({ rec }: Props) => {
  if (!rec) return null;

  const colors = PRIORITY_COLOR[rec.priority];

  return (
    <aside
      className={`pointer-events-auto absolute top-16 right-[19rem] z-10 w-64 rounded border bg-black/80 p-3 font-mono text-xs backdrop-blur-sm ${colors}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-widest text-red-600">
          RECOMMENDER
        </span>
        <span className={`text-[10px] font-bold ${PRIORITY_COLOR[rec.priority].split(" ")[0]}`}>
          [{PRIORITY_LABEL[rec.priority]}]
        </span>
      </div>
      <p className="mb-3 leading-relaxed text-neutral-300">{rec.summary}</p>
      <div className="space-y-1">
        {rec.actions.map((action) => (
          <div
            key={action}
            className="cursor-pointer rounded border border-neutral-800 px-2 py-1 text-neutral-400 transition-colors hover:border-red-800 hover:text-red-400"
          >
            › {action}
          </div>
        ))}
      </div>
    </aside>
  );
};
