export function Stats({ rows }: { rows: [string, string | number][] }) {
  if (!rows.length) return null
  return (
    <div className="pb-stats">
      {rows.map(([label, value]) => (
        <div className="pb-stat" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  )
}
