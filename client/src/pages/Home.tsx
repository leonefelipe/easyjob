import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Zap, CheckCircle, Copy, Download, Loader2, FileText,
  TrendingUp, ArrowUpRight, History, Globe, Plus, Trash2,
  ChevronRight, RefreshCw, AlertTriangle, BookOpen, Info,
  Languages, LayoutTemplate, User, Briefcase, GraduationCap,
  Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { extractTextFromFile } from "@/lib/fileExtractor";
import { generateResumePDF } from "@/lib/pdfGenerator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Edit3, Save, X, ExternalLink, MapPin, Building2, Search } from "lucide-react";

interface JobListing {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  description: string;
  matchReason: string;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface AnalysisResult {
  atsScore: number;
  technicalSkills: string[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

interface SavedCV {
  text: string;
  fileName: string;
  savedAt: string;
}

interface HistoryItem {
  id: string;
  jobTitle: string;
  jobArea: string;
  atsScore: number; // Changed from matchScore
  date: string;
  result: AnalysisResult;
  resumeText: string;
}

// ─── Wizard Types ────────────────────────────────────────────────────────────

interface WizardData {
  name: string; title: string; city: string; phone: string; email: string; linkedin: string;
  summary: string;
  experiences: Array<{ role: string; company: string; period: string; description: string }>;
  education: Array<{ course: string; institution: string; year: string }>;
  skills: string; languages: string; certifications: string;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const LS_CV_KEY = "easyjobai_saved_cv";
const LS_HISTORY_KEY = "easyjobai_history";

function loadSavedCV(): SavedCV | null {
  try { return JSON.parse(localStorage.getItem(LS_CV_KEY) || "null"); } catch { return null; }
}
function saveCV(cv: SavedCV) { localStorage.setItem(LS_CV_KEY, JSON.stringify(cv)); }
function clearCV() { localStorage.removeItem(LS_CV_KEY); }

function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(items.slice(0, 10)));
}
function addToHistory(item: HistoryItem) {
  const history = loadHistory();
  saveHistory([item, ...history.filter(h => h.id !== item.id)]);
}

// ─── ResumeRenderer ──────────────────────────────────────────────────────────

function ResumeRenderer({ text }: { text: string }) {
  if (!text) return null;
  const normalized = text.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  const isSectionTitle = (line: string) => {
    const t = line.trim();
    if (t.length < 4) return false;
    const alpha = t.replace(/[^a-zA-ZÀ-ÿ]/g, "");
    if (!alpha.length) return false;
    const upper = t.replace(/[^A-ZÀ-ÖØ-Þ]/g, "");
    return upper.length / alpha.length >= 0.7;
  };
  const isNameLine = (idx: number) => lines.findIndex(l => l.trim().length > 0) === idx;
  const isBullet = (line: string) => /^[•\-\*\u2022\u2023\u25E6\u2043]/.test(line.trim());

  const elements: React.ReactNode[] = [];
  let key = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; const t = line.trim();
    if (!t) { elements.push(<div key={key++} className="h-3" />); continue; }
    if (isNameLine(i)) { elements.push(<h1 key={key++} className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">{t}</h1>); continue; }
    if (isSectionTitle(t)) { elements.push(<div key={key++} className="mt-5 mb-2"><h2 className="text-xs font-bold text-blue-900 uppercase tracking-widest border-b border-blue-200 pb-1">{t}</h2></div>); continue; }
    if (isBullet(t)) { elements.push(<div key={key++} className="flex gap-2 items-start ml-2 my-0.5"><span className="text-blue-600 mt-1 flex-shrink-0 text-xs">•</span><span className="text-slate-700 text-sm leading-relaxed">{t.replace(/^[•\-\*\u2023\u25E6\u2043]\s*/, "")}</span></div>); continue; }
    const isJobLine = /[|\u2014\u2013]/.test(t) || /\(\d{4}/.test(t);
    elements.push(isJobLine
      ? <p key={key++} className="text-sm font-semibold text-slate-800 mt-2 mb-0.5">{t}</p>
      : <p key={key++} className="text-sm text-slate-700 leading-relaxed my-0.5">{t}</p>
    );
  }
  return <div className="font-sans">{elements}</div>;
}

// ─── DiffViewer ──────────────────────────────────────────────────────────────

function DiffViewer({ original, optimized }: { original: string; optimized: string }) {
  const normalize = (t: string) => t.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const origLines = normalize(original).split("\n");
  const optLines = normalize(optimized).split("\n");
  const maxLen = Math.max(origLines.length, optLines.length);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Original</p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-[500px] overflow-y-auto text-sm font-mono space-y-0.5">
          {origLines.map((line, i) => {
            const changed = line.trim() !== (optLines[i] || "").trim();
            return <div key={i} className={`px-1 rounded ${changed ? "bg-red-100 text-red-800 line-through" : "text-slate-700"}`}>{line || "\u00A0"}</div>;
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Otimizado</p>
        <div className="bg-white border border-slate-200 rounded-lg p-4 max-h-[500px] overflow-y-auto text-sm font-mono space-y-0.5">
          {optLines.map((line, i) => {
            const changed = line.trim() !== (origLines[i] || "").trim();
            return <div key={i} className={`px-1 rounded ${changed ? "bg-green-100 text-green-800" : "text-slate-700"}`}>{line || "\u00A0"}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

function CVWizard({ onComplete }: { onComplete: (text: string, fileName: string) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    name: "", title: "", city: "", phone: "", email: "", linkedin: "",
    summary: "",
    experiences: [{ role: "", company: "", period: "", description: "" }],
    education: [{ course: "", institution: "", year: "" }],
    skills: "", languages: "", certifications: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const generateCVMutation = trpc.resume.generateFromScratch.useMutation({
    onSuccess: (data: { generatedResume: string }) => {
      onComplete(data.generatedResume, "curriculo-criado-ia.txt");
      toast.success("Currículo criado com sucesso!");
    },
    onError: (err: { message: string }) => {
      toast.error("Erro ao gerar currículo: " + err.message);
      setIsGenerating(false);
    },
  });

  const update = (field: keyof WizardData, value: unknown) => setData(d => ({ ...d, [field]: value }));

  const handleGenerate = () => {
    setIsGenerating(true);
    generateCVMutation.mutate({ wizardData: data });
  };

  const steps = [
    { icon: User, label: "Dados Pessoais" },
    { icon: BookOpen, label: "Resumo" },
    { icon: Briefcase, label: "Experiências" },
    { icon: GraduationCap, label: "Formação" },
    { icon: Eye, label: "Revisão" },
  ];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const active = i + 1 === step;
          const done = i + 1 < step;
          return (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${active ? "bg-blue-900 text-white" : done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 ${done ? "bg-green-300" : "bg-slate-200"}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Dados Pessoais */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Dados Pessoais</h3>
          {[
            { label: "Nome completo *", field: "name" as const, placeholder: "Ex: Felipe Leone" },
            { label: "Cargo/Título profissional *", field: "title" as const, placeholder: "Ex: Executivo Comercial B2B | Headhunter" },
            { label: "Cidade, Estado", field: "city" as const, placeholder: "Ex: São Paulo, SP – Brasil" },
            { label: "Telefone", field: "phone" as const, placeholder: "Ex: +55 11 99446-5011" },
            { label: "E-mail", field: "email" as const, placeholder: "Ex: nome@email.com" },
            { label: "LinkedIn (opcional)", field: "linkedin" as const, placeholder: "Ex: linkedin.com/in/seu-perfil" },
          ].map(f => (
            <div key={f.field}>
              <label className="text-sm font-medium text-slate-700 block mb-1">{f.label}</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder={f.placeholder}
                value={data[f.field]}
                onChange={e => update(f.field, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Resumo */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Resumo Profissional</h3>
          <Textarea
            placeholder="Ex: Profissional com mais de 10 anos de experiência..."
            value={data.summary}
            onChange={e => update("summary", e.target.value)}
            rows={6}
          />
        </div>
      )}

      {/* Step 3: Experiências */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Experiências Profissionais</h3>
          {data.experiences.map((exp, idx) => (
            <Card key={idx} className="p-4 space-y-2">
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Cargo (Ex: Desenvolvedor Full-Stack)"
                value={exp.role}
                onChange={e => {
                  const newExp = [...data.experiences];
                  newExp[idx].role = e.target.value;
                  update("experiences", newExp);
                }}
              />
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Empresa (Ex: Google)"
                value={exp.company}
                onChange={e => {
                  const newExp = [...data.experiences];
                  newExp[idx].company = e.target.value;
                  update("experiences", newExp);
                }}
              />
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Período (Ex: Jan 2020 - Presente)"
                value={exp.period}
                onChange={e => {
                  const newExp = [...data.experiences];
                  newExp[idx].period = e.target.value;
                  update("experiences", newExp);
                }}
              />
              <Textarea
                placeholder="Descrição das responsabilidades e conquistas (use bullet points)"
                value={exp.description}
                onChange={e => {
                  const newExp = [...data.experiences];
                  newExp[idx].description = e.target.value;
                  update("experiences", newExp);
                }}
                rows={4}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const newExp = data.experiences.filter((_, i) => i !== idx);
                  update("experiences", newExp);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Remover
              </Button>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              update("experiences", [
                ...data.experiences,
                { role: "", company: "", period: "", description: "" },
              ])
            }
          >
            <Plus className="w-4 h-4 mr-2" /> Adicionar Experiência
          </Button>
        </div>
      )}

      {/* Step 4: Formação */}
      {step === 4 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Formação Acadêmica</h3>
          {data.education.map((edu, idx) => (
            <Card key={idx} className="p-4 space-y-2">
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Curso (Ex: Bacharelado em Ciência da Computação)"
                value={edu.course}
                onChange={e => {
                  const newEdu = [...data.education];
                  newEdu[idx].course = e.target.value;
                  update("education", newEdu);
                }}
              />
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Instituição (Ex: Universidade Federal de Minas Gerais)"
                value={edu.institution}
                onChange={e => {
                  const newEdu = [...data.education];
                  newEdu[idx].institution = e.target.value;
                  update("education", newEdu);
                }}
              />
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Ano de Conclusão (Ex: 2015)"
                value={edu.year}
                onChange={e => {
                  const newEdu = [...data.education];
                  newEdu[idx].year = e.target.value;
                  update("education", newEdu);
                }}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const newEdu = data.education.filter((_, i) => i !== idx);
                  update("education", newEdu);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Remover
              </Button>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              update("education", [
                ...data.education,
                { course: "", institution: "", year: "" },
              ])
            }
          >
            <Plus className="w-4 h-4 mr-2" /> Adicionar Formação
          </Button>
        </div>
      )}

      {/* Step 5: Revisão e Geração */}
      {step === 5 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Revisão e Geração</h3>
          <p className="text-slate-600">Revise os dados e gere seu currículo.</p>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Gerar Currículo
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)}>
            Anterior
          </Button>
        )}
        {step < steps.length && (
          <Button onClick={() => setStep(s => s + 1)}>
            Próximo <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Home() {
  const [resumeText, setResumeText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("curriculo.txt");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"analyze" | "history" | "wizard" | "jobs">("analyze");
  const [savedCV, setSavedCV] = useState<SavedCV | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [jobSearchQuery, setJobSearchQuery] = useState<string>("");
  const [jobSearchResults, setJobSearchResults] = useState<JobListing[]>([]);
  const [jobSearchLoading, setJobSearchLoading] = useState<boolean>(false);
  const [jobSearchJobTitle, setJobSearchJobTitle] = useState<string>("");
  const [jobSearchJobArea, setJobSearchJobArea] = useState<string>("");
  const [jobSearchKeywords, setJobSearchKeywords] = useState<string>("");
  const [jobSearchLocation, setJobSearchLocation] = useState<string>("Brasil");
  const [showOptimizedResume, setShowOptimizedResume] = useState<boolean>(false);

  const analyzeResumeMutation = trpc.resume.analyze.useMutation({
    onSuccess: (data) => {
      setAnalysisResult(data);
      setIsLoading(false);
      toast.success("Análise de currículo concluída!");
      // No longer saving to history here, as the mock response doesn't have all fields
      // addToHistory({
      //   id: Date.now().toString(),
      //   jobTitle: "N/A",
      //   jobArea: "N/A",
      //   matchScore: data.atsScore,
      //   projectedMatchScore: data.atsScore, // Using atsScore for simplicity
      //   date: new Date().toISOString(),
      //   result: data,
      //   resumeText: resumeText,
      // });
    },
    onError: (err) => {
      toast.error("Erro na análise: " + err.message);
      setIsLoading(false);
    },
  });

  const translateResumeMutation = trpc.translate.toEnglish.useMutation({
    onSuccess: (data) => {
      setResumeText(data.translatedResume);
      toast.success("Currículo traduzido com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro na tradução: " + err.message);
    },
  });

  const searchJobsMutation = trpc.jobs.search.useMutation({
    onSuccess: (data) => {
      setJobSearchResults(data.jobs);
      setJobSearchLoading(false);
      toast.success(`Encontradas ${data.totalFound} vagas!`);
    },
    onError: (err) => {
      toast.error("Erro ao buscar vagas: " + err.message);
      setJobSearchLoading(false);
    },
  });

  useEffect(() => {
    setSavedCV(loadSavedCV());
    setHistory(loadHistory());
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const extractedText = await extractTextFromFile(file);
      setResumeText(extractedText);
      setFileName(file.name);
      toast.success("Arquivo carregado com sucesso!");
    } catch (error) {
      toast.error("Erro ao extrair texto do arquivo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = () => {
    if (!resumeText.trim()) {
      toast.error("Por favor, insira o texto do currículo para analisar.");
      return;
    }
    setIsLoading(true);
    analyzeResumeMutation.mutate({ resumeText });
  };

  const handleSaveCV = () => {
    if (resumeText.trim()) {
      const cv: SavedCV = { text: resumeText, fileName: fileName, savedAt: new Date().toLocaleString() };
      saveCV(cv);
      setSavedCV(cv);
      toast.success("Currículo salvo localmente!");
    }
  };

  const handleLoadSavedCV = () => {
    if (savedCV) {
      setResumeText(savedCV.text);
      setFileName(savedCV.fileName);
      toast.info("Currículo carregado da memória local.");
    }
  };

  const handleClearCV = () => {
    clearCV();
    setSavedCV(null);
    setResumeText("");
    setFileName("curriculo.txt");
    setAnalysisResult(null);
    toast.info("Currículo limpo.");
  };

  const handleTranslate = () => {
    if (!resumeText.trim()) {
      toast.error("Por favor, insira o texto do currículo para traduzir.");
      return;
    }
    translateResumeMutation.mutate({ resumeText });
  };

  const handleGeneratePDF = async () => {
    if (!resumeText.trim()) {
      toast.error("Por favor, insira o texto do currículo para gerar o PDF.");
      return;
    }
    try {
      const pdfBase64 = await generateResumePDF(resumeText, "pt");
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${pdfBase64}`;
      link.download = "curriculo-easyjob.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar PDF.");
    }
  };

  const handleJobSearch = () => {
    if (!jobSearchJobTitle.trim() || !jobSearchJobArea.trim()) {
      toast.error("Por favor, preencha o cargo e a área para buscar vagas.");
      return;
    }
    setJobSearchLoading(true);
    searchJobsMutation.mutate({
      jobTitle: jobSearchJobTitle,
      jobArea: jobSearchJobArea,
      keywords: jobSearchKeywords.split(",").map(k => k.trim()).filter(Boolean),
      location: jobSearchLocation,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">EasyJob AI</h1>

        <div className="flex border-b border-slate-200 mb-6">
          <TabButton active={activeTab === "analyze"} onClick={() => setActiveTab("analyze")}>
            <Zap className="w-4 h-4 mr-2" /> Análise de CV
          </TabButton>
          <TabButton active={activeTab === "wizard"} onClick={() => setActiveTab("wizard")}>
            <FileText className="w-4 h-4 mr-2" /> Criar CV
          </TabButton>
          <TabButton active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")}>
            <Search className="w-4 h-4 mr-2" /> Buscar Vagas
          </TabButton>
          <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>
            <History className="w-4 h-4 mr-2" /> Histórico
          </TabButton>
        </div>

        {activeTab === "analyze" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <Card className="p-6 mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Seu Currículo</h2>
                <Textarea
                  placeholder="Cole seu currículo aqui ou faça upload de um arquivo..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={15}
                  className="mb-4"
                />
                <div className="flex flex-wrap gap-3 mb-4">
                  <label htmlFor="file-upload" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" /> Upload CV
                    <input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt" />
                  </label>
                  <Button onClick={handleAnalyze} disabled={isLoading || !resumeText.trim()}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Analisar CV
                  </Button>
                  <Button onClick={handleTranslate} variant="outline" disabled={translateResumeMutation.isPending || !resumeText.trim()}>
                    {translateResumeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Languages className="w-4 h-4 mr-2" />
                    )}
                    Traduzir para Inglês
                  </Button>
                  <Button onClick={handleGeneratePDF} variant="outline" disabled={!resumeText.trim()}>
                    <Download className="w-4 h-4 mr-2" /> Gerar PDF
                  </Button>
                  <Button onClick={handleSaveCV} variant="outline" disabled={!resumeText.trim()}>
                    <Save className="w-4 h-4 mr-2" /> Salvar CV
                  </Button>
                  {savedCV && (
                    <Button onClick={handleLoadSavedCV} variant="outline">
                      <FileText className="w-4 h-4 mr-2" /> Carregar {savedCV.fileName}
                    </Button>
                  )}
                  <Button onClick={handleClearCV} variant="destructive" disabled={!resumeText.trim() && !savedCV}>
                    <Trash2 className="w-4 h-4 mr-2" /> Limpar Tudo
                  </Button>
                </div>
                {fileName && <p className="text-sm text-slate-500">Arquivo atual: {fileName}</p>}
              </Card>

              {analysisResult && (
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-4">Resultado da Análise</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-slate-700">Score ATS:</span>
                      <span className="text-2xl font-bold text-blue-600">{analysisResult.atsScore ?? 0}/100</span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /> Pontos Fortes</h3>
                      <ul className="list-disc list-inside space-y-1 text-slate-600">
                        {(analysisResult.strengths ?? []).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-600" /> Pontos Fracos</h3>
                      <ul className="list-disc list-inside space-y-1 text-slate-600">
                        {(analysisResult.weaknesses ?? []).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" /> Sugestões de Melhoria</h3>
                      <ul className="list-disc list-inside space-y-1 text-slate-600">
                        {(analysisResult.improvements ?? []).map((imp, i) => (
                          <li key={i}>{imp}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><Zap className="w-5 h-5 text-purple-600" /> Habilidades Técnicas</h3>
                      <ul className="list-disc list-inside space-y-1 text-slate-600">
                        {(analysisResult.technicalSkills ?? []).map((skill, i) => (
                          <li key={i}>{skill}</li>
                        ))}
                      </ul>
                    </div>

                    {/* {analysisResult.optimizedResume && (
                      <div className="mt-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Currículo Otimizado</h3>
                        <Button variant="outline" onClick={() => setShowOptimizedResume(!showOptimizedResume)}>
                          {showOptimizedResume ? "Esconder" : "Mostrar"} Currículo Otimizado
                        </Button>
                        {showOptimizedResume && (
                          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <ResumeRenderer text={analysisResult.optimizedResume} />
                          </div>
                        )}
                      </div>
                    )} */}
                  </div>
                </Card>
              )}
            </div>

            <div>
              <Card className="p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Visualização do Currículo</h2>
                <div className="bg-white border border-slate-200 rounded-lg p-6 min-h-[400px] max-h-[800px] overflow-y-auto">
                  <ResumeRenderer text={resumeText} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "wizard" && (
          <Card className="p-6">
            <CVWizard
              onComplete={(text, name) => {
                setResumeText(text);
                setFileName(name);
                setActiveTab("analyze");
              }}
              onClose={() => setActiveTab("analyze")}
            />
          </Card>
        )}

        {activeTab === "jobs" && (
          <Card className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Buscar Vagas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Cargo</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="Ex: Desenvolvedor Full-Stack"
                  value={jobSearchJobTitle}
                  onChange={e => setJobSearchJobTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Área</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-white"
                  placeholder="Ex: Tecnologia da Informação"
                  value={jobSearchJobArea}
                  onChange={e => setJobSearchJobArea(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Palavras-chave (separadas por vírgula)</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-white"
                  placeholder="Ex: React, Node.js, AWS"
                  value={jobSearchKeywords}
                  onChange={e => setJobSearchKeywords(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Localização</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-white"
                  placeholder="Ex: São Paulo, Remoto"
                  value={jobSearchLocation}
                  onChange={e => setJobSearchLocation(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleJobSearch} disabled={jobSearchLoading || !jobSearchJobTitle.trim() || !jobSearchJobArea.trim()}>
              {jobSearchLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Buscar Vagas
            </Button>

            {jobSearchResults.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Vagas Encontradas</h3>
                <div className="space-y-4">
                  {jobSearchResults.map((job, idx) => (
                    <Card key={idx} className="p-4">
                      <h4 className="text-md font-semibold text-blue-600">{job.title}</h4>
                      <p className="text-sm text-slate-700 flex items-center gap-1 mt-1">
                        <Building2 className="w-3 h-3" /> {job.company}
                      </p>
                      <p className="text-sm text-slate-700 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </p>
                      <p className="text-sm text-slate-600 mt-2">{job.description}</p>
                      <p className="text-xs text-slate-500 mt-1">Fonte: {job.source}</p>
                      <p className="text-xs text-green-600 font-medium mt-1">Motivo da Compatibilidade: {job.matchReason}</p>
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-500 hover:text-blue-700 text-sm mt-3">
                        Ver Vaga <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {activeTab === "history" && (
          <Card className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Histórico de Análises</h2>
            {history.length === 0 ? (
              <p className="text-slate-600">Nenhuma análise no histórico ainda.</p>
            ) : (
              <div className="space-y-4">
                {history.map((item, idx) => (
                  <Card key={idx} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{item.jobTitle} - {item.jobArea}</p>
                      <p className="text-sm text-slate-600">Score ATS: {item.atsScore ?? 0}/100</p>
                      <p className="text-xs text-slate-500">{new Date(item.date).toLocaleString()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      setResumeText(item.resumeText);
                      setAnalysisResult(item.result);
                      setActiveTab("analyze");
                      toast.info("Análise carregada do histórico.");
                    }}>
                      Ver Detalhes
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

interface TabButtonProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function TabButton({ children, active, onClick }: TabButtonProps) {
  return (
    <button
      className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
