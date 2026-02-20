import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Flame,
  Brain,
  Trash2,
  Loader2,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const CATEGORY_COLORS: Record<string, string> = {
  name: "bg-blue-500/20 text-blue-400",
  preference: "bg-purple-500/20 text-purple-400",
  interest: "bg-green-500/20 text-green-400",
  goal: "bg-orange-500/20 text-orange-400",
  wallet: "bg-yellow-500/20 text-yellow-400",
  location: "bg-cyan-500/20 text-cyan-400",
  occupation: "bg-pink-500/20 text-pink-400",
  other: "bg-gray-500/20 text-gray-400",
};

function getCategoryStyle(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? CATEGORY_COLORS.other;
}

export default function EmberMemory() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, setLocation] = useLocation();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const memoriesQuery = trpc.ember.listMemories.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const deleteMemoryMutation = trpc.ember.deleteMemory.useMutation({
    onSuccess: () => memoriesQuery.refetch(),
  });

  const clearAllMutation = trpc.ember.clearAllMemories.useMutation({
    onSuccess: () => {
      memoriesQuery.refetch();
      setShowClearConfirm(false);
    },
  });

  const memories = memoriesQuery.data ?? [];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/ember")}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Brain className="h-5 w-5 text-orange-500" />
            <h1 className="font-semibold text-lg">Ember Memory</h1>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-gray-500">
              {memories.length} {memories.length === 1 ? "memory" : "memories"}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Description */}
        <div className="mb-8 rounded-xl border border-white/10 bg-[#111] p-5">
          <p className="text-sm text-gray-400 leading-relaxed">
            Ember learns about you as you chat — your name, preferences,
            interests, goals, and more. These memories help Ember personalize
            every conversation. You have full control: delete any memory or
            clear them all.
          </p>
        </div>

        {/* Clear All */}
        {memories.length > 0 && (
          <div className="mb-6 flex justify-end">
            {showClearConfirm ? (
              <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-sm text-red-300">
                  Delete all memories?
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowClearConfirm(false)}
                  className="text-gray-400 hover:text-white h-7 px-2"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => clearAllMutation.mutate()}
                  disabled={clearAllMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white h-7 px-3"
                >
                  {clearAllMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Confirm"
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clear All Memories
              </Button>
            )}
          </div>
        )}

        {/* Memory list */}
        {memoriesQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500">Loading memories...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <Brain className="h-8 w-8 text-orange-500/50" />
            </div>
            <h2 className="text-lg font-medium text-gray-300">
              No memories yet
            </h2>
            <p className="text-sm text-gray-600 text-center max-w-sm">
              Start chatting with Ember and it will automatically remember key
              facts about you.
            </p>
            <Button
              onClick={() => setLocation("/ember")}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2 mt-2"
            >
              <Flame className="h-4 w-4" />
              Chat with Ember
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((mem) => (
              <div
                key={mem.id}
                className="group flex items-start gap-3 rounded-xl border border-white/10 bg-[#111] p-4 hover:border-white/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${getCategoryStyle(mem.category)}`}
                    >
                      {mem.category}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {new Date(mem.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{mem.fact}</p>
                </div>
                <button
                  onClick={() => deleteMemoryMutation.mutate({ id: mem.id })}
                  disabled={deleteMemoryMutation.isPending}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all shrink-0"
                  title="Delete memory"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
