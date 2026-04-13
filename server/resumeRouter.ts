import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

const AnalysisResultSchema = z.object({
  matchScore: z.number(),
  keywords: z.array(z.string()),
  suggestions: z.array(z.string()),
  optimizedResume: z.string(),
  changes: z.array(z.object({
    section: z.string(),
    description: z.string(),
    impact: z.enum(["alto", "medio", "baixo"]),
  })),
  projectedMatchScore: z.number(),
  scoreBreakdown: z.object({
    technicalSkills: z.number(),
    experience: z.number(),
    keywords: z.number(),
    tools: z.number(),
    seniority: z.number(),
  }),
  jobTitle: z.string(),
  jobArea: z.string(),
  coverLetterPoints: z.array(z.string()),
  gapAnalysis: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

async function scrapeJobUrl(url: string): Promise<string | null> {
  try {
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith("http")) return null;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, " ")
      .trim();

    return cleaned.slice(0, 6000);
  } catch {
    return null;
  }
}

function isUrl(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return u.protocol.startsWith("http");
  } catch {
    return false;
  }
}

export const resumeRouter = router({
  analyze: publicProcedure
    .input(
      z.object({
        resumeText: z.string().min(50, "Curriculo muito curto"),
        jobUrl: z.string().min(10, "Informe o link ou descricao da vaga"),
      })
    )
    .mutation(async ({ input }) => {
      const { resumeText, jobUrl } = input;

      let jobContent = jobUrl.trim();
      let scrapedSuccessfully = false;

      if (isUrl(jobUrl.trim())) {
        const scraped = await scrapeJobUrl(jobUrl.trim());
        if (scraped && scraped.length > 200) {
          jobContent = scraped;
          scrapedSuccessfully = true;
        }
      }

      const systemPrompt = `Você é a maior especialista mundial em otimização de currículos, recrutamento corporativo e recolocação profissional. Suas credenciais incluem:
- CPRW (Certified Professional Resume Writer) — PARWCC
- ACRW — Career Directors International
- 25 anos como Headhunter Executivo em: Google, McKinsey, Unilever, Ambev, Itaú, Natura, Magazine Luiza
- Ex-Diretora de Talent Acquisition com acesso direto aos algoritmos dos principais ATS: Workday, Taleo, Greenhouse, iCIMS, Lever, SAP SuccessFactors, Gupy, TOTVS RH, Solides
- PhD em Linguística Computacional com foco em NLP aplicado a triagem de currículos
- Autora do método "Dual-Layer Resume Optimization" — otimização simultânea para ATS e para o olho humano do recrutador

Você pensa em DUAS CAMADAS ao mesmo tempo:
CAMADA ATS: garante que o currículo seja parseado, indexado e ranqueado corretamente por Gupy, Taleo, Workday, SAP e similares.
CAMADA HUMANA: garante que o recrutador que recebe o currículo continue lendo após os primeiros 6 segundos e queira ligar para o candidato.
Regra de ouro: quando as duas camadas conflitarem, priorize ATS na estrutura/formato e o humano no conteúdo/narrativa.

== COMO OS ATS PROCESSAM CURRÍCULOS (2025) ==

PARSING — O ATS converte o arquivo em texto puro via OCR + NLP.
O QUE DESTRÓI O PARSING (elimina o candidato antes de um humano ver):
- Emojis e ícones (✅ 🎯 📌 ★ ➢) — lidos como caracteres inválidos
- Formatação markdown (**negrito**, _itálico_) — aparecem literalmente no texto
- Tabelas e múltiplas colunas — o parser mistura dados de colunas diferentes
- Caixas de texto flutuantes — completamente ignoradas pelo parser
- Headers e footers do Word — ignorados por 73% dos ATS
- Barras de progresso de habilidades (●●●○○) — o ATS não lê gráficos
- Cabeçalhos criativos ("Minha Trajetória", "Onde Cheguei") — ATS não reconhece

RANKING POR KEYWORDS — pesos por posição:
- Resumo Profissional: PESO 3x
- Título Profissional (linha 2): PESO 2.5x
- Seção de Competências: PESO 2x
- Cargo atual (primeira experiência): PESO 1.8x
- Primeiras 3 linhas de cada experiência: PESO 1.5x
- Demais descrições: PESO 1x
- Educação e Certificações: PESO 0.5x

COMPORTAMENTO ESPECÍFICO DO GUPY (usado por Ambev, Natura, Itaú, Magazine Luiza e 2.800+ empresas):
- Usa NLP semântico além de match exato — sinônimos valem, mas keywords exatas pontuam mais
- Penaliza currículos com mais de 2 páginas para analistas/júnior
- Valoriza consistência entre currículo e perfil LinkedIn
- Tempo de permanência nos cargos tem peso no ranking interno

O TESTE DOS 6 SEGUNDOS — triagem humana:
Recrutadores passam em média 6,2 segundos no primeiro scan.
Os olhos fixam em: Nome → Cargo/Título → Empresa → Período → Educação → Segundo Cargo.
O terço superior do currículo é a zona de decisão.

== OS 15 ASSASSINOS DE CARREIRA ==

1. KEYWORDS AUSENTES OU INEXATAS — o ATS busca tokens literais. "Liderança de Equipes" e "Gestão de Pessoas" são termos diferentes.
2. RESUMO PROFISSIONAL GENÉRICO OU AUSENTE — "Profissional dedicado com ampla experiência" não aciona nenhum filtro ATS.
3. VERBOS FRACOS — fiz, trabalhei, ajudei, participei, auxiliei, fui responsável por → eliminados.
4. AUSÊNCIA DE MÉTRICAS — "Aumentei as vendas" é invisível. "Aumentei 34% em 6 meses, R$ 1,2M" é irresistível.
5. FORMATO INCOMPATÍVEL COM ATS — tabelas, colunas, ícones, emojis eliminam antes de um humano ver.
6. TÍTULO PROFISSIONAL DESALINHADO — cargo no CV diferente do cargo da vaga reduz ranqueamento ATS.
7. COMPETÊNCIAS TÉCNICAS ENTERRADAS — habilidades no final recebem peso mínimo do ATS.
8. LINGUAGEM DE TAREFA EM VEZ DE IMPACTO — descreve O QUE fez, não O IMPACTO gerado.
9. SINÔNIMOS AUSENTES — CRM ≠ Salesforce para ATS clássico. Use ambos quando o candidato usa a ferramenta.
10. LACUNAS NÃO CONTEXTUALIZADAS — períodos sem emprego sem qualquer menção geram desconfiança.
11. EXCESSO DE INFORMAÇÃO IRRELEVANTE — experiências de 15+ anos sem relevância, hobbies genéricos, dados pessoais obsoletos.
12. INCOMPATIBILIDADE DE SENIORIDADE — overqualified ou underqualified sem justificativa de transição.
13. NARRATIVA DE CARREIRA INCOERENTE — regressão de nível, mudanças frequentes sem fio condutor visível.
14. FORÇAS OCULTAS NÃO DESTACADAS — certificação mencionada de passagem que é requisito da vaga; conquista enterrada no meio de parágrafo.
15. POSICIONAMENTO COMPETITIVO IGNORADO — currículo não se destaca no pool de 50-300 candidatos.

== BUSCA BOOLEANA APLICADA AO CURRÍCULO ==
Para cada keyword crítica da vaga, verifique:
- O termo EXATO está no currículo?
- Está em área de alto peso (Resumo ou Competências)?
- O sinônimo mais comum também está presente?
- A sigla E a forma expandida estão presentes? Ex: CRM (Customer Relationship Management)
- Verbos de ação fortes: Liderou, Implementou, Desenvolveu, Estruturou, Aumentou, Reduziu, Gerou, Conquistou, Negociou, Expandiu, Automatizou, Otimizou, Entregou, Superou

== LEI ABSOLUTA — NUNCA VIOLAR SOB NENHUMA CIRCUNSTÂNCIA ==

PROIBIDO ABSOLUTO:
1. NUNCA altere datas, períodos, anos ou meses de qualquer experiência profissional
2. NUNCA altere nomes de empresas onde o candidato trabalhou
3. NUNCA altere cargos ou títulos que o candidato ocupou
4. NUNCA invente habilidades, ferramentas, certificações ou conquistas inexistentes
5. NUNCA "corrija" informações — o candidato conhece sua própria história
6. NUNCA use emojis, ícones ou símbolos especiais no currículo otimizado
7. NUNCA use asteriscos (**), sublinhados (__) ou qualquer markdown
8. NUNCA use tabelas ou múltiplas colunas
9. NUNCA superestime o Match Score — honestidade rigorosa é inegociável
10. NUNCA invente keywords que não estejam na descrição real da vaga
11. NUNCA omita experiência ou formação presente no original

O QUE VOCÊ PODE E DEVE FAZER:
- Reescrever bullets transformando linguagem de tarefa em linguagem de impacto
- Reorganizar seções para maximizar peso ATS
- Substituir verbos fracos por verbos de ação fortes
- Garimpar e destacar forças ocultas presentes no currículo original
- Incluir sinônimos de termos técnicos JÁ PRESENTES no original
- Ajustar o título profissional para espelhar a vaga (se houver correspondência real)
- Organizar competências em subcategorias em MAIÚSCULAS com acentuação correta

== AUTO-VERIFICAÇÃO OBRIGATÓRIA ANTES DE RETORNAR ==

□ Todas as datas são IDÊNTICAS ao original?
□ Todos os nomes de empresas são IDÊNTICOS?
□ Todos os cargos são IDÊNTICOS?
□ Nenhuma habilidade foi inventada?
□ O optimizedResume tem ZERO emojis e ZERO markdown?
□ O matchScore é a soma exata do scoreBreakdown?
□ Cada suggestion segue [AÇÃO] + [POR QUÊ] + [COMO FAZER]?
□ Cada change.description é específico para ESTE candidato?
SE QUALQUER RESPOSTA FOR NÃO → CORRIJA ANTES DE RETORNAR.

== CALIBRAÇÃO DE SCORES ==

technicalSkills (0-30): habilidades que o candidato TEM vs. o que a vaga PEDE
- 25-30: 80%+ das habilidades exigidas presentes
- 15-24: 50-79% presentes | 5-14: 20-49% presentes | 0-4: menos de 20%

experience (0-30): experiência RELEVANTE para a função
- 25-30: direta na mesma função | 15-24: área relacionada | 5-14: parcial | 0-4: diferente

keywords (0-20): termos da vaga LITERALMENTE no currículo — contagem rigorosa
tools (0-10): ferramentas específicas pedidas vs. o que o candidato usa
seniority (0-10): compatibilidade de nível, anos e escala de atuação

REFERÊNCIA: área completamente diferente 5-15% | mesma função keywords divergentes 50-70% | mesma função keywords alinhadas 78-92% | 100% é impossível

== FORMATO DO CURRÍCULO OTIMIZADO ==

Use \\n para quebra simples e \\n\\n para separar seções. TEXTO PURO APENAS.
Palavras em MAIÚSCULAS DEVEM ter acentos corretos: EXPERIÊNCIA, FORMAÇÃO, COMPETÊNCIAS, CERTIFICAÇÕES, GESTÃO, ATUAÇÃO, ANÁLISE, TÉCNICAS, LIDERANÇA.

Estrutura obrigatória:
[Nome Completo]
[Título que espelha a vaga] | [Cidade, Estado]
[Telefone] | [Email] | [LinkedIn se presente no original]

RESUMO PROFISSIONAL
[3-5 linhas: área + senioridade + keywords críticas da vaga + diferencial real + resultado mais relevante do original]

COMPETÊNCIAS PRINCIPAIS

[CATEGORIA 1 EM MAIÚSCULAS COM ACENTOS]
- Competência com keyword da vaga
- Competência com sinônimo/variação

EXPERIÊNCIA PROFISSIONAL

[Cargo EXATO] | [Empresa EXATA] | [Período EXATO DO ORIGINAL]
- Verbo forte + ação + escala + resultado quantificado
- Verbo forte + keyword ATS + impacto

FORMAÇÃO ACADÊMICA
[Curso] | [Instituição] | [Ano EXATO DO ORIGINAL]

IDIOMAS
[Idioma]: [Nível]

CERTIFICAÇÕES (se houver)
[Certificação] | [Instituição] | [Ano EXATO DO ORIGINAL]

Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON.`;

      const userMessage = `CURRÍCULO ORIGINAL DO CANDIDATO (preserve todos os dados exatamente):
${resumeText}

---

VAGA${scrapedSuccessfully ? " (conteúdo extraído automaticamente do site)" : " (fornecida pelo candidato)"}:
${jobContent}

---

Execute sua análise completa em DUAS CAMADAS (ATS + olho humano do recrutador).
Identifique os assassinos de carreira presentes neste currículo específico.
Seja cirúrgico, honesto e acionável.

Retorne JSON com esta estrutura exata:
{
  "matchScore": <soma exata do scoreBreakdown — score ORIGINAL antes da otimização>,
  "projectedMatchScore": <score REALISTA após otimizações — NUNCA menor que matchScore>,
  "jobTitle": "<cargo exato da vaga>",
  "jobArea": "<área específica e granular: ex: Desenvolvimento Backend Node.js, Vendas B2B SaaS, Gestão de Pessoas em Varejo>",
  "keywords": [<12-14 palavras-chave mais críticas da vaga em ordem de importância>],
  "suggestions": [
    "<[AÇÃO CONCRETA] — [POR QUÊ prejudica a seleção] — [COMO IMPLEMENTAR passo a passo]>"
  ],
  "changes": [
    {
      "section": "<seção exata onde a mudança foi feita>",
      "description": "<o que estava errado, o que foi corrigido e por que impacta o ATS E o recrutador — específico para este candidato, não genérico>",
      "impact": "<alto | medio | baixo>"
    }
  ],
  "optimizedResume": "<currículo completo otimizado — TEXTO PURO com \\n para quebras — ZERO emojis, asteriscos ou markdown — datas, empresas e cargos IDÊNTICOS ao original>",
  "coverLetterPoints": [
    "<ponto 1: conecta a trajetória do candidato com a dor principal desta empresa/vaga>",
    "<ponto 2: diferencial do candidato mais relevante para esta posição>",
    "<ponto 3: resultado ou conquista que mais impressiona para este contexto>"
  ],
  "gapAnalysis": [
    "<apenas se matchScore < 50: o que falta no currículo vs. o que a vaga exige — pode ser [] se compatibilidade for alta>"
  ],
  "scoreBreakdown": {
    "technicalSkills": <0-30>,
    "experience": <0-30>,
    "keywords": <0-20>,
    "tools": <0-10>,
    "seniority": <0-10>
  }
}

LEMBRETES CRÍTICOS:
- optimizedResume deve ser TEXTO PURO sem nenhum caractere especial
- Datas, empresas e cargos IDÊNTICOS ao original
- projectedMatchScore SEMPRE >= matchScore
- Cada suggestion: [AÇÃO] + [POR QUÊ] + [COMO FAZER]
- Cada change.description: específico para ESTE candidato, não genérico`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "resume_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                matchScore: { type: "number" },
                projectedMatchScore: { type: "number" },
                jobTitle: { type: "string" },
                jobArea: { type: "string" },
                keywords: { type: "array", items: { type: "string" } },
                suggestions: { type: "array", items: { type: "string" } },
                changes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      section: { type: "string" },
                      description: { type: "string" },
                      impact: { type: "string", enum: ["alto", "medio", "baixo"] },
                    },
                    required: ["section", "description", "impact"],
                    additionalProperties: false,
                  },
                },
                optimizedResume: { type: "string" },
                coverLetterPoints: { type: "array", items: { type: "string" } },
                gapAnalysis: { type: "array", items: { type: "string" } },
                scoreBreakdown: {
                  type: "object",
                  properties: {
                    technicalSkills: { type: "number" },
                    experience: { type: "number" },
                    keywords: { type: "number" },
                    tools: { type: "number" },
                    seniority: { type: "number" },
                  },
                  required: ["technicalSkills", "experience", "keywords", "tools", "seniority"],
                  additionalProperties: false,
                },
              },
              required: ["matchScore", "projectedMatchScore", "jobTitle", "jobArea", "keywords", "suggestions", "changes", "optimizedResume", "coverLetterPoints", "gapAnalysis", "scoreBreakdown"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("Resposta vazia da IA. Tente novamente.");
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("Erro ao processar resposta da IA. Tente novamente.");
      }

      const validated = AnalysisResultSchema.parse(parsed);

      // Sanitiza o curriculo otimizado: remove emojis, asteriscos, markdown e corrige acentuacao em maiusculas
      const sanitizeResume = (text: string): string => {
        // Mapa de correcao de palavras comuns em maiusculas sem acento -> com acento correto em portugues
        const accentFixes: Array<[RegExp, string]> = [
          // Cabecalhos de secao mais comuns
          [/\bEXPERIENCIA\b/g, "EXPERIÊNCIA"],
          [/\bFORMACAO\b/g, "FORMAÇÃO"],
          [/\bCOMPETENCIAS\b/g, "COMPETÊNCIAS"],
          [/\bCERTIFICACAO\b/g, "CERTIFICAÇÃO"],
          [/\bCERTIFICACAOES\b/g, "CERTIFICAÇÕES"],
          [/\bCERTIFICACOES\b/g, "CERTIFICAÇÕES"],
          [/\bINFORMACAO\b/g, "INFORMAÇÃO"],
          [/\bINFORMACOES\b/g, "INFORMAÇÕES"],
          [/\bATUACAO\b/g, "ATUAÇÃO"],
          [/\bGESTAO\b/g, "GESTÃO"],
          [/\bADMINISTRACAO\b/g, "ADMINISTRAÇÃO"],
          [/\bCOMUNICACAO\b/g, "COMUNICAÇÃO"],
          [/\bNEGOCIACAO\b/g, "NEGOCIAÇÃO"],
          [/\bAVALIACAO\b/g, "AVALIAÇÃO"],
          [/\bPLANEJAMENTO\b/g, "PLANEJAMENTO"], // ja correto
          [/\bCOORDENACAO\b/g, "COORDENAÇÃO"],
          [/\bIMPLEMENTACAO\b/g, "IMPLEMENTAÇÃO"],
          [/\bCOMERCIALIZACAO\b/g, "COMERCIALIZAÇÃO"],
          [/\bINTEGRACAO\b/g, "INTEGRAÇÃO"],
          [/\bPROSPECAO\b/g, "PROSPECÇÃO"],
          [/\bPROSPECCAO\b/g, "PROSPECÇÃO"],
          [/\bFUNCAO\b/g, "FUNÇÃO"],
          [/\bRELACAO\b/g, "RELAÇÃO"],
          [/\bRELACOES\b/g, "RELAÇÕES"],
          [/\bSOLUCAO\b/g, "SOLUÇÃO"],
          [/\bSOLUCOES\b/g, "SOLUÇÕES"],
          [/\bPOSICAO\b/g, "POSIÇÃO"],
          [/\bOPERACAO\b/g, "OPERAÇÃO"],
          [/\bOPERACOES\b/g, "OPERAÇÕES"],
          [/\bCAPACITACAO\b/g, "CAPACITAÇÃO"],
          [/\bFORMATACAO\b/g, "FORMATAÇÃO"],
          [/\bCONTRATACAO\b/g, "CONTRATAÇÃO"],
          [/\bPRESENTACAO\b/g, "APRESENTAÇÃO"],
          [/\bAPRESENTACAO\b/g, "APRESENTAÇÃO"],
          [/\bADAPTACAO\b/g, "ADAPTAÇÃO"],
          [/\bPRODUCAO\b/g, "PRODUÇÃO"],
          [/\bCONSERVACAO\b/g, "CONSERVAÇÃO"],
          [/\bCONSTRUCAO\b/g, "CONSTRUÇÃO"],
          [/\bREDUCAO\b/g, "REDUÇÃO"],
          [/\bEXECUCAO\b/g, "EXECUÇÃO"],
          [/\bCONTRIBUICAO\b/g, "CONTRIBUIÇÃO"],
          [/\bCONTRIBUICOES\b/g, "CONTRIBUIÇÕES"],
          [/\bINSTITUICAO\b/g, "INSTITUIÇÃO"],
          [/\bINSTITUICOES\b/g, "INSTITUIÇÕES"],
          [/\bGERACAO\b/g, "GERAÇÃO"],
          [/\bCRIACAO\b/g, "CRIAÇÃO"],
          [/\bACAO\b/g, "AÇÃO"],
          [/\bACAOES\b/g, "AÇÕES"],
          [/\bACOES\b/g, "AÇÕES"],
          [/\bCONEXAO\b/g, "CONEXÃO"],
          [/\bCONEXOES\b/g, "CONEXÕES"],
          [/\bAMPLIACAO\b/g, "AMPLIAÇÃO"],
          [/\bPARTICIPACAO\b/g, "PARTICIPAÇÃO"],
          [/\bGERENCIAMENTO\b/g, "GERENCIAMENTO"], // ja correto
          // Outras palavras comuns sem acento
          [/\bACADEMICA\b/g, "ACADÊMICA"],
          [/\bACADEMICO\b/g, "ACADÊMICO"],
          [/\bTECNICA\b/g, "TÉCNICA"],
          [/\bTECNICO\b/g, "TÉCNICO"],
          [/\bTECNICAS\b/g, "TÉCNICAS"],
          [/\bTECNICOS\b/g, "TÉCNICOS"],
          [/\bESTRATEGICA\b/g, "ESTRATÉGICA"],
          [/\bESTRATEGICO\b/g, "ESTRATÉGICO"],
          [/\bANALISE\b/g, "ANÁLISE"],
          [/\bANALISES\b/g, "ANÁLISES"],
          [/\bCOMERCIAL\b/g, "COMERCIAL"], // ja correto
          [/\bVENDAS\b/g, "VENDAS"], // ja correto
          [/\bIDIOMAS\b/g, "IDIOMAS"], // ja correto
          [/\bPROFISSIONAL\b/g, "PROFISSIONAL"], // ja correto
          [/\bPRINCIPAIS\b/g, "PRINCIPAIS"], // ja correto
          [/\bHABILIDADES\b/g, "HABILIDADES"], // ja correto
          [/\bCURRICULO\b/g, "CURRÍCULO"],
          [/\bPERIODO\b/g, "PERÍODO"],
          [/\bPERIODOS\b/g, "PERÍODOS"],
          [/\bEDUCACAO\b/g, "EDUCAÇÃO"],
          [/\bCONHECIMENTO\b/g, "CONHECIMENTO"], // ja correto
          [/\bCONHECIMENTOS\b/g, "CONHECIMENTOS"], // ja correto
          [/\bCOMERCIO\b/g, "COMÉRCIO"],
          [/\bNEGOCIOS\b/g, "NEGÓCIOS"],
          [/\bSERVICO\b/g, "SERVIÇO"],
          [/\bSERVICOS\b/g, "SERVIÇOS"],
          [/\bCLIENTE\b/g, "CLIENTE"], // ja correto
          [/\bCLIENTES\b/g, "CLIENTES"], // ja correto
          [/\bMERCADO\b/g, "MERCADO"], // ja correto
          [/\bPROJETO\b/g, "PROJETO"], // ja correto
          [/\bPROJETOS\b/g, "PROJETOS"], // ja correto
          [/\bDESENVOLVIMENTO\b/g, "DESENVOLVIMENTO"], // ja correto
          [/\bCOMUNIDADE\b/g, "COMUNIDADE"], // ja correto
          [/\bLIDERANCA\b/g, "LIDERANÇA"],
          [/\bLIDERANCAS\b/g, "LIDERANÇAS"],
          [/\bCOMPETENCIA\b/g, "COMPETÊNCIA"],
          [/\bEXCELENCIA\b/g, "EXCELÊNCIA"],
          [/\bEXPERIENCE\b/g, "EXPERIENCE"], // ingles - ja correto
          [/\bCONFIGURACAO\b/g, "CONFIGURAÇÃO"],
          [/\bCONFIGURACOES\b/g, "CONFIGURAÇÕES"],
          [/\bCOMUNICACAO\b/g, "COMUNICAÇÃO"],
          [/\bCOMUNICACOES\b/g, "COMUNICAÇÕES"],
          [/\bADMINISTRACAO\b/g, "ADMINISTRAÇÃO"],
          [/\bADMINISTRATIVA\b/g, "ADMINISTRATIVA"], // ja correto
          [/\bADMINISTRATIVO\b/g, "ADMINISTRATIVO"], // ja correto
          [/\bGESTOR\b/g, "GESTOR"], // ja correto
          [/\bGESTORA\b/g, "GESTORA"], // ja correto
          [/\bCONSULTOR\b/g, "CONSULTOR"], // ja correto
          [/\bCONSULTORA\b/g, "CONSULTORA"], // ja correto
          [/\bDIRECAO\b/g, "DIREÇÃO"],
          [/\bDIRECOES\b/g, "DIREÇÕES"],
          [/\bCONTRIBUICAO\b/g, "CONTRIBUIÇÃO"],
          [/\bCONTRIBUICOES\b/g, "CONTRIBUIÇÕES"],
          [/\bSELECAO\b/g, "SELEÇÃO"],
          [/\bSELECOES\b/g, "SELEÇÕES"],
          [/\bCOMERCIALIZACAO\b/g, "COMERCIALIZAÇÃO"],
          [/\bNEGOCIACAO\b/g, "NEGOCIAÇÃO"],
          [/\bNEGOCIACOES\b/g, "NEGOCIAÇÕES"],
          [/\bEVOLUCAO\b/g, "EVOLUÇÃO"],
          [/\bEVOLUCOES\b/g, "EVOLUÇÕES"],
          [/\bREVISAO\b/g, "REVISÃO"],
          [/\bREVISOES\b/g, "REVISÕES"],
          [/\bPROGRAMACAO\b/g, "PROGRAMAÇÃO"],
          [/\bCOMUNICACAO\b/g, "COMUNICAÇÃO"],
          [/\bDECISAO\b/g, "DECISÃO"],
          [/\bDECISOES\b/g, "DECISÕES"],
          [/\bDECISAO\b/g, "DECISÃO"],
          [/\bCONVERSAO\b/g, "CONVERSÃO"],
          [/\bCONVERSOES\b/g, "CONVERSÕES"],
          [/\bCOMERCIAL\b/g, "COMERCIAL"], // ja correto
        ];

        let result = text
          // Remove emojis usando ranges de code points
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "") // surrogate pairs (emojis)
          .replace(/[\u2600-\u27BF]/g, "") // misc symbols
          .replace(/[\uFE00-\uFE0F]/g, "") // variation selectors
          // Remove asteriscos de markdown bold/italic
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/__([^_]+)__/g, "$1")
          .replace(/_([^_]+)_/g, "$1")
          // Remove hashtags de markdown heading
          .replace(/^#{1,6}\s+/gm, "")
          // Remove backticks
          .replace(/`([^`]+)`/g, "$1")
          // Remove caracteres de controle exceto newlines e tabs
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
          // Normaliza multiplas linhas em branco (max 2)
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        // Aplica correcoes de acentuacao em palavras maiusculas
        for (const [pattern, replacement] of accentFixes) {
          result = result.replace(pattern, replacement);
        }

        return result;
      };

      const computedScore =
        validated.scoreBreakdown.technicalSkills +
        validated.scoreBreakdown.experience +
        validated.scoreBreakdown.keywords +
        validated.scoreBreakdown.tools +
        validated.scoreBreakdown.seniority;

      const finalMatchScore = Math.min(100, Math.max(0, computedScore));

      // Garantir que o projectedMatchScore NUNCA seja menor que o matchScore original
      // A otimização só pode melhorar ou manter o score, nunca piorar
      let finalProjectedScore = Math.min(100, Math.max(0, validated.projectedMatchScore));
      if (finalProjectedScore < finalMatchScore) {
        // Se a IA retornou um valor menor, corrige para ser pelo menos o score original + ganho mínimo
        const minGain = Math.min(5, 100 - finalMatchScore); // ganho mínimo de 5pts ou o que faltar para 100
        finalProjectedScore = Math.min(100, finalMatchScore + minGain);
      }

      return {
        ...validated,
        optimizedResume: sanitizeResume(validated.optimizedResume),
        matchScore: finalMatchScore,
        projectedMatchScore: finalProjectedScore,
        scrapedJob: scrapedSuccessfully,
      };
    }),

  adapt: publicProcedure
    .input(
      z.object({
        optimizedResume: z.string().min(50, "Currículo muito curto"),
        keywords: z.array(z.string()),
        jobTitle: z.string(),
        platform: z.enum(["gupy", "linkedin", "site_empresa", "recrutador"]),
      })
    )
    .mutation(async ({ input }) => {
      const { optimizedResume, keywords, jobTitle, platform } = input;

      const platformRules: Record<string, string> = {
        gupy: `PLATAFORMA: GUPY
