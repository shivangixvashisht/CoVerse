export function DemoTag({ label = "Demo data" }: { label?: string }) {
  return <span className="demo-tag">{label}</span>;
}
