import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

const ResumeAnalysisSchema = z.object({
  atsScore: z.number().min(0).max(100).default(0),
  technicalSkills: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
});

export const resumeRouter = router({
  analyze: publicProcedure
    .input(
      z.object({
        resumeText: z.string().min(50),
      })
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `You are an expert recruiter and ATS optimization specialist.

Analyze the following resume and:
- give an ATS score from 0 to 100
- identify technical skills
- identify strengths
- identify weaknesses
- suggest improvements

Return ONLY valid JSON with the following structure:
{
 "atsScore": number,
 "technicalSkills": [string],
 "strengths": [string],
 "weaknesses": [string],
 "improvements": [string]
}`;

      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.resumeText },
          ],
          response_format: { type: "json_object" },
        });

        const content = result.choices[0].message.content;
        const jsonString = typeof content === "string" ? content : JSON.stringify(content);
        
        const parsedResponse = JSON.parse(jsonString);
        const validatedResponse = ResumeAnalysisSchema.parse(parsedResponse);

        return validatedResponse;
      } catch (error: any) {
        throw new Error(`Failed to analyze resume: ${error.message}`);
      }
    }),
});
