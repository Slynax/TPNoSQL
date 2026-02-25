import type { DatabaseType } from "@/types/api";
import { Button } from "@/components/ui/button";

interface DbSelectorProps {
  value: DatabaseType;
  onChange: (db: DatabaseType) => void;
  showBoth?: boolean;
  bothSelected?: boolean;
  onBothChange?: (both: boolean) => void;
}

export function DbSelector({ value, onChange, showBoth, bothSelected, onBothChange }: DbSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={!bothSelected && value === "postgres" ? "default" : "outline"}
        size="sm"
        onClick={() => {
          onBothChange?.(false);
          onChange("postgres");
        }}
      >
        PostgreSQL
      </Button>
      <Button
        variant={!bothSelected && value === "neo4j" ? "default" : "outline"}
        size="sm"
        onClick={() => {
          onBothChange?.(false);
          onChange("neo4j");
        }}
      >
        Neo4j
      </Button>
      {showBoth && (
        <Button
          variant={bothSelected ? "default" : "outline"}
          size="sm"
          onClick={() => onBothChange?.(!bothSelected)}
        >
          Les deux
        </Button>
      )}
    </div>
  );
}
