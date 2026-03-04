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
      const prompt = `Generate 3 standard behavioral interview questions for a ${input.role} position. Format the output as a JSON array of strings. Only return the JSON array, no other text.`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
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
        You are an expert interview coach. 
        The candidate was asked this question: "${question.questionText}"
        The candidate answered: "${input.transcript}"
        
        Analyze the communication skills and the content of the answer.
        Provide a constructive written feedback report (max 3 paragraphs) highlighting strengths and areas for improvement.
        Also provide a score out of 100 for the overall answer quality.
        
        Format your response as JSON with two fields:
        {
          "feedback": "your detailed feedback string",
          "score": 85
        }
      `;
      
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
      });
      
      let feedback = "No feedback generated.";
      let score = 0;
      
      try {
        const content = response.choices[0]?.message?.content || "{}";
        const cleanedContent = content.replace(/```json\n|\n```|```/g, '');
        const analysis = JSON.parse(cleanedContent);
        feedback = analysis.feedback || feedback;
        score = analysis.score || score;
      } catch (e) {
        feedback = "Error parsing the feedback from the AI coach.";
      }
      
      const updatedQuestion = await storage.updateQuestionWithAnswer(questionId, input.transcript, feedback, score);
      
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

  // Seed initial data if none exists
  const existingInterviews = await storage.getInterviews();
  if (existingInterviews.length === 0) {
    const interview = await storage.createInterview({ role: "Software Engineer" });
    await storage.createQuestion({ interviewId: interview.id, questionText: "Tell me about a time you had to optimize a piece of code that was running too slowly." });
    await storage.createQuestion({ interviewId: interview.id, questionText: "How do you handle disagreements with teammates on technical architecture?" });
  }

  return httpServer;
}