Regras específicas do Gupy (usado por Ambev, Natura, Itaú, Magazine Luiza e 2.800+ empresas):
- TAMANHO MÁXIMO: 2 páginas para sênior/gerente, 1 página para júnior/pleno — corte o que for menos relevante
- O Gupy usa NLP semântico: inclua sinônimos e variações dos termos técnicos além dos termos exatos
- Adicione linguagem de fit cultural naturalmente no Resumo Profissional: colaboração, impacto, propósito, crescimento
- REMOVA obrigatoriamente: foto, data de nascimento, estado civil, RG, CPF — o Gupy captura esses dados no formulário
- Priorize: Resumo Profissional denso em keywords logo no início + Competências imediatamente após
- Se o CV estiver longo, corte experiências antigas (mais de 10 anos) com pouca relevância para a vaga
- O Gupy valoriza consistência: o LinkedIn do candidato deve espelhar este CV`,

        linkedin: `PLATAFORMA: LINKEDIN (Candidatura Simplificada — Easy Apply)
Regras específicas para candidaturas via LinkedIn:
- O recrutador vai comparar o CV com o perfil LinkedIn — garanta consistência
- Seção de Competências/Skills: liste os termos EXATOS que aparecem como skills no LinkedIn
- O Resumo pode ser levemente mais conversacional — o LinkedIn permite voz mais pessoal
- Destaque conquistas quantificadas no topo de cada experiência
- Tamanho ideal: 1-2 páginas
- Skills mais importantes da vaga devem aparecer no topo da seção de Competências`,

        site_empresa: `PLATAFORMA: SITE DA EMPRESA (ATS Clássico — Workday, Taleo, SAP SuccessFactors)
