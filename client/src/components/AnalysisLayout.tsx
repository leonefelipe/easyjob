import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Target,
  Lightbulb,
  Award,
  BarChart3,
  FileText
} from "lucide-react";

interface AnalysisLayoutProps {
  result: any;
}

export default function AnalysisLayout({ result }: AnalysisLayoutProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excelente";
    if (score >= 60) return "Adequado";
    return "Requer Melhoria";
  };

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <Card className="card-premium border-0 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-8 py-6">
          <h2 className="text-display text-3xl text-white mb-2">
            Resumo Executivo
          </h2>
          <p className="text-white/80 text-consulting">
            Análise Estratégica de Posicionamento Profissional
          </p>
        </div>
        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* ATS Score */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">ATS Score</span>
                <span className={`text-2xl font-bold ${getScoreColor(result.atsScore || 0)}`}>
                  {result.atsScore || 0}/100
                </span>
              </div>
              <Progress value={result.atsScore || 0} className="h-3" />
              <p className="text-xs text-muted-foreground text-consulting">
                {getScoreLabel(result.atsScore || 0)} — Capacidade de ser encontrado por recrutadores
              </p>
            </div>

            {/* Match Score */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Pontuação Geral</span>
                <span className={`text-2xl font-bold ${getScoreColor(result.matchScore || 0)}`}>
                  {result.matchScore || 0}/100
                </span>
              </div>
              <Progress value={result.matchScore || 0} className="h-3" />
              <p className="text-xs text-muted-foreground text-consulting">
                {getScoreLabel(result.matchScore || 0)} — Efetividade do posicionamento estratégico
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostic */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card className="card-premium border-0">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <CardTitle className="text-xl text-primary">Pontos Fortes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(result.strengths || []).map((strength: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-consulting">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Weaknesses */}
        <Card className="card-premium border-0">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <CardTitle className="text-xl text-primary">Oportunidades de Melhoria</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(result.weaknesses || []).map((weakness: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-consulting">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>{weakness}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* LinkedIn Optimization */}
      {result.linkedinOptimization && (
        <Card className="card-premium border-0">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              <CardTitle className="text-xl text-primary">Novo Posicionamento Sugerido</CardTitle>
            </div>
            <CardDescription className="text-consulting">
              Recomendações estratégicas para fortalecimento do perfil
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Headline */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-primary">Headline Executiva</Label>
              <div className="p-4 bg-accent/5 border border-accent/20 rounded-md">
                <p className="text-sm text-consulting">{result.linkedinOptimization.headline}</p>
              </div>
            </div>

            <Separator />

            {/* About */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-primary">Resumo Otimizado</Label>
              <div className="p-4 bg-accent/5 border border-accent/20 rounded-md">
                <p className="text-sm text-consulting whitespace-pre-line">
                  {result.linkedinOptimization.about}
                </p>
              </div>
            </div>

            <Separator />

            {/* Skills */}
            {result.linkedinOptimization.skillsToAdd && result.linkedinOptimization.skillsToAdd.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-primary">Skills Estratégicas</Label>
                <div className="flex flex-wrap gap-2">
                  {result.linkedinOptimization.skillsToAdd.map((skill: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strategic Recommendations */}
      {result.recruiterInsights && result.recruiterInsights.length > 0 && (
        <Card className="card-premium border-0">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent" />
              <CardTitle className="text-xl text-primary">Recomendações Estratégicas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-4">
              {result.recruiterInsights.map((insight: string, idx: number) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-accent">{idx + 1}</span>
                  </div>
                  <p className="text-sm text-consulting flex-1">{insight}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Content Recommendations */}
      {result.linkedinOptimization?.profileTips && result.linkedinOptimization.profileTips.length > 0 && (
        <Card className="card-premium border-0">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              <CardTitle className="text-xl text-primary">Recomendações de Conteúdo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {result.linkedinOptimization.profileTips.map((tip: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-consulting">
                  <Award className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`block mb-1 ${className}`}>{children}</div>;
}
