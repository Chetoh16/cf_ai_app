export type StepStatus = "Not Started" | "In Progress" | "Completed";

export interface Step{
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

export interface Goal{
  id: string;
  title: string;
  steps: Step[];
  createdAt: string;
}

export type GoalState = {
  goals: Goal[];
};