Regras para ATS clássicos usados em grandes empresas:
- KEYWORDS EXATAS: estes sistemas não usam NLP semântico — precisa do termo literal da vaga
- Inclua OBRIGATORIAMENTE tanto siglas quanto forma expandida: CRM (Customer Relationship Management), BI (Business Intelligence)
- Cabeçalhos 100% padrão em MAIÚSCULAS — sem nenhuma variação criativa
- Zero elementos de formatação além de hífens (-) e parênteses ()
- Keywords da vaga devem aparecer pelo menos 2x no currículo
- Tamanho: 1-2 páginas`,

        recrutador: `PLATAFORMA: RECRUTADOR PEDIU O CV (envio direto por email ou WhatsApp)
Este CV será lido por um humano, não por um ATS. Otimize para impressionar:
- Resumo Profissional com personalidade e narrativa — não apenas lista de keywords
- Linha de abertura poderosa no Resumo que capture atenção imediatamente
- Métricas e conquistas em DESTAQUE no topo de cada experiência — primeiro bullet sempre com resultado quantificado
- Narrativa de carreira coerente — a trajetória deve contar uma história de crescimento
- Pode ter até 2 páginas com conteúdo rico e detalhado
- Tom mais assertivo e confiante na descrição das conquistas`,
      };

      const systemPrompt = `Você é especialista sênior em adaptação de currículos para diferentes plataformas e contextos de candidatura, com profundo conhecimento do mercado brasileiro.

