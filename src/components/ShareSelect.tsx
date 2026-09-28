import type { Group } from "../lib/types";

interface Props {
  id?: string;
  value: string;
  onChange: (sharedWith: string) => void;
  groups: Group[];
  label?: string;
  className?: string;
}

export function ShareSelect({ id, value, onChange, groups, label, className }: Props) {
  const removedGroup = value.startsWith("group:") && !groups.some((g) => `group:${g.id}` === value);
  return (
    <select id={id} className={className} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">Everyone</option>
      <option value="me">Only me</option>
      {groups.length > 0 && (
        <optgroup label="A group">
          {groups.map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
        </optgroup>
      )}
      {removedGroup && <option value={value} disabled>Group removed</option>}
    </select>
  );
}
