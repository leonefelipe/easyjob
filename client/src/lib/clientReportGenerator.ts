import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function generateClientReport(analysisResult: any, element: HTMLElement) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  
  let yPosition = 0;

  // ────────────────────────────────────────────────────────────────────────────
  // COVER PAGE
  // ────────────────────────────────────────────────────────────────────────────
  
  // Navy background bar
  pdf.setFillColor(15, 30, 61); // #0f1e3d
  pdf.rect(0, 0, pageWidth, 80, "F");
  
  // Gold accent bar
  pdf.setFillColor(201, 165, 90); // #c9a55a
  pdf.rect(0, 80, pageWidth, 8, "F");
  
  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.text("Leone Berto Consultoria", pageWidth / 2, 35, { align: "center" });
  
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.text("Estratégia de Carreira e Posicionamento Profissional", pageWidth / 2, 50, { align: "center" });
  
  // Report type
  pdf.setTextColor(15, 30, 61);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  yPosition = 120;
  pdf.text("Relatório Estratégico de", pageWidth / 2, yPosition, { align: "center" });
  pdf.text("Otimização de LinkedIn", pageWidth / 2, yPosition + 12, { align: "center" });
  
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 100, 100);
  pdf.text("Análise de Posicionamento Profissional", pageWidth / 2, yPosition + 30, { align: "center" });
  
  // Date
  pdf.setFontSize(11);
  pdf.setTextColor(120, 120, 120);
  const today = new Date().toLocaleDateString("pt-BR", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
  pdf.text(today, pageWidth / 2, yPosition + 45, { align: "center" });
  
  // Footer on cover
  pdf.setFontSize(9);
  pdf.setTextColor(150, 150, 150);
  pdf.text("Documento confidencial | Uso exclusivo do cliente", pageWidth / 2, pageHeight - 15, { align: "center" });
  
  pdf.addPage();
  
  // ────────────────────────────────────────────────────────────────────────────
  // PAGE 2: EXECUTIVE SUMMARY
  // ────────────────────────────────────────────────────────────────────────────
  
  yPosition = margin;
  
  // Section header
  pdf.setFillColor(201, 165, 90);
  pdf.rect(margin, yPosition, contentWidth, 10, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Resumo Executivo", margin + 5, yPosition + 7);
  
  yPosition += 20;
  
  // Scores
  pdf.setTextColor(15, 30, 61);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Pontuações do Perfil", margin, yPosition);
  
  yPosition += 10;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  
  const atsScore = analysisResult.atsScore || 0;
  const matchScore = analysisResult.matchScore || 0;
  
  pdf.text(`ATS Score: ${atsScore}/100`, margin + 5, yPosition);
  pdf.setFillColor(220, 220, 220);
  pdf.rect(margin + 5, yPosition + 2, 80, 4, "F");
  const atsColor = atsScore >= 80 ? [34, 197, 94] : atsScore >= 60 ? [234, 179, 8] : [239, 68, 68];
  pdf.setFillColor(...atsColor);
  pdf.rect(margin + 5, yPosition + 2, (80 * atsScore) / 100, 4, "F");
  
  yPosition += 12;
  pdf.text(`Pontuação Geral: ${matchScore}/100`, margin + 5, yPosition);
  pdf.setFillColor(220, 220, 220);
  pdf.rect(margin + 5, yPosition + 2, 80, 4, "F");
  const matchColor = matchScore >= 80 ? [34, 197, 94] : matchScore >= 60 ? [234, 179, 8] : [239, 68, 68];
  pdf.setFillColor(...matchColor);
  pdf.rect(margin + 5, yPosition + 2, (80 * matchScore) / 100, 4, "F");
  
  yPosition += 15;
  
  // ────────────────────────────────────────────────────────────────────────────
  // DIAGNOSTIC
  // ────────────────────────────────────────────────────────────────────────────
  
  // Strengths
  pdf.setTextColor(15, 30, 61);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Pontos Fortes", margin, yPosition);
  yPosition += 8;
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60, 60, 60);
  
  const strengths = analysisResult.strengths || [];
  strengths.slice(0, 5).forEach((strength: string, idx: number) => {
    const lines = pdf.splitTextToSize(`• ${strength}`, contentWidth - 5);
    lines.forEach((line: string) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin + 5, yPosition);
      yPosition += 5;
    });
  });
  
  yPosition += 5;
  
  // Opportunities
  pdf.setTextColor(15, 30, 61);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Oportunidades de Melhoria", margin, yPosition);
  yPosition += 8;
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60, 60, 60);
  
  const weaknesses = analysisResult.weaknesses || [];
  weaknesses.slice(0, 5).forEach((weakness: string, idx: number) => {
    const lines = pdf.splitTextToSize(`• ${weakness}`, contentWidth - 5);
    lines.forEach((line: string) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin + 5, yPosition);
      yPosition += 5;
    });
  });
  
  pdf.addPage();
  yPosition = margin;
  
  // ────────────────────────────────────────────────────────────────────────────
  // PAGE 3: STRATEGIC RECOMMENDATIONS
  // ────────────────────────────────────────────────────────────────────────────
  
  pdf.setFillColor(201, 165, 90);
  pdf.rect(margin, yPosition, contentWidth, 10, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Recomendações Estratégicas", margin + 5, yPosition + 7);
  
  yPosition += 20;
  
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  
  const insights = analysisResult.recruiterInsights || [];
  insights.forEach((insight: string, idx: number) => {
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = margin;
    }
    
    pdf.setFillColor(201, 165, 90);
    pdf.circle(margin + 3, yPosition - 1, 2, "F");
    
    const lines = pdf.splitTextToSize(insight, contentWidth - 10);
    lines.forEach((line: string) => {
      pdf.text(line, margin + 8, yPosition);
      yPosition += 5;
    });
    yPosition += 3;
  });
  
  pdf.addPage();
  yPosition = margin;
  
  // ────────────────────────────────────────────────────────────────────────────
  // PAGE 4: NEW POSITIONING
  // ────────────────────────────────────────────────────────────────────────────
  
  if (analysisResult.linkedinOptimization) {
    pdf.setFillColor(201, 165, 90);
    pdf.rect(margin, yPosition, contentWidth, 10, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Novo Posicionamento Sugerido", margin + 5, yPosition + 7);
    
    yPosition += 20;
    
    // Headline
    pdf.setTextColor(15, 30, 61);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Headline Executiva", margin, yPosition);
    yPosition += 7;
    
    pdf.setFillColor(250, 250, 249);
    pdf.rect(margin, yPosition, contentWidth, 20, "F");
    pdf.setDrawColor(201, 165, 90);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, yPosition, contentWidth, 20);
    
    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    const headlineLines = pdf.splitTextToSize(
      analysisResult.linkedinOptimization.headline || "",
      contentWidth - 10
    );
    headlineLines.forEach((line: string, idx: number) => {
      pdf.text(line, margin + 5, yPosition + 7 + idx * 5);
    });
    
    yPosition += 30;
    
    // About
    pdf.setTextColor(15, 30, 61);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Resumo Otimizado", margin, yPosition);
    yPosition += 7;
    
    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    
    const aboutText = analysisResult.linkedinOptimization.about || "";
    const aboutLines = pdf.splitTextToSize(aboutText, contentWidth - 10);
    
    pdf.setFillColor(250, 250, 249);
    const boxHeight = Math.min(aboutLines.length * 5 + 10, 120);
    pdf.rect(margin, yPosition, contentWidth, boxHeight, "F");
    pdf.setDrawColor(201, 165, 90);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, yPosition, contentWidth, boxHeight);
    
    aboutLines.slice(0, 20).forEach((line: string, idx: number) => {
      if (yPosition + 7 + idx * 5 > pageHeight - 30) return;
      pdf.text(line, margin + 5, yPosition + 7 + idx * 5);
    });
    
    yPosition += boxHeight + 10;
    
    // Skills
    if (analysisResult.linkedinOptimization.skillsToAdd && analysisResult.linkedinOptimization.skillsToAdd.length > 0) {
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setTextColor(15, 30, 61);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Skills Estratégicas", margin, yPosition);
      yPosition += 7;
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 60);
      
      const skillsText = analysisResult.linkedinOptimization.skillsToAdd.join(" • ");
      const skillsLines = pdf.splitTextToSize(skillsText, contentWidth - 5);
      skillsLines.forEach((line: string) => {
        pdf.text(line, margin + 5, yPosition);
        yPosition += 5;
      });
    }
  }
  
  pdf.addPage();
  yPosition = margin;
  
  // ────────────────────────────────────────────────────────────────────────────
  // PAGE 5: CONTENT RECOMMENDATIONS
  // ────────────────────────────────────────────────────────────────────────────
  
  if (analysisResult.linkedinOptimization?.profileTips && analysisResult.linkedinOptimization.profileTips.length > 0) {
    pdf.setFillColor(201, 165, 90);
    pdf.rect(margin, yPosition, contentWidth, 10, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Recomendações de Conteúdo", margin + 5, yPosition + 7);
    
    yPosition += 20;
    
    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    
    analysisResult.linkedinOptimization.profileTips.forEach((tip: string, idx: number) => {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setFillColor(201, 165, 90);
      pdf.circle(margin + 3, yPosition - 1, 2, "F");
      
      const lines = pdf.splitTextToSize(tip, contentWidth - 10);
      lines.forEach((line: string) => {
        pdf.text(line, margin + 8, yPosition);
        yPosition += 5;
      });
      yPosition += 3;
    });
  }
  
  // ────────────────────────────────────────────────────────────────────────────
  // FOOTER ON ALL PAGES (except cover)
  // ────────────────────────────────────────────────────────────────────────────
  
  const totalPages = pdf.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      "Leone Berto Consultoria | Estratégia de Carreira e Posicionamento Profissional",
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    pdf.text(`Página ${i - 1} de ${totalPages - 1}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }
  
  // Save
  pdf.save("Relatorio_LinkedIn_Leone_Berto.pdf");
}
