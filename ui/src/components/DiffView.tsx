interface DiffViewProps {
  oldStr: string;
  newStr: string;
}

export function DiffView({ oldStr, newStr }: DiffViewProps) {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  return (
    <div className="text-xs font-mono rounded border border-border overflow-x-auto">
      {oldLines.map((line, i) => (
        <div key={`old-${i}`} className="bg-red-50 text-red-800 px-2 py-0.5">
          <span className="text-red-400 select-none mr-2">-</span>
          {line}
        </div>
      ))}
      {newLines.map((line, i) => (
        <div key={`new-${i}`} className="bg-green-50 text-green-800 px-2 py-0.5">
          <span className="text-green-400 select-none mr-2">+</span>
          {line}
        </div>
      ))}
    </div>
  );
}
