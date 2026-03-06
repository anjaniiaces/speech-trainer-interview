import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id").notNull(),
  questionText: text("question_text").notNull(),
  transcript: text("transcript"),
  feedback: text("feedback"),
  score: integer("score"),

  speechClarity: integer("speech_clarity"),
  confidence: integer("confidence"),
  structure: integer("structure"),

  suggestedAnswer: text("suggested_answer"),
  improvementPointers: text("improvement_pointers"),

  fillerCount: integer("filler_count"),
  gapAnalysis: text("gap_analysis"),

  status: text("status"),
});
export const insertInterviewSchema = createInsertSchema(interviews).pick({ role: true });
export const insertQuestionSchema = createInsertSchema(questions).pick({ interviewId: true, questionText: true });

export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
