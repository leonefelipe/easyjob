import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import AnalysisLayout from "@/components/AnalysisLayout";
import { generateClientReport } from "@/lib/clientReportGenerator";
import { LinkedinIcon, CheckCircle2, TrendingUp, Target, Award } from "lucide-react";

export default function LinkedInPage() {
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [extractedProfile, setExtractedProfile] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  const extractMutation = trpc.linkedin.extractProfile.useMutation({
    onSuccess: (data) => {
      setExtractedProfile(data);
      setIsExtracting(false);
      toast.success("Perfil LinkedIn extraído com sucesso");
      setProgress(50);
    },
    onError: (error) => {
      setIsExtracting(false);
      toast.error(error.message || "Erro ao extrair perfil");
      setProgress(0);
    },
  });

  const analyzeMutation = trpc.linkedin.analyzeProfile.useMutation({
    onSuccess: (data) => {
      setAnalysisResult(data);
      setIsAnalyzing(false);
      toast.success("Análise concluída");
      setProgress(100);
    },
    onError: (error) => {
      setIsAnalyzing(false);
      toast.error(error.message || "Erro na análise");
      setProgress(50);
    },
  });

  const handleExtract = async () => {
    if (!linkedInUrl.trim()) {
      toast.error("Por favor, insira a URL do LinkedIn");
      return;
    }
    setIsExtracting(true);
    setProgress(25);
    extractMutation.mutate({ url: linkedInUrl });
  };

  const handleAnalyze = async () => {
    if (!extractedProfile) {
      toast.error("Extraia o perfil primeiro");
      return;
    }
    setIsAnalyzing(true);
    setProgress(75);
    const profileText = `
Nome: ${extractedProfile.name || "N/A"}
Headline: ${extractedProfile.headline || "N/A"}
Sobre: ${extractedProfile.about || "N/A"}
Experiência: ${JSON.stringify(extractedProfile.experience || [])}
Formação: ${JSON.stringify(extractedProfile.education || [])}
Skills: ${JSON.stringify(extractedProfile.skills || [])}
    `.trim();
    analyzeMutation.mutate({ profileText });
  };

  const handleGeneratePDF = async () => {
    if (!analysisResult) {
      toast.error("Realize a análise primeiro");
      return;
    }
    try {
      const element = profileRef.current;
      if (!element) {
        toast.error("Elemento de referência não encontrado");
        return;
      }
      await generateClientReport(analysisResult, element);
      toast.success("Relatório PDF gerado com sucesso");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b border-border bg-card">
        <div className="container py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-accent/10 rounded-full">
              <Award className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">Consultoria Estratégica</span>
            </div>
            <h1 className="text-display text-4xl md:text-5xl lg:text-6xl mb-6 text-primary">
              Análise Estratégica de<br />Posicionamento no LinkedIn
            </h1>
            <p className="text-consulting text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Diagnóstico executivo do seu perfil profissional com recomendações personalizadas 
              para fortalecer autoridade, visibilidade e atração de oportunidades estratégicas.
            </p>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-16 border-b border-border">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-display text-2xl md:text-3xl text-center mb-12 text-primary">
              O que você receberá
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Target,
                  title: "Diagnóstico Completo",
                  description: "Análise detalhada de headline, resumo, experiências e posicionamento estratégico"
                },
                {
                  icon: TrendingUp,
                  title: "Recomendações Executivas",
                  description: "Sugestões específicas para fortalecer autoridade e diferenciação competitiva"
                },
                {
                  icon: CheckCircle2,
                  title: "Relatório Profissional",
                  description: "Documento em PDF com padrão de consultoria estratégica pronto para implementação"
                }
              ].map((item, idx) => (
                <Card key={idx} className="card-premium border-0">
                  <CardContent className="pt-8">
                    <item.icon className="w-10 h-10 text-accent mb-4" />
                    <h3 className="text-lg font-semibold mb-2 text-primary">{item.title}</h3>
                    <p className="text-consulting text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Analysis Tool */}
      <section className="py-16">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <Card className="card-premium border-0 shadow-lg">
              <CardHeader className="border-b border-border pb-6">
                <CardTitle className="text-display text-2xl text-primary">Iniciar Análise</CardTitle>
                <CardDescription className="text-consulting">
                  Insira a URL do perfil LinkedIn para começar o diagnóstico estratégico
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-8 space-y-8">
                {/* Progress */}
                {progress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Progresso da análise</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* URL Input */}
                <div className="space-y-3">
                  <Label htmlFor="linkedin-url" className="text-sm font-medium">
                    URL do LinkedIn
                  </Label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <LinkedinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="linkedin-url"
                        type="url"
                        placeholder="https://linkedin.com/in/seu-perfil"
                        value={linkedInUrl}
                        onChange={(e) => setLinkedInUrl(e.target.value)}
                        disabled={isExtracting || isAnalyzing}
                        className="pl-11 h-12 border-border"
                      />
                    </div>
                    <Button
                      onClick={handleExtract}
                      disabled={isExtracting || isAnalyzing || !linkedInUrl.trim()}
                      className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    >
                      {isExtracting ? "Extraindo..." : "Extrair Perfil"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-consulting">
                    A extração pode levar alguns instantes. Certifique-se de que o perfil é público.
                  </p>
                </div>

                <Separator />

                {/* Analysis Actions */}
                {extractedProfile && (
                  <div className="space-y-4">
                    <div className="bg-accent/5 border border-accent/20 rounded-md p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-primary">Perfil extraído com sucesso</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {extractedProfile.name} • {extractedProfile.headline || "Sem headline"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="flex-1 h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
                      >
                        {isAnalyzing ? "Analisando..." : "Gerar Análise Estratégica"}
                      </Button>
                      {analysisResult && (
                        <Button
                          onClick={handleGeneratePDF}
                          variant="outline"
                          className="h-12 px-8 border-primary text-primary hover:bg-primary/5"
                        >
                          Baixar Relatório PDF
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Results */}
            {analysisResult && (
              <div ref={profileRef} className="mt-12">
                <AnalysisLayout result={analysisResult} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container">
          <div className="text-center">
            <p className="text-display text-xl text-primary mb-2">
              Leone Berto Consultoria
            </p>
            <p className="text-consulting text-sm text-muted-foreground">
              Estratégia de Carreira e Posicionamento Profissional
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
