import { createWorkersAI } from "workers-ai-provider";
import { routeAgentRequest, callable, type Schedule } from "agents";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  streamText,
  convertToModelMessages,
  pruneMessages,
  tool,
  stepCountIs
} from "ai";
import { z } from "zod";
import type { GoalState, Goal, Step, StepStatus } from "./types";




export class ChatAgent extends AIChatAgent<Env, GoalState> {
  // Wait for MCP connections to restore after hibernation before processing messages
  waitForMcpConnections = true;

  // Default state for new agents
  initialState: GoalState = {
    goals: []
  };

  onStart() {
    // Configure OAuth popup behavior for MCP servers that require authentication
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response("<script>window.close();</script>", {
            headers: { "content-type": "text/html" },
            status: 200
          });
        }
        return new Response(
          `Authentication Failed: ${result.authError || "Unknown error"}`,
          { headers: { "content-type": "text/plain" }, status: 400 }
        );
      }
    });
  }

  @callable()
  async addServer(name: string, url: string, host: string) {
    return await this.addMcpServer(name, url, { callbackHost: host });
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  // Function to rename a goal's title
  @callable()
  async renameGoal(goalId: string, newTitle:string){
    const goal = this.state.goals.find((g) => g.id === goalId);
    if (!goal){
      return { renamed: false, error: "Goal not found" };
    }
    
    this.setState({
      goals: this.state.goals.map((g) =>
        g.id === goalId ? { ...g, title: newTitle } : g
      ),
    });

    return { renamed: true, goalId, newTitle };

  }

  // Function to rename a step's title and description
  @callable()
  async renameStep(goalId: string, stepId: string, newTitle: string, newDescription: string){
    const goal = this.state.goals.find((g) => g.id === goalId);
    if (!goal){
      return { renamed: false, error: "Goal not found" };
    }
    
    const step = goal.steps.find((s) => s.id === stepId);
    if (!step){
      return { renamed: false, error: "Step not found" };
    }
    
    this.setState({
      goals: this.state.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              steps: g.steps.map((s) =>
                s.id === stepId ? { ...s, title: newTitle, description: newDescription } : s
              ),
            }
          : g
      ),
    });

    return { renamed: true, goalId, stepId, newTitle, newDescription };
    
  }

  // Function to delete a goal
  @callable()
  async deleteGoal(goalId: string){
    const goal = this.state.goals.find((g) => g.id === goalId);
    if (!goal){
      return { deleted: false, error: "Goal not found" };
    }
    
    this.setState({
      goals: this.state.goals.filter((g) => g.id !== goalId)
    });
    
    return { deleted: true, goalId, goalTitle: goal.title };
  }


  @callable()
  async updateStepStatus(goalId: string, stepId: string, status: StepStatus) {
    const goal = this.state.goals.find((g) => g.id === goalId);
    if (!goal) {
      return { updated: false, error: "Goal not found" };
    }
    
    const step = goal.steps.find((s) => s.id === stepId);
    if (!step) {
      return { updated: false, error: "Step not found" };
    }
    
    this.setState({
      goals: this.state.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              steps: g.steps.map((s) =>
                s.id === stepId ? { ...s, status } : s
              ),
            }
          : g
      ),
    });

    return { updated: true, stepTitle: step.title, status };
  }

  private buildPrompt(): string {
    const hasGoals = this.state.goals.length > 0;
    let goalsContext = "";
    
    
    if (hasGoals) {
      goalsContext = "The user currently has the following goals:\n";
      goalsContext += this.state.goals.map((g) => {
        let goalText = `Goal: "${g.title}" (id: ${g.id})\n`;
        goalText += "Steps:\n";
        goalText += g.steps.map((s) => `  - [${s.id}] ${s.title} — ${s.status}`).join("\n");
        return goalText;
      }).join("\n");
    } else {
      goalsContext = "The user has no goals yet.";
    }

    const promptMessage = "You are a goal planning assistant. You help users set goals, track progress, and replan when they get stuck.\n\n" +
    goalsContext +
    "\n\nRules:\n" +
    "- When a user describes a NEW goal, call saveGoal to break it into steps and save it.\n" +
    "- When a user says they started, finished, or are blocked on a step, call updateStep with the correct status.\n" +
    "- When a user wants to delete a goal, call deleteGoal with the correct goal ID.\n" +
    "- When a user is stuck or wants to replan, call replanGoal to clear remaining steps, then add fresh ones.\n" +
    "- Always use the exact goal and step IDs shown above — never invent them.\n" +
    "- When the user asks to list or see their goals, read them ONLY from the goals listed above and NEVER guess from chat history.\n" +
    "- After any tool call, give a short friendly confirmation.\n" +
    "- Use Not Started, In Progress, Completed when listing steps.";

    return promptMessage;    
  }


  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools();
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system: this.buildPrompt(),

      // Prune old tool calls to save tokens on long conversations
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages"
      }),
      tools: {
        // MCP tools from connected servers
        ...mcpTools,

        // Save a new goal with steps
        saveGoal: tool({
          description:
            "Save a goal with actionable steps. The input is a goal description and a list of steps to achieve it. Use this tool whenever the user describes a new goal or task, and break it down into clear steps.",
          inputSchema: z.object({
            title: z.string().describe("A short title for the goal"),
            steps: z.array(
              z.object({
                title: z.string().describe("A short title for the step"),
                description: z.string().describe("A detailed description of the step, i.e. what needs to be done to complete it"),
              })
            )
            .min(1, "A goal must have at least one step")
            .max (10, "A goal can have at most 10 steps")
            .describe("A list of actionable steps to achieve the goal")
          }),
          execute: async ({title, steps}) => {
            const newGoal: Goal = {
              id: crypto.randomUUID(),
              title,
              createdAt: new Date().toISOString(),
              steps: steps.map((step) => ({
                id: crypto.randomUUID(),
                title: step.title,
                description: step.description,
                status: "Not Started"
              })),
            };


            this.setState({
              goals: [...this.state.goals, newGoal]
            });

            return{
              saved: true,
              goalId: newGoal.id,
              stepCount: newGoal.steps.length
            }

          }
          
        }),

        // Update the status of a step
        updateStep: tool({
          description: "Update the status of a specific step within a goal. Call this when the user says they started, completed, or are blocked on a step.",
          inputSchema: z.object({
            goalId: z.string().describe("The ID of the goal"),
            stepId: z.string().describe("The ID of the step to update"),
            status: z.enum(["Not Started", "In Progress", "Completed"]).describe("The new status of the step")
          }),
          execute: async ({goalId, stepId, status}) => {
            const goal = this.state.goals.find((g) => g.id === goalId);
            if (!goal) {
              return { updated: false, error: "Goal not found" };
            }

            const step = goal.steps.find((s) => s.id === stepId);
            if (!step) {
              return { updated: false, error: "Step not found" };
            }
            
            this.setState({
              goals: this.state.goals.map((g) =>
                g.id === goalId
                  ? {
                      ...g,
                      steps: g.steps.map((s) =>
                        s.id === stepId ? { ...s, status } : s
                      ),
                    }
                  : g
              ),
            });

            return { updated: true, stepTitle: step.title, status };
          },
        }),

        // Replan a goal
        replanGoal: tool({
          description: "Remove all incomplete steps from a goal so it can be replanned. Call this when the user is stuck or wants to change direction. After calling this, immediately call saveGoal with fresh steps.",
          inputSchema: z.object({
            goalId: z.string().describe("The ID of the goal to replan"),
          }),
          execute: async ({ goalId }) => {
            const goal = this.state.goals.find((g) => g.id === goalId);
            if (!goal) return {
              replanned: false, error: "Goal not found" 
            };

            const completedSteps = goal.steps.filter(
              (s) => s.status === "Completed"
            );

            this.setState({
              goals: this.state.goals.map((g) => g.id === goalId ? { ...g, steps: completedSteps } : g
              ),
            });

            return {
              replanned: true,
              goalTitle: goal.title,
              keptSteps: completedSteps.length,
            };
          },
        }),

        // Delete a goal
        deleteGoal: tool({
          description: "Delete a goal and all its steps. Call this when the user wants to completely remove a goal from their list.",
          inputSchema: z.object({
            goalId: z.string().describe("The ID of the goal to delete"),
          }),
          execute: async ({ goalId }) => {
            const goal = this.state.goals.find((g) => g.id === goalId);
            if (!goal) return {
              deleted: false, error: "Goal not found" 
            };


            this.setState({
              // filter creates a new array without the deleted goal
              goals: this.state.goals.filter((g) => g.id !== goalId)
            });

            return {
              deleted: true,
              goalTitle: goal.title,
            };
          },
        }),

        listGoals: tool({
          description: "List all current goals and their steps. Call this when the user asks to see their goals or progress. Always read directly from the current state — never guess or infer from chat history.",
          inputSchema: z.object({}),
          execute: async () => {
            return {
              goals: this.state.goals.map((g) => ({
                id: g.id,
                title: g.title,
                steps: g.steps.map((s) => ({ id: s.id, title: s.title, status: s.status }))
              }))
            };
          }
        })


      },
      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }

  async executeTask(description: string, _task: Schedule<string>) {
    // Do the actual work here (send email, call API, etc.)
    console.log(`Executing scheduled task: ${description}`);

    // Notify connected clients via a broadcast event.
    // We use broadcast() instead of saveMessages() to avoid injecting
    // into chat history — that would cause the AI to see the notification
    // as new context and potentially loop.
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        timestamp: new Date().toISOString()
      })
    );
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
