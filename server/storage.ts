import { db } from "./db";
import { interviews, questions, type InsertInterview, type InsertQuestion } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getInterviews(): Promise<typeof interviews.$inferSelect[]>;
  getInterview(id: number): Promise<typeof interviews.$inferSelect | undefined>;
  createInterview(interview: InsertInterview): Promise<typeof interviews.$inferSelect>;
  
  getQuestions(interviewId: number): Promise<typeof questions.$inferSelect[]>;
  getQuestion(id: number): Promise<typeof questions.$inferSelect | undefined>;
  createQuestion(question: InsertQuestion): Promise<typeof questions.$inferSelect>;
  updateQuestionWithAnswer(
    id: number, 
    transcript: string, 
    feedback: string, 
    score: number,
    speechClarity: number,
    confidence: number,
    structure: number,
    suggestedAnswer: string,
    improvementPointers: string,
    fillerCount?: number,
    gapAnalysis?: string,
    catchphrases?: string[]
  ): Promise<typeof questions.$inferSelect>;
  resetQuestion(id: number): Promise<typeof questions.$inferSelect>;
}

export class DatabaseStorage implements IStorage {
  async getInterviews() {
    return await db.select().from(interviews).orderBy(desc(interviews.createdAt));
  }

  async getInterview(id: number) {
    const [interview] = await db.select().from(interviews).where(eq(interviews.id, id));
    return interview;
  }

  async createInterview(interview: InsertInterview) {
    const [created] = await db.insert(interviews).values(interview).returning();
    return created;
  }

  async getQuestions(interviewId: number) {
    return await db.select().from(questions).where(eq(questions.interviewId, interviewId)).orderBy(questions.id);
  }

  async getQuestion(id: number) {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question;
  }

  async createQuestion(question: InsertQuestion) {
    const [created] = await db.insert(questions).values({ ...question, status: 'pending' }).returning();
    return created;
  }

  async updateQuestionWithAnswer(
    id: number, 
    transcript: string, 
    feedback: string, 
    score: number,
    speechClarity: number,
    confidence: number,
    structure: number,
    suggestedAnswer: string,
    improvementPointers: string,
    fillerCount?: number,
    gapAnalysis?: string,
    catchphrases?: string[]
  ) {
    const [result] = await db
      .update(questions)
      .set({
        transcript,
        feedback,
        score,
        speechClarity,
        confidence,
        structure,
        suggestedAnswer,
        improvementPointers,
        fillerCount: fillerCount ?? 0,
        gapAnalysis: gapAnalysis ?? "",
        catchphrases: catchphrases ?? [],
        status: "completed"
      })
      .where(eq(questions.id, id))
      .returning();

    return result;
  }

  async resetQuestion(id: number) {
    const [updated] = await db.update(questions)
      .set({ 
        transcript: null, 
        feedback: null, 
        score: null, 
        speechClarity: null, 
        confidence: null, 
        structure: null, 
        suggestedAnswer: null, 
        improvementPointers: null, 
        fillerCount: null,
        gapAnalysis: null,
        catchphrases: null,
        status: "pending" 
      })
      .where(eq(questions.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();