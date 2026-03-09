import type { Goal, StepStatus } from "../types";
import { Surface, Text, Badge, Button } from "@cloudflare/kumo";
import { useState } from "react";
import { ChevronDown } from "lucide-react";


interface GoalPanelProps {
  goals: Goal[];
  onUpdateStep: (goalId: string, stepId: string, status: StepStatus) => void;
  onRenameGoal: (goalId: string, newTitle: string) => void;
  onRenameStep: (goalId: string, stepId: string, newTitle: string, newDescription: string) => void;
}


export function GoalPanel({ goals, onUpdateStep, onRenameGoal, onRenameStep }: GoalPanelProps) {
  // Local state to track which goal/step is being edited, and the draft title/description
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  /* Toggle on/off goals
  / Record<string, boolean> = an object where:
  / - the key is a string (the goalID e.g. "abc123")
  / - the value is a boolean (true = collapsed, false = expanded)
  */
  const [collapsedGoals, setCollapsedGoals] = useState<Record<string, boolean>>({});

  const toggleGoal = (goalId: string) => {
    setCollapsedGoals((prev) => ({
      // copy all existing goal collapsed states
      ...prev,
      // use goalId as the key, and flip its current value
      // if it was undefined (never clicked), !undefined = true (collapsed)
      // if it was true (collapsed), !true = false (expanded)
      // if it was false (expanded), !false = true (collapsed)
      [goalId]: !prev[goalId]
    }));
  };



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
            <div 
              className="flex items-start justify-between gap-2 cursor-pointer"
              onClick={() => toggleGoal(goal.id)}
            >
              {editingId === `goal-title-${goal.id}` ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    onRenameGoal(goal.id, draft);
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onRenameGoal(goal.id, draft);
                      setEditingId(null);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-full bg-kumo-base border border-kumo-accent rounded-md px-2 py-1 text-sm font-bold text-kumo-default outline-none"
                />
              ) : (
                <span
                  className="cursor-pointer hover:text-kumo-accent transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(`goal-title-${goal.id}`);
                    setDraft(goal.title);
                  }}
                >
                  <Text bold size="sm">{goal.title}</Text>
                </span>
              )}
              <div className="flex items-center gap-2">
                <Badge variant={pct === 100 ? "primary" : "secondary"}>
                  {pct === 100 ? "Done" : `${completed}/${total}`}
                </Badge>
                {/* Chevron rotates -90deg when collapsed, points down when expanded */}
                <ChevronDown
                  size={16}
                  className={`text-kumo-inactive transition-transform duration-200 ${collapsedGoals[goal.id] ? "-rotate-90" : ""}`}
                />
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-kumo-line overflow-hidden">
              <div
                className="h-full rounded-full bg-kumo-accent transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {!collapsedGoals[goal.id] && (
            <div className="space-y-2">
              {goal.steps.map((step) => (
                <div key={step.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-kumo-elevated">
                  <div className="flex-1 min-w-0">
                    <span className={step.status === "Completed" ? "line-through text-kumo-subtle" : ""}>
                      {editingId === `step-title-${step.id}` ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => {
                            onRenameStep(goal.id,step.id, draft, step.description);
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onRenameStep(goal.id,step.id, draft, step.description);
                              setEditingId(null);
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="w-full bg-kumo-base border border-kumo-accent rounded-md px-2 py-1 text-sm font-bold text-kumo-default outline-none"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-kumo-accent transition-colors"
                          onClick={() => {
                            setEditingId(`step-title-${step.id}`);
                            setDraft(step.title);
                          }}
                        >
                          <Text bold size="sm">{step.title}</Text>
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block">
                      {editingId === `step-desc-${step.id}` ? (
                        <textarea
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => {
                            onRenameStep(goal.id, step.id, step.title, draft);
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              onRenameStep(goal.id, step.id, step.title, draft);
                              setEditingId(null);
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          rows={2}
                          className="w-full bg-kumo-base border border-kumo-accent rounded-md px-2 py-1 text-xs text-kumo-default outline-none resize-none"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-kumo-accent transition-colors"
                          onClick={() => {
                            setEditingId(`step-desc-${step.id}`);
                            setDraft(step.description);
                          }}
                        >
                          <Text size="xs" variant="secondary">{step.description}</Text>
                        </span>
                      )}
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
            )}
          </Surface>
        );
      })}
    </div>
  );
}