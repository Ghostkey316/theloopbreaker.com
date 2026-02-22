/**
 * Embris Goal Tracking System (Mobile)
 * Tracks user goals with progress and status.
 * Uses AsyncStorage for persistence.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const GOALS_KEY = "@embris_goals_v1";

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "paused";
  progress: number;
  createdAt: number;
  updatedAt: number;
  milestones: string[];
}

export async function getGoals(): Promise<Goal[]> {
  try {
    const data = await AsyncStorage.getItem(GOALS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addGoal(title: string, description: string = ""): Promise<Goal> {
  const goal: Goal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    description,
    status: "active",
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    milestones: [],
  };

  const goals = await getGoals();
  goals.push(goal);
  await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  return goal;
}

export async function updateGoalStatus(
  goalId: string,
  status: Goal["status"]
): Promise<void> {
  const goals = await getGoals();
  const goal = goals.find((g) => g.id === goalId);
  if (goal) {
    goal.status = status;
    goal.updatedAt = Date.now();
    if (status === "completed") goal.progress = 100;
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }
}

export async function updateGoalProgress(
  goalId: string,
  progress: number
): Promise<void> {
  const goals = await getGoals();
  const goal = goals.find((g) => g.id === goalId);
  if (goal) {
    goal.progress = Math.min(100, Math.max(0, progress));
    goal.updatedAt = Date.now();
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }
}

export function formatGoalsForPrompt(): string {
  return "";
}

export async function formatGoalsForPromptAsync(): Promise<string> {
  const goals = await getGoals();
  if (goals.length === 0) return "";

  let block = `\n\n═══ USER GOALS ═══\n`;
  const active = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");

  if (active.length > 0) {
    block += `Active Goals (${active.length}):\n`;
    active.forEach((g) => {
      block += `- ${g.title} [${g.progress}% complete]\n`;
      if (g.description) block += `  Description: ${g.description}\n`;
    });
  }

  if (completed.length > 0) {
    block += `Completed Goals (${completed.length}):\n`;
    completed.slice(-5).forEach((g) => {
      block += `- ✓ ${g.title}\n`;
    });
  }

  return block;
}
