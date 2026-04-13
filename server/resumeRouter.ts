import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

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
- identify strengths
- identify weaknesses
- suggest improvements
- rewrite weak bullet points

Return ONLY valid JSON with the following structure:
{
 "ats_score": number,
 "strengths": [string],
 "weaknesses": [string],
 "improvements": [string],
 "rewritten_bullets": [string]
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
        
        return JSON.parse(jsonString);
      } catch (error: any) {
        throw new Error(`Failed to analyze resume: ${error.message}`);
      }
    }),
});
