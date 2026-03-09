import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
defaultQuery: { "api-version": "2024-02-15-preview" },
defaultHeaders: { "api-key": process.env.AI_INTEGRATIONS_OPENAI_API_KEY },
});

export async function registerRoutes(
httpServer: Server,
app: Express
): Promise<Server> {

/* --------------------------------------------------
RESUME DOWNLOAD API  (NEW)
-------------------------------------------------- */

app.get("/api/resume/download", async (req, res) => {

```
const resumeText = `
```

Optimized Resume

Candidate Name

## Experience

Sales Executive – ABC Company
• Increased sales by 30%
• Managed CRM pipeline
• Built B2B client relationships

## Skills

CRM
Pipeline Management
Lead Conversion
`;

```
res.setHeader("Content-Type", "application/pdf");
res.setHeader(
  "Content-Disposition",
  "attachment; filename=optimized_resume.pdf"
);

res.send(Buffer.from(resumeText));
```

});

/* --------------------------------------------------
INTERVIEW APIs
-------------------------------------------------- */

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

app.post("/api/interviews", async (req, res) => {
try {
const input = api.interviews.create.input.parse(req.body);
const interview = await storage.createInterview(input);

````
  const prompt = `Generate 5 standard behavioral interview questions for a ${input.role} position. Format the output as a JSON array of strings. Only return the JSON array, no other text.`;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
  });
  
  let questionsList = [];
  try {
    const content = response.choices[0]?.message?.content || "[]";
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
````

});

app.get(api.questions.list.path, async (req, res) => {
const questions = await storage.getQuestions(Number(req.params.interviewId));
res.json(questions);
});

app.post(api.questions.answer.path, async (req, res) => {
try {
const input = api.questions.answer.input.parse(req.body);
const questionId = Number(req.params.id);

```
  const question = await storage.getQuestion(questionId);
  if (!question) {
    return res.status(404).json({ message: 'Question not found' });
  }

  const prompt = `
```

You are an expert speech therapist, communication coach, and interview mentor.

The candidate was asked the interview question:
"${question.questionText}"

The candidate responded with this transcript from a spoken answer:
"${input.transcript}"

Evaluate the candidate on the following dimensions:

1. Speech Delivery

* clarity of expression
* pacing and fluency
* filler words or hesitation
* confidence in communication
* Identify recurring catchphrases or "pet phrases"

2. Interview Answer Quality

* relevance to the question
* logical structure (STAR method if applicable)
* strength of example
* impact and outcome

3. Professional Communication

* vocabulary and professionalism
* conciseness
* persuasiveness

Return ONLY valid JSON.

{
"feedback": "string",
"score": number,
"speechClarity": number,
"confidence": number,
"structure": number,
"suggestedAnswer": "STAR model answer",
"improvementPointers": "improvement pointers",
"fillerCount": number,
"gapAnalysis": "Analysis of gaps and pauses in speech",
"catchphrases": ["string"]
}
`;

````
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0].message.content || "{}";
  console.log("DEBUG: RAW AI RESPONSE:", raw);

  let analysis: any = {};

  try {
    const cleanedRaw = raw.replace(/```json\n|\n```|```/g, '').trim();
    analysis = JSON.parse(cleanedRaw);
  } catch (e) {
    console.error("DEBUG: JSON parse failed", e);
  }

  const updatedQuestion = await storage.updateQuestionWithAnswer(
    questionId,
    input.transcript,
    analysis.feedback ?? "",
    analysis.score ?? 0,
    analysis.speechClarity ?? 0,
    analysis.confidence ?? 0,
    analysis.structure ?? 0,
    analysis.suggestedAnswer ?? "",
    analysis.improvementPointers ?? "",
    analysis.fillerCount ?? 0,
    analysis.gapAnalysis ?? "",
    analysis.catchphrases ?? []
  );

  if (analysis.score > 70) {
    const followUpPrompt = `Based on the candidate's answer: "${input.transcript}", generate a challenging follow-up question. Return ONLY the question text as a string.`;
    const followUpRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: followUpPrompt }],
    });
    const followUpText = followUpRes.choices[0].message.content;
    if (followUpText) {
      await storage.createQuestion({ interviewId: question.interviewId, questionText: followUpText });
    }
  }

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
````

});

app.post("/api/questions/:id/reset", async (req, res) => {
try {
const questionId = Number(req.params.id);
const updated = await storage.resetQuestion(questionId);
res.json(updated);
} catch (err) {
res.status(500).json({ message: "Failed to reset question" });
}
});

const existingInterviews = await storage.getInterviews();
if (existingInterviews.length === 0) {
const interview = await storage.createInterview({ role: "Software Engineer" });
await storage.createQuestion({
interviewId: interview.id,
questionText: "Tell me about a time you had to optimize a piece of code that was running too slowly."
});
await storage.createQuestion({
interviewId: interview.id,
questionText: "How do you handle disagreements with teammates on technical architecture?"
});
}

return httpServer;
}
