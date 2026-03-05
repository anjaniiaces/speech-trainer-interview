import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.interviews.list.path, async (req, res) => {
    const interviews = await storage.getInterviews();
    res.json(interviews);
  });

  app.get(api.interviews.get.path, async (req, res) => {
    const interview = await storage.getInterview(Number(req.params.id));
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    res.json(interview);
  });

  app.post(api.interviews.create.path, async (req, res) => {
    try {
      const input = api.interviews.create.input.parse(req.body);
      const interview = await storage.createInterview(input);
      
      // Generate some default questions for the role
      const prompt = `Generate 5 standard behavioral interview questions for a ${input.role} position. Format the output as a JSON array of strings. Only return the JSON array, no other text.`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
      });
      
      let questionsList = [];
      try {
        const content = response.choices[0]?.message?.content || "[]";
        // Clean up markdown code blocks if present
        const cleanedContent = content.replace(/```json\n|\n```|```/g, '');
        questionsList = JSON.parse(cleanedContent);
      } catch (e) {
        questionsList = [
          "Tell me about a time you faced a difficult challenge at work.",
          "Describe a situation where you had to work with a difficult team member.",
          "Where do you see yourself in 5 years?"
        ];
      }
      
      for (const q of questionsList) {
        await storage.createQuestion({ interviewId: interview.id, questionText: q });
      }

      res.status(201).json(interview);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.questions.list.path, async (req, res) => {
    const questions = await storage.getQuestions(Number(req.params.interviewId));
    res.json(questions);
  });

  app.post(api.questions.answer.path, async (req, res) => {
    try {
      const input = api.questions.answer.input.parse(req.body);
      const questionId = Number(req.params.id);
      
      const question = await storage.getQuestion(questionId);
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }

      // Analyze transcript with OpenAI
              const prompt = `
You are an expert speech therapist, communication coach, and interview mentor.

The candidate was asked the interview question:
"${question.questionText}"

The candidate responded with this transcript from a spoken answer:
"${input.transcript}"

Evaluate the candidate on the following dimensions:

1. Speech Delivery
- clarity of expression
- pacing and fluency
- filler words or hesitation
- confidence in communication

2. Interview Answer Quality
- relevance to the question
- logical structure (STAR method if applicable)
- strength of example
- impact and outcome

3. Professional Communication
- vocabulary and professionalism
- conciseness
- persuasiveness

Return ONLY valid JSON.

The JSON MUST include these fields:

{
  "feedback": "string",
  "score": number,
  "speechClarity": number,
  "confidence": number,
  "structure": number
}

Rules:
- score must be between 0 and 100
- speechClarity must be between 0 and 10
- confidence must be between 0 and 10
- structure must be between 0 and 10
- Do not omit any field.
`;
 
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      let feedback = "No feedback generated.";
      let score = 0;
      let speechClarity = 0;
      let confidence = 0;
      let structure = 0;
      let suggestedAnswer = "";
      let improvementPointers = "";

      const raw = response.choices[0].message.content || "{}";
      console.log("DEBUG: RAW AI RESPONSE:", raw);

      let analysis: any = {};

      try {
        const cleanedRaw = raw.replace(/```json\n|\n```|```/g, '').trim();
        analysis = JSON.parse(cleanedRaw);
      } catch (e) {
        console.error("DEBUG: JSON parse failed", e);
      }

      feedback = analysis.feedback ?? "No feedback generated";
      score = analysis.score ?? 0;
      speechClarity = analysis.speechClarity ?? 0;
      confidence = analysis.confidence ?? 0;
      structure = analysis.structure ?? 0;
      suggestedAnswer = analysis.suggestedAnswer ?? "";
      improvementPointers = analysis.improvementPointers ?? "";

      console.log("DEBUG: Parsed AI Analysis:", {
        score,
        speechClarity,
        confidence,
        structure
      });
     
      const updatedQuestion = await storage.updateQuestionWithAnswer(
        questionId,
        input.transcript,
        feedback,
        score,
        speechClarity,
        confidence,
        structure,
        suggestedAnswer,
        improvementPointers
      );

      console.log("DEBUG: Updated Question from Storage:", updatedQuestion);

      res.status(200).json(updatedQuestion);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post("/api/questions/:id/reset", async (req, res) => {
    const questionId = Number(req.params.id);
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
        status: "pending" 
      })
      .where(eq(questions.id, questionId))
      .returning();
    res.json(updated);
  });

  // Seed initial data if none exists
  const existingInterviews = await storage.getInterviews();
  if (existingInterviews.length === 0) {
    const interview = await storage.createInterview({ role: "Software Engineer" });
    await storage.createQuestion({ interviewId: interview.id, questionText: "Tell me about a time you had to optimize a piece of code that was running too slowly." });
    await storage.createQuestion({ interviewId: interview.id, questionText: "How do you handle disagreements with teammates on technical architecture?" });
  }

  return httpServer;
}
