import type { Goal, StepStatus } from "../types";
import { Surface, Text, Badge, Button } from "@cloudflare/kumo";
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";


interface GoalPanelProps {
  goals: Goal[];
  onUpdateStep: (goalId: string, stepId: string, status: StepStatus) => void;
  onRenameGoal: (goalId: string, newTitle: string) => void;
  onRenameStep: (goalId: string, stepId: string, newTitle: string, newDescription: string) => void;
  onDeleteGoal: (goalId: string) => void;
}


export function GoalPanel({ goals, onUpdateStep, onRenameGoal, onRenameStep, onDeleteGoal }: GoalPanelProps) {
  // Local state to track which goal/step is being edited, and the draft title/description
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  /* Toggle on/off goals
  / Record<string, boolean> = an object where:
  / - the key is a string (the goalID e.g. "abc123")
  / - the value is a boolean (true = collapsed, false = expanded)
  */
  const [collapsedGoals, setCollapsedGoals] = useState<Record<string, boolean>>({});

  // State to track which goal is being confirmed for deletion
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);


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
    <div className="flex flex-col gap-4 px-4 py-4">
      {goals.map((goal) => {
        const completed = goal.steps.filter((s) => s.status === "Completed").length;
        const total = goal.steps.length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const isExpanded = !collapsedGoals[goal.id];
        const isDone = pct === 100;

        // Header background: green if done, blue if in progress, default if collapsed
        const headerBg = isDone ? "bg-green-600" : "bg-blue-600";

        // Text colour on the coloured header should be white for readability
        const headerText = "text-white";
        const headerChevron = "text-white";

        return (
          <Surface key={goal.id} className="rounded-xl ring ring-kumo-line overflow-hidden">
            {/* Goal header row - coloured when expanded */}
            <div
              className={`flex items-center justify-between gap-2 cursor-pointer px-4 py-3 transition-colors duration-400 ${headerBg}`}
              onClick={() => toggleGoal(goal.id)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
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
                    className="w-full bg-white/20 border border-white/40 rounded-md px-2 py-1 text-sm font-bold text-white outline-none placeholder:text-white/60"
                  />
                ) : (
                  <span
                    className={`cursor-pointer transition-colors hover:opacity-80 font-bold text-sm ${headerText}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(`goal-title-${goal.id}`);
                      setDraft(goal.title);
                    }}
                  >
                    {goal.title}
                  </span>
                )}
                {/* Badge colours adjust for readability on coloured background */}
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {isDone ? "Done" : `${completed}/${total}`}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(goal.id);
                  }}
                  className="text-red-300 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>

                {/* Chevron: points up when expanded, down when collapsed */}
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 shrink-0 ${headerChevron} ${isExpanded ? "rotate-180" : ""}`}
                />
              </div>
            </div>

            {/* Progress bar - always visible */}
            <div className="w-full h-1.5 bg-kumo-line overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${isDone ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Steps - only visible when expanded */}
            <div
              className="overflow-hidden transition-all duration-400 ease-in-out"
              style={{ maxHeight: isExpanded ? "1000px" : "0px" }}
            >
              <div className="space-y-2 p-4">
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
                              onRenameStep(goal.id, step.id, draft, step.description);
                              setEditingId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                onRenameStep(goal.id, step.id, draft, step.description);
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
            </div>
            {/* Confirmation dialog */}
            {confirmDeleteId === goal.id && (
              <div className="px-4 py-3 bg-red-50 border-t border-red-200 flex items-center justify-between gap-2">
                <span className="text-xs text-red-700">Delete this goal?</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-red-600 hover:bg-red-700 border-red-600"
                    onClick={() => {
                      onDeleteGoal(goal.id);
                      setConfirmDeleteId(null);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </Surface>
        );
        
      })}
    </div>
  );
}