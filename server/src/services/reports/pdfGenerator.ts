import PDFDocument from 'pdfkit';
import type { ReportRecord } from '../../types/reports.js';

/**
 * Sanitizes arbitrary user-supplied feedback text to prevent rendering errors
 * or unprintable control characters in PDFKit standard fonts.
 */
function sanitizeText(str: unknown, maxLength = 800): string {
  if (str === null || str === undefined) return '';
  let cleaned = String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove control chars
    .replace(/[^\x20-\x7E\n\r\t]/g, (ch) => {
      // Map common typographic unicode characters to standard ASCII equivalents
      switch (ch) {
        case '“':
        case '”':
          return '"';
        case '‘':
        case '’':
          return "'";
        case '—':
        case '–':
          return '-';
        case '•':
          return '*';
        case '…':
          return '...';
        default:
          return ' ';
      }
    })
    .trim();

  if (cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength) + '...';
  }
  return cleaned;
}

/**
 * Generates an executive-ready, high-density PDF report buffer from a ReportRecord.
 */
export async function generateReportPdf(report: ReportRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        info: {
          Title: report.title,
          Author: 'InsightFlow Analytics Engine',
          Subject: report.description || 'Customer Intelligence Report',
          Keywords: 'InsightFlow, Feedback, Analytics, AI Recommendations',
          CreationDate: new Date(report.generatedAt),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const payload = report.contentPayload;
      const meta = payload.metadata;
      const pageWidth = doc.page.width - 100; // 50 margin each side

      // Helper for drawing horizontal section divider
      const drawDivider = (color = '#E2E8F0') => {
        doc.moveDown(0.5);
        doc.strokeColor(color).lineWidth(1);
        doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
        doc.moveDown(0.5);
      };

      // Helper for checking page overflow before new sections
      const checkPageBreak = (neededHeight = 80) => {
        if (doc.y + neededHeight > doc.page.height - 60) {
          doc.addPage();
        }
      };

      // ==========================================
      // 1. BRAND HEADER & REPORT METADATA
      // ==========================================
      doc.rect(50, 40, pageWidth, 5).fill('#4F46E5'); // Brand accent bar
      doc.y = 55;

      doc.fontSize(20).fillColor('#0F172A').font('Helvetica-Bold')
        .text('INSIGHTFLOW', { continued: true })
        .fontSize(10).fillColor('#64748B').font('Helvetica')
        .text('   CUSTOMER FEEDBACK & INTELLIGENCE REPORT', { align: 'right' });

      doc.moveDown(0.3);
      doc.fontSize(16).fillColor('#1E293B').font('Helvetica-Bold')
        .text(sanitizeText(report.title, 120));

      doc.fontSize(9).fillColor('#64748B').font('Helvetica');
      doc.text(`Report Code: ${meta.reportCode}  •  Type: ${meta.reportType.toUpperCase()}  •  Generated: ${new Date(report.generatedAt).toUTCString()}`);
      doc.text(`Scope: ${meta.applicableDateRange.note}`);

      drawDivider('#CBD5E1');

      // ==========================================
      // 2. EXECUTIVE SUMMARY BOX
      // ==========================================
      checkPageBreak(100);
      doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
        .text('EXECUTIVE SUMMARY');
      doc.moveDown(0.2);

      const summaryY = doc.y;
      const summaryText = sanitizeText(payload.executiveSummary);
      
      // Calculate background box height
      doc.fontSize(9).font('Helvetica');
      const textHeight = doc.heightOfString(summaryText, { width: pageWidth - 24, lineGap: 3 });
      const boxHeight = textHeight + 20;

      // Draw subtle filled background card
      doc.rect(50, summaryY, pageWidth, boxHeight)
        .fillAndStroke('#F8FAFC', '#E2E8F0');

      doc.y = summaryY + 10;
      doc.fillColor('#334155').font('Helvetica')
        .text(summaryText, 62, doc.y, { width: pageWidth - 24, lineGap: 3 });

      doc.y = summaryY + boxHeight + 10;

      // ==========================================
      // 3. DATASET SCOPE & ANALYSIS STATUS
      // ==========================================
      checkPageBreak(90);
      doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
        .text('1. DATASET SCOPE & COVERAGE STATUS');
      doc.moveDown(0.3);

      const scopeY = doc.y;
      const colW = pageWidth / 4;

      const kpis = [
        { label: 'TOTAL FEEDBACK', val: `${payload.datasetScope.totalFeedback.toLocaleString()}` },
        { label: 'ANALYZED COVERAGE', val: `${payload.datasetScope.analysisCoveragePercent}%` },
        { label: 'PENDING QUEUED', val: `${payload.datasetScope.pendingAnalysis.toLocaleString()}` },
        { label: 'DUPLICATE RATE', val: `${payload.datasetScope.duplicateRatePercent}%` },
      ];

      kpis.forEach((kpi, idx) => {
        const x = 50 + idx * colW;
        doc.rect(x, scopeY, colW - 6, 42).fillAndStroke('#F1F5F9', '#CBD5E1');
        doc.fontSize(7.5).fillColor('#64748B').font('Helvetica-Bold')
          .text(kpi.label, x + 6, scopeY + 6, { width: colW - 16 });
        doc.fontSize(14).fillColor('#0F172A').font('Helvetica-Bold')
          .text(kpi.val, x + 6, scopeY + 18, { width: colW - 16 });
      });

      doc.y = scopeY + 50;

      // ==========================================
      // 4. SENTIMENT DISTRIBUTION & NET SENTIMENT
      // ==========================================
      checkPageBreak(90);
      doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
        .text('2. CUSTOMER SENTIMENT DISTRIBUTION');
      doc.moveDown(0.3);

      const sent = payload.sentimentDistribution;
      const sentY = doc.y;

      const sentCards = [
        { label: 'POSITIVE', val: `${sent.positive.percentage}% (${sent.positive.count})`, color: '#16A34A', bg: '#F0FDF4' },
        { label: 'NEUTRAL', val: `${sent.neutral.percentage}% (${sent.neutral.count})`, color: '#475569', bg: '#F8FAFC' },
        { label: 'NEGATIVE', val: `${sent.negative.percentage}% (${sent.negative.count})`, color: '#DC2626', bg: '#FEF2F2' },
        { label: 'NET SENTIMENT INDEX', val: `${sent.netSentimentScore > 0 ? '+' : ''}${sent.netSentimentScore}`, color: '#4F46E5', bg: '#EEF2FF' },
      ];

      sentCards.forEach((c, idx) => {
        const x = 50 + idx * colW;
        doc.rect(x, sentY, colW - 6, 42).fillAndStroke(c.bg, '#E2E8F0');
        doc.fontSize(7.5).fillColor(c.color).font('Helvetica-Bold')
          .text(c.label, x + 6, sentY + 6, { width: colW - 16 });
        doc.fontSize(13).fillColor(c.color).font('Helvetica-Bold')
          .text(c.val, x + 6, sentY + 18, { width: colW - 16 });
      });

      doc.y = sentY + 48;
      doc.fontSize(8).fillColor('#94A3B8').font('Helvetica')
        .text(`* Percentages calculated over ${sent.denominator} analyzed records with complete sentiment classification.`);

      drawDivider();

      // ==========================================
      // 5. CATEGORY BREAKDOWN TABLE
      // ==========================================
      checkPageBreak(120);
      doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
        .text('3. CATEGORY VOLUME & DOMINANT SENTIMENT');
      doc.moveDown(0.3);

      // Table Header
      const tableY = doc.y;
      doc.rect(50, tableY, pageWidth, 18).fill('#1E293B');
      doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica-Bold');
      doc.text('CATEGORY', 58, tableY + 5, { width: 180 });
      doc.text('VOLUME', 240, tableY + 5, { width: 80, align: 'right' });
      doc.text('PROPORTION', 330, tableY + 5, { width: 80, align: 'right' });
      doc.text('DOMINANT SENTIMENT', 420, tableY + 5, { width: 120, align: 'center' });

      doc.y = tableY + 18;
      payload.categoryBreakdown.slice(0, 6).forEach((cat, idx) => {
        const rowY = doc.y;
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(50, rowY, pageWidth, 18).fillAndStroke(bg, '#E2E8F0');

        doc.fontSize(8.5).fillColor('#1E293B').font('Helvetica');
        doc.text(sanitizeText(cat.category, 35), 58, rowY + 5, { width: 180 });
        doc.text(`${cat.count.toLocaleString()}`, 240, rowY + 5, { width: 80, align: 'right' });
        doc.text(`${cat.percentage}%`, 330, rowY + 5, { width: 80, align: 'right' });
        
        const sentColor = cat.dominantSentiment === 'positive' ? '#16A34A' : cat.dominantSentiment === 'negative' ? '#DC2626' : '#64748B';
        doc.fillColor(sentColor).font('Helvetica-Bold')
          .text(cat.dominantSentiment.toUpperCase(), 420, rowY + 5, { width: 120, align: 'center' });

        doc.y = rowY + 18;
      });

      doc.moveDown(0.8);

      // ==========================================
      // 6. TOP PRIORITY ISSUES & SCORE COMPONENTS
      // ==========================================
      checkPageBreak(150);
      doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
        .text('4. TOP PRIORITY ISSUES & MULTI-FACTOR SCORE COMPONENTS');
      doc.moveDown(0.3);

      const issueTableY = doc.y;
      doc.rect(50, issueTableY, pageWidth, 18).fill('#1E293B');
      doc.fontSize(7.5).fillColor('#FFFFFF').font('Helvetica-Bold');
      doc.text('CODE / TITLE', 58, issueTableY + 5, { width: 180 });
      doc.text('TIER', 240, issueTableY + 5, { width: 60, align: 'center' });
      doc.text('SCORE', 305, issueTableY + 5, { width: 45, align: 'right' });
      doc.text('FREQ / SEV / NEG', 355, issueTableY + 5, { width: 110, align: 'center' });
      doc.text('STATUS', 470, issueTableY + 5, { width: 70, align: 'center' });

      doc.y = issueTableY + 18;
      payload.topPriorityIssues.slice(0, 5).forEach((issue, idx) => {
        checkPageBreak(24);
        const rowY = doc.y;
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(50, rowY, pageWidth, 22).fillAndStroke(bg, '#E2E8F0');

        doc.fontSize(8).fillColor('#0F172A').font('Helvetica-Bold');
        doc.text(`${issue.code}: ${sanitizeText(issue.title, 32)}`, 58, rowY + 6, { width: 180 });

        const tierColor = issue.priority === 'critical' ? '#DC2626' : issue.priority === 'high' ? '#D97706' : '#2563EB';
        doc.fontSize(7.5).fillColor(tierColor).font('Helvetica-Bold')
          .text(issue.priority.toUpperCase(), 240, rowY + 6, { width: 60, align: 'center' });

        doc.fontSize(8.5).fillColor('#0F172A').font('Helvetica-Bold')
          .text(`${issue.priorityScore}`, 305, rowY + 6, { width: 45, align: 'right' });

        doc.fontSize(7.5).fillColor('#475569').font('Helvetica')
          .text(`${issue.scoreBreakdown.frequencyPoints}p / ${issue.scoreBreakdown.severityPoints}p / ${issue.scoreBreakdown.negativeSentimentPoints}p`, 355, rowY + 6, { width: 110, align: 'center' });

        doc.fontSize(7.5).fillColor('#0F172A').font('Helvetica')
          .text((issue.status || 'open').toUpperCase(), 470, rowY + 6, { width: 70, align: 'center' });

        doc.y = rowY + 22;
      });

      doc.moveDown(0.8);

      // ==========================================
      // 7. TRACEABLE EVIDENCE EXCERPTS & CITATIONS
      // ==========================================
      checkPageBreak(120);
      doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
        .text('5. VERIFIED EVIDENCE EXCERPTS (TRACEABLE FEEDBACK IDs)');
      doc.moveDown(0.3);

      const allExcerpts: Array<{ feedbackId: string; quote: string; issueTitle: string }> = [];
      for (const iss of payload.topPriorityIssues.slice(0, 3)) {
        for (const exc of iss.representativeExcerpts.slice(0, 2)) {
          allExcerpts.push({
            feedbackId: exc.feedbackId,
            quote: exc.quote,
            issueTitle: iss.title,
          });
        }
      }

      allExcerpts.slice(0, 4).forEach((item) => {
        checkPageBreak(45);
        const excY = doc.y;
        doc.rect(50, excY, pageWidth, 38).fillAndStroke('#F8FAFC', '#E2E8F0');

        doc.fontSize(7.5).fillColor('#4F46E5').font('Helvetica-Bold')
          .text(`[Feedback ID: ${item.feedbackId}]  •  Cluster: ${sanitizeText(item.issueTitle, 50)}`, 58, excY + 5);

        doc.fontSize(8).fillColor('#334155').font('Helvetica-Oblique')
          .text(`"${sanitizeText(item.quote, 140)}"`, 58, excY + 16, { width: pageWidth - 16 });

        doc.y = excY + 44;
      });

      doc.moveDown(0.5);

      // ==========================================
      // 8. EVIDENCE-BACKED AI RECOMMENDATIONS
      // ==========================================
      const issuesWithRec = payload.topPriorityIssues.filter((i) => i.recommendation);
      if (issuesWithRec.length > 0) {
        checkPageBreak(130);
        doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
          .text('6. EVIDENCE-BACKED STRATEGIC RECOMMENDATIONS');
        doc.moveDown(0.3);

        issuesWithRec.slice(0, 2).forEach((iss) => {
          const rec = iss.recommendation!;
          checkPageBreak(85);
          const recY = doc.y;
          doc.rect(50, recY, pageWidth, 75).fillAndStroke('#EEF2FF', '#C7D2FE');

          doc.fontSize(8.5).fillColor('#312E81').font('Helvetica-Bold')
            .text(`Initiative: ${sanitizeText(iss.title, 45)}  •  Suggested Team: ${rec.responsibleTeam}`, 58, recY + 6);

          doc.fontSize(8).fillColor('#1E1B4B').font('Helvetica')
            .text(`Impact & Friction: ${sanitizeText(rec.whyItMatters, 160)}`, 58, recY + 19, { width: pageWidth - 16 });

          const actionSummary = rec.recommendedActions.slice(0, 2).map((a, i) => `${i + 1}. ${a.action}`).join('  |  ');
          doc.fontSize(8).fillColor('#4338CA').font('Helvetica-Bold')
            .text(`Recommended Action(s): ${sanitizeText(actionSummary, 180)}`, 58, recY + 45, { width: pageWidth - 16 });

          doc.y = recY + 82;
        });
      }

      // ==========================================
      // 9. ACTION CENTER STATUS OVERVIEW
      // ==========================================
      checkPageBreak(70);
      doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
        .text('7. ACTION CENTER PROGRESSION & RESOLUTION STATUS');
      doc.moveDown(0.3);

      const statY = doc.y;
      const statW = pageWidth / 4;
      const statusCards = [
        { label: 'OPEN ISSUES', val: `${payload.issueStatusSummary.open}`, color: '#DC2626' },
        { label: 'IN PROGRESS', val: `${payload.issueStatusSummary.in_progress}`, color: '#D97706' },
        { label: 'RESOLVED', val: `${payload.issueStatusSummary.resolved}`, color: '#16A34A' },
        { label: 'DISMISSED', val: `${payload.issueStatusSummary.dismissed}`, color: '#64748B' },
      ];

      statusCards.forEach((sc, idx) => {
        const x = 50 + idx * statW;
        doc.rect(x, statY, statW - 6, 36).fillAndStroke('#F1F5F9', '#CBD5E1');
        doc.fontSize(7).fillColor('#64748B').font('Helvetica-Bold')
          .text(sc.label, x + 6, statY + 5);
        doc.fontSize(13).fillColor(sc.color).font('Helvetica-Bold')
          .text(sc.val, x + 6, statY + 16);
      });

      doc.y = statY + 44;

      // ==========================================
      // 10. FOOTER ON ALL PAGES
      // ==========================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.strokeColor('#E2E8F0').lineWidth(0.5);
        doc.moveTo(50, doc.page.height - 45).lineTo(50 + pageWidth, doc.page.height - 45).stroke();

        doc.fontSize(7.5).fillColor('#94A3B8').font('Helvetica')
          .text(
            `Page ${i + 1} of ${range.count}   •   InsightFlow Intelligence Engine   •   Strictly Non-Financial Operational Analytics`,
            50,
            doc.page.height - 35,
            { align: 'center', width: pageWidth }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
