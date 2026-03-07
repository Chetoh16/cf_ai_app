import type { Goal } from "../types";
import { Surface, Text, Badge } from "@cloudflare/kumo";

export function GoalPanel({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
        <Text variant="secondary" size="sm">
          No goals yet. Describe a goal in the chat.
        </Text>
      </div>
    );
  }

  


}