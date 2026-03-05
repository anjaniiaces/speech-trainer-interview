import { db } from "./db";
import { interviews, questions, type InsertInterview, type InsertQuestion } from "@shared/schema";
import { eq } from "drizzle-orm";

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
    structure: number
  ): Promise<typeof questions.$inferSelect>;
}

export class DatabaseStorage implements IStorage {
  async getInterviews() {
    return await db.select().from(interviews);
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
    return await db.select().from(questions).where(eq(questions.interviewId, interviewId));
  }

  async getQuestion(id: number) {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question;
  }

  async createQuestion(question: InsertQuestion) {
    const [created] = await db.insert(questions).values(question).returning();
    return created;
  }

  async updateQuestionWithAnswer(
    id: number,
    transcript: string,
    feedback: string,
    score: number,
    speechClarity: number,
    confidence: number,
    structure: number
  ) {
    console.log("UPDATE PAYLOAD:", {
      id,
      transcript: transcript.substring(0, 20) + "...",
      feedback: feedback.substring(0, 20) + "...",
      score,
      speechClarity,
      confidence,
      structure
    });

    const result = await db
      .update(questions)
      .set({
        transcript: transcript,
        feedback: feedback,
        score: score,
        speechClarity: speechClarity,
        confidence: confidence,
        structure: structure,
        status: "completed"
      })
      .where(eq(questions.id, id))
      .returning();

    console.log("DB UPDATE RESULT:", result);

    const verify = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id));

    console.log("DB VERIFY RESULT:", verify);

    return result[0];
  }
}

export const storage = new DatabaseStorage();