import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { extractLinkedInProfile } from "./linkedInExtractor";

const LinkedInOptimizationSchema = z.object({
  headline: z.string(),
  about: z.string(),
  featuredSection: z.string(),
  skillsToAdd: z.array(z.string()),
  profileTips: z.array(z.string()),
});

const AnalysisResultSchema = z.object({
  atsScore: z.number(),
  matchScore: z.number(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  recruiterInsights: z.array(z.string()),
  linkedinOptimization: LinkedInOptimizationSchema,
});

// ────────────────────────────────────────────────────────────────────────────
// STRATEGIC POSITIONING PROMPT (NO JOB-SEEKING LANGUAGE)
// ────────────────────────────────────────────────────────────────────────────

const STRATEGIC_LINKEDIN_PROMPT = `Você é um consultor executivo de posicionamento profissional no LinkedIn.

REGRA ABSOLUTA: NUNCA gere linguagem de busca de emprego.
PROIBIDO usar:
- "open to work"
- "actively seeking opportunities"
- "looking for new opportunities"
- "em busca de novas oportunidades"
- "disponível para oportunidades"
- qualquer variação que sugira que o profissional está procurando emprego

PRINCÍPIOS:
1. Posicionamento = Autoridade + Expertise + Valor Entregue
2. Tom executivo e estratégico, nunca suplicante
3. Foco em resultados e impacto, não em aspirações
4. Linguagem de quem atrai, não de quem busca
5. Especialista estabelecido, não candidato em busca

ESTRUTURA DA ANÁLISE:

1. ATS Score (0-100): capacidade de ser encontrado por recrutadores
2. Pontuação Geral (0-100): efetividade do posicionamento estratégico
3. Pontos Fortes: elementos que demonstram autoridade
4. Oportunidades de Melhoria: gaps no posicionamento estratégico
5. Keywords Faltantes: termos técnicos e estratégicos ausentes

OTIMIZAÇÃO LINKEDIN:

Headline (120 chars):
- Formato: [Expertise] | [Diferenciador] | [Valor/Resultado]
- Exemplos:
  * "Estrategista de Produto Digital | Transformação de UX em SaaS B2B | +40% Conversão"
  * "CFO Transformacional | Reestruturação Financeira | M&A $500M+"
  * "Arquiteto de Soluções Cloud | AWS/Azure Enterprise | Redução 60% Custos Infra"
- Tom: confiante, específico, orientado a resultados

Resumo (até 2600 chars):
Estrutura em 3 blocos:

[Gancho Executivo] - 2 linhas
Posicionamento claro + credencial forte

[Trajetória de Impacto] - 5-7 linhas
Conquistas mensuráveis, progressão estratégica, resultados de negócio

[Proposta de Valor] - 3-4 linhas
Como você resolve problemas críticos, para quem, com que abordagem

Linguagem:
- Verbos de impacto: Estruturei, Liderei, Transformei, Escalei, Reposicionei
- Dados concretos: percentuais, valores, prazos
- Contexto de negócio, não apenas atribuições

Skills Estratégicas:
- Priorizar skills técnicas + skills de liderança
- Evitar soft skills genéricas
- Incluir ferramentas/metodologias específicas

Recomendações de Conteúdo:
- Sugestões de temas para posts que reforcem autoridade
- Foco em insights, cases, lições aprendidas
- Tom de quem ensina, não de quem pede

SAÍDA JSON:
{
  "atsScore": number,
  "matchScore": number,
  "strengths": string[],
  "weaknesses": string[],
  "missingKeywords": string[],
  "recruiterInsights": string[],
  "linkedinOptimization": {
    "headline": string,
    "about": string,
    "featuredSection": string,
    "skillsToAdd": string[],
    "profileTips": string[]
  }
}`;

export const linkedInRouter = router({
  extractProfile: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const profile = await extractLinkedInProfile(input.url);
      return profile;
    }),

  analyzeProfile: publicProcedure
    .input(z.object({ profileText: z.string() }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          { role: "system", content: STRATEGIC_LINKEDIN_PROMPT },
          { role: "user", content: `Perfil LinkedIn:\n\n${input.profileText}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        maxTokens: 4096,
      });

      const content = result.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Resposta vazia da IA");
      }

      const parsed = AnalysisResultSchema.parse(JSON.parse(content));
      return parsed;
    }),
});
