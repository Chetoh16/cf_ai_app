import type { Goal, StepStatus } from "../types";
import { Surface, Text, Badge, Button } from "@cloudflare/kumo";


interface GoalPanelProps {
  goals: Goal[];
  onUpdateStep: (goalId: string, stepId: string, status: StepStatus) => void;
}


export function GoalPanel({ goals, onUpdateStep }: GoalPanelProps) {
  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
        <Text variant="secondary" size="sm">
          No goals yet. Describe a goal in the chat.
        </Text>
      </div>
    );
  }

  return(
    <div className="flex flex-col gap-4 overflow-y-auto h-full px-4 py-4">
      {goals.map((goal) => {
        const completed = goal.steps.filter((s) => s.status === "Completed").length;
        const total = goal.steps.length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        return (
          <Surface key={goal.id} className="rounded-xl ring ring-kumo-line p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <Text bold size="sm">{goal.title}</Text>
              <Badge variant={pct === 100 ? "primary" : "secondary"}>
                {pct === 100 ? "Done" : `${completed}/${total}`}
              </Badge>
            </div>
            <div className="w-full h-1.5 rounded-full bg-kumo-line overflow-hidden">
              <div
                className="h-full rounded-full bg-kumo-accent transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="space-y-2">
              {goal.steps.map((step) => (
                <div key={step.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-kumo-elevated">
                  <div className="flex-1 min-w-0">
                    <span className={step.status === "Completed" ? "line-through text-kumo-subtle" : ""}>
                    <Text size="xs" bold>{step.title}</Text>
                    </span>
                    <span className="mt-0.5 block">
                    <Text size="xs" variant="secondary">{step.description}</Text>
                    </span>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => {
                        let nextStatus: StepStatus = "Not Started";

                        // Cycle through statuses: Not Started -> In Progress -> Completed -> Not Started
                        if (step.status === "Not Started") nextStatus = "In Progress";
                        else if (step.status === "In Progress") nextStatus = "Completed";
                        else if (step.status === "Completed") nextStatus = "Not Started";

                        onUpdateStep(goal.id, step.id, nextStatus);
                    }}
                  >
                    {step.status === "Not Started" && "⏳ Not Started"}
                    {step.status === "In Progress" && "🔄 In Progress"}
                    {step.status === "Completed" && "✅ Completed"}
                  </Button>
                </div>
              ))}
            </div>
          </Surface>
        );
      })}
    </div>
  );



}