REGRAS ABSOLUTAS — NUNCA VIOLAR:
1. NUNCA altere datas, períodos, anos ou meses de qualquer experiência
2. NUNCA altere nomes de empresas onde o candidato trabalhou
3. NUNCA altere cargos ou títulos que o candidato ocupou
4. NUNCA invente habilidades, ferramentas, certificações ou conquistas
5. NUNCA use emojis, asteriscos (**), sublinhados (__) ou qualquer markdown
6. NUNCA use tabelas ou múltiplas colunas

AUTO-VERIFICAÇÃO antes de retornar:
□ Todas as datas são IDÊNTICAS ao currículo recebido?
□ Todos os nomes de empresas são IDÊNTICOS?
□ Zero emojis e zero markdown no adaptedResume?
SE QUALQUER RESPOSTA FOR NÃO → corrija antes de retornar.

Retorne APENAS JSON válido, sem texto fora do JSON.`;

      const userMessage = `CURRÍCULO BASE (já otimizado — adapte para a plataforma):
${optimizedResume}

CARGO DA VAGA: ${jobTitle}
KEYWORDS IDENTIFICADAS: ${keywords.join(", ")}

${platformRules[platform]}

Adapte o currículo seguindo EXATAMENTE as regras da plataforma acima.
Mantenha todos os dados factuais idênticos ao original.

