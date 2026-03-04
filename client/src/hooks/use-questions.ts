import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useQuestions(interviewId: number) {
  return useQuery({
    queryKey: [api.questions.list.path, interviewId],
    queryFn: async () => {
      if (isNaN(interviewId) || interviewId <= 0) return [];
      const url = buildUrl(api.questions.list.path, { interviewId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch questions");
      const data = await res.json();
      return parseWithLogging(api.questions.list.responses[200], data, "questions.list");
    },
    enabled: !!interviewId,
  });
}

export function useAnswerQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, transcript }: { id: number; transcript: string }) => {
      const url = buildUrl(api.questions.answer.path, { id });
      const res = await fetch(url, {
        method: api.questions.answer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.questions.answer.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to submit answer");
      }
      
      return parseWithLogging(api.questions.answer.responses[200], await res.json(), "questions.answer");
    },
    onSuccess: (_, variables) => {
      // We can't perfectly invalidate the list without the interviewId, 
      // but we can invalidate all question lists to be safe.
      queryClient.invalidateQueries({ queryKey: [api.questions.list.path] });
    },
  });
}
