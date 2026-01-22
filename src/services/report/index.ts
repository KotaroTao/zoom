/**
 * クライアント報告書サービス
 */

export {
  generateClientReport,
  generateAndSaveClientReport,
  previewTemplate,
} from './generator.js';

export type {
  TemplateVariables,
  ReportGenerationResult,
  ReportGenerationOptions,
} from './types.js';