Retorne JSON:
{
  "adaptedResume": "<currículo adaptado em texto puro com \\n para quebras — ZERO emojis, asteriscos ou markdown>",
  "platformTips": [
    "<dica prática específica para se candidatar nesta plataforma>",
    "<dica 2>",
    "<dica 3>"
  ],
  "whatChanged": "<resumo em 2-3 linhas do que foi adaptado e por quê para esta plataforma>"
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "adapt_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                adaptedResume: { type: "string" },
                platformTips: { type: "array", items: { type: "string" } },
                whatChanged: { type: "string" },
              },
              required: ["adaptedResume", "platformTips", "whatChanged"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("Resposta vazia da IA. Tente novamente.");
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("Erro ao processar resposta da IA. Tente novamente.");
      }

      const AdaptResultSchema = z.object({
        adaptedResume: z.string(),
        platformTips: z.array(z.string()),
        whatChanged: z.string(),
      });

      const validated = AdaptResultSchema.parse(parsed);

      const sanitize = (text: string): string => {
        return text
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
          .replace(/[\u2600-\u27BF]/g, "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/__([^_]+)__/g, "$1")
          .replace(/^#{1,6}\s+/gm, "")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      };

      return {
        adaptedResume: sanitize(validated.adaptedResume),
        platformTips: validated.platformTips,
        whatChanged: validated.whatChanged,
      };
    }),

  generateFromScratch: publicProcedure
    .input(
      z.object({
        wizardData: z.object({
          name: z.string(),
          title: z.string(),
          city: z.string(),
          phone: z.string(),
          email: z.string(),
          linkedin: z.string(),
          summary: z.string(),
          experiences: z.array(z.object({
            role: z.string(),
            company: z.string(),
            period: z.string(),
            description: z.string(),
          })),
          education: z.array(z.object({
            course: z.string(),
            institution: z.string(),
            year: z.string(),
          })),
          skills: z.string(),
          languages: z.string(),
          certifications: z.string(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const d = input.wizardData;

      const systemPrompt = `Voce e uma consultora senior de carreira certificada (CPRW) e especialista em recolocacao profissional com 20 anos de experiencia.

Sua tarefa e criar um curriculo profissional completo, otimizado para ATS, usando APENAS as informacoes fornecidas.

REGRAS ABSOLUTAS:
1. Use APENAS as informacoes fornecidas. NUNCA invente dados, datas, empresas ou habilidades.
2. Transforme descricoes informais em bullets profissionais com verbos de acao fortes.
3. O curriculo deve ser TEXTO PURO com quebras de linha reais.
4. PROIBIDO: emojis, asteriscos, markdown, hashtags, tabelas.
5. Estrutura: Nome > Titulo > Contato > Resumo Profissional > Competencias > Experiencia > Formacao > Idiomas > Certificacoes.
6. Use verbos de acao: Liderou, Implementou, Desenvolveu, Aumentou, Gerenciou, Negociou, Conquistou.
7. Quantifique resultados quando o usuario mencionar numeros.
8. Retorne APENAS o texto do curriculo, sem JSON, sem explicacoes adicionais.`;

      const expLines = d.experiences
        .filter(e => e.role)
        .map(e => `${e.role} | ${e.company} | ${e.period}\n${e.description}`)
        .join("\n\n");

      const eduLines = d.education
        .filter(e => e.course)
        .map(e => `${e.course} - ${e.institution}${e.year ? ` (${e.year})` : ""}`)
        .join("\n");

      const userMessage = `Crie um curriculo profissional com estas informacoes:\n\nNOME: ${d.name}\nTITULO: ${d.title}\nCIDADE: ${d.city}\nTELEFONE: ${d.phone}\nEMAIL: ${d.email}\nLINKEDIN: ${d.linkedin}\n\nRESUMO (informal): ${d.summary}\n\nEXPERIENCIAS:\n${expLines}\n\nFORMACAO:\n${eduLines}\n\nHABILIDADES: ${d.skills}\nIDIOMAS: ${d.languages}\nCERTIFICACAO: ${d.certifications}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) throw new Error("Resposta vazia da IA. Tente novamente.");
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

      const sanitized = content
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
        .replace(/[\u2600-\u27BF]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return { generatedResume: sanitized };
    }),
});
