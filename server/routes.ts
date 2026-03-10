import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import PDFDocument from "pdfkit";

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

/* -----------------------------
RESUME DOWNLOAD API
----------------------------- */

app.get("/api/resume/download", async (req, res) => {

```
const doc = new PDFDocument();

res.setHeader("Content-Type", "application/pdf");
res.setHeader(
  "Content-Disposition",
  "attachment; filename=optimized_resume.pdf"
);

doc.pipe(res);

doc.fontSize(20).text("Optimized Resume", { align: "center" });

doc.moveDown();

doc.fontSize(14).text("Candidate Name");

doc.moveDown();

doc.text("Experience");
doc.text("Sales Executive – ABC Company");
doc.text("• Increased sales by 30%");
doc.text("• Managed CRM pipeline");
doc.text("• Built B2B client relationships");

doc.moveDown();

doc.text("Skills");
doc.text("• CRM");
doc.text("• Pipeline Management");
doc.text("• Lead Conversion");

doc.end();
```

});

/* -----------------------------
ATS RESUME ANALYSIS
----------------------------- */

app.post("/api/resume/analyze", async (req, res) => {

```
try {

  const { resumeText, jobDescription } = req.body;

  const prompt = `
```

You are an ATS system.

Evaluate this resume against the job description.

Return JSON:

{
"score": number,
"strengths": [string],
"weaknesses": [string],
"optimizedResume": string
}

Resume:
${resumeText}

Job Description:
${jobDescription}
`;

```
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");

  res.json(result);

} catch (err) {

  console.error("ATS analysis failed:", err);

 res.status(500).json({
  message: "ATS analysis failed",
  error: err?.message || err
});

}
```

});

/* -----------------------------
INTERVIEW APIs
----------------------------- */

app.get(api.interviews.list.path, async (req, res) => {
const interviews = await storage.getInterviews();
res.json(interviews);
});

app.get(api.interviews.get.path, async (req, res) => {
const interview = await storage.getInterview(Number(req.params.id));
if (!interview) {
return res.status(404).json({ message: "Interview not found" });
}
res.json(interview);
});

app.post("/api/interviews", async (req, res) => {
try {

````
  const input = api.interviews.create.input.parse(req.body);

  const interview = await storage.createInterview(input);

  const prompt = `Generate 5 behavioral interview questions for a ${input.role} position. Return JSON array.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
  });

  let questionsList = [];

  try {
    const content = response.choices[0]?.message?.content || "[]";
    const cleanedContent = content.replace(/```json\n|\n```|```/g, "");
    questionsList = JSON.parse(cleanedContent);
  } catch {
    questionsList = [
      "Tell me about a time you faced a difficult challenge.",
      "Describe a conflict with a team member.",
      "Where do you see yourself in 5 years?",
    ];
  }

  for (const q of questionsList) {
    await storage.createQuestion({
      interviewId: interview.id,
      questionText: q,
    });
  }

  res.status(201).json(interview);

} catch (err) {

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: err.errors[0].message,
      field: err.errors[0].path.join("."),
    });
  }

  throw err;
}
````

});

app.get(api.questions.list.path, async (req, res) => {
const questions = await storage.getQuestions(
Number(req.params.interviewId)
);
res.json(questions);
});

app.post(api.questions.answer.path, async (req, res) => {

```
try {

  const input = api.questions.answer.input.parse(req.body);
  const questionId = Number(req.params.id);

  const question = await storage.getQuestion(questionId);

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  const prompt = `
```

You are an expert interview coach.

Question:
"${question.questionText}"

Answer:
"${input.transcript}"

Return JSON with:

{
"feedback": "string",
"score": number,
"speechClarity": number,
"confidence": number,
"structure": number,
"suggestedAnswer": "string",
"improvementPointers": "string",
"fillerCount": number,
"gapAnalysis": "string",
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

  let analysis: any = {};

  try {
    const cleaned = raw.replace(/```json\n|\n```|```/g, "").trim();
    analysis = JSON.parse(cleaned);
  } catch {}

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

  res.json(updatedQuestion);

} catch (err) {

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: err.errors[0].message,
      field: err.errors[0].path.join("."),
    });
  }

  throw err;
}
````

});

app.post("/api/questions/:id/reset", async (req, res) => {

```
try {

  const questionId = Number(req.params.id);

  const updated = await storage.resetQuestion(questionId);

  res.json(updated);

} catch {

  res.status(500).json({ message: "Failed to reset question" });

}
```

});

return httpServer;
}
