// A single-series column chart in plain HTML: thin bars anchored to the
// baseline, a hover tooltip per bar, and a table view for screen readers.
export default function BarChart({
  title,
  unit,
  data,
  labelEvery = 1,
}: {
  title: string;
  unit: string;
  data: { label: string; value: number }[];
  labelEvery?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <div className="relative flex h-40 items-end gap-[2px] border-b border-gray-300 dark:border-gray-700">
        <span className="absolute -top-1 left-0 text-[10px] text-gray-500">{max}</span>
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-blue-500 transition-colors group-hover:bg-blue-700 dark:bg-blue-400 dark:group-hover:bg-blue-300"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block dark:bg-gray-100 dark:text-gray-900">
              {d.label}: {d.value} {unit}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] text-[10px] text-gray-500">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="mt-2">
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td className="pr-4">{d.label}</td>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
