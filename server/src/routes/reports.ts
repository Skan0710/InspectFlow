import { Router, type Request, type Response } from 'express';
import { FeedbackStore } from '../services/feedbackStore.js';
import { ReportService } from '../services/reports/reportService.js';
import { generateReportPdf } from '../services/reports/pdfGenerator.js';
import { generateReportCsv } from '../services/reports/csvGenerator.js';
import {
  VALID_REPORT_TYPES,
  VALID_REPORT_FORMATS,
  type ReportType,
  type ReportFormat,
} from '../types/reports.js';
import { validateAnalyticsFilters } from './analytics.js';

const router = Router();
const store = FeedbackStore.getInstance();
const reportService = new ReportService();

/**
 * GET /api/reports
 * Returns list of all generated reports with optional type or status filtering.
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { type, status } = req.query as { type?: string; status?: string };
    const reports = store.getReports({ type, status });
    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'RetrievalError', message: msg });
  }
});

/**
 * GET /api/reports/:id
 * Retrieves a single report record by ID or report code.
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = store.getReportById(id) || store.getReportByCode(id);

    if (!report) {
      res.status(404).json({
        error: 'NotFoundError',
        message: `Report with ID or code '${id}' was not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'RetrievalError', message: msg });
  }
});

/**
 * POST /api/reports/generate
 * Generates an executive-ready business insight report from verified records.
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { title, description, reportType, format, scope, cadence, recipients } = req.body || {};

    // 1. Validate reportType
    if (reportType && !VALID_REPORT_TYPES.includes(reportType as ReportType)) {
      res.status(400).json({
        error: 'ValidationError',
        message: `Invalid reportType '${reportType}'. Must be one of: ${VALID_REPORT_TYPES.join(', ')}.`,
      });
      return;
    }

    // 2. Validate format
    if (format && !VALID_REPORT_FORMATS.includes(format as ReportFormat)) {
      res.status(400).json({
        error: 'ValidationError',
        message: `Invalid format '${format}'. Must be one of: ${VALID_REPORT_FORMATS.join(', ')}.`,
      });
      return;
    }

    // 3. Validate scope filters if provided
    if (scope && typeof scope === 'object') {
      const { error: filterError } = validateAnalyticsFilters(scope);
      if (filterError) {
        res.status(400).json({
          error: 'ValidationError',
          message: filterError,
        });
        return;
      }
    }

    // 4. Generate report
    const report = await reportService.generateReport({
      title,
      description,
      reportType,
      format,
      scope,
      cadence,
      recipients,
    });

    res.status(201).json({
      success: true,
      message: `Report '${report.reportCode}' generated successfully.`,
      data: report,
    });
  } catch (err: unknown) {
    console.error('[ReportsRoute] Error generating report:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'GenerationError', message: msg });
  }
});

/**
 * GET /api/reports/:id/pdf
 * Streams downloadable PDF export for the requested report.
 */
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = store.getReportById(id) || store.getReportByCode(id);

    if (!report) {
      res.status(404).json({
        error: 'NotFoundError',
        message: `Report with ID or code '${id}' was not found.`,
      });
      return;
    }

    const pdfBuffer = await generateReportPdf(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="InsightFlow-${report.reportCode}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (err: unknown) {
    console.error('[ReportsRoute] Error exporting PDF:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'ExportError', message: msg });
  }
});

/**
 * GET /api/reports/:id/csv
 * Streams downloadable CSV export for the requested report.
 */
router.get('/:id/csv', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = store.getReportById(id) || store.getReportByCode(id);

    if (!report) {
      res.status(404).json({
        error: 'NotFoundError',
        message: `Report with ID or code '${id}' was not found.`,
      });
      return;
    }

    const csvContent = generateReportCsv(report);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="InsightFlow-${report.reportCode}.csv"`
    );
    res.status(200).send(csvContent);
  } catch (err: unknown) {
    console.error('[ReportsRoute] Error exporting CSV:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'ExportError', message: msg });
  }
});

/**
 * DELETE /api/reports/:id
 * Removes a generated report.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await store.deleteReport(id);

    if (!deleted) {
      res.status(404).json({
        error: 'NotFoundError',
        message: `Report with ID '${id}' was not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Report '${id}' deleted successfully.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'DeletionError', message: msg });
  }
});

export default router;
