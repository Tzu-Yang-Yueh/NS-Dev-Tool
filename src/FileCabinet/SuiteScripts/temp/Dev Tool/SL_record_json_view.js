/**
 * Enhanced NetSuite Record Viewer with Advanced Features (Modularized)
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 *
 * Features:
 * - Complete record JSON view with field labels
 * - Compare two records side-by-side
 * - Field search and filtering
 * - Export to multiple formats (JSON, CSV, Excel-ready)
 * - Dark mode support
 * - Performance optimizations
 * - Better error handling
 * - Modular architecture for better maintainability
 */
define([
  "N/runtime",
  "N/url",
  "./modules/RecordDataService",
  "./modules/RecordComparisonService",
  "./modules/HTMLTemplateService",
], function (
  runtime,
  url,
  RecordDataService,
  RecordComparisonService,
  HTMLTemplateService
) {
  /**
   * Main Suitelet function
   */
  function onRequest(context) {
    try {
      if (context.request.method === "GET") {
        const recordType = context.request.parameters.recordtype;
        const recordId = context.request.parameters.recordid;
        const compareId = context.request.parameters.compareid;
        const darkMode = context.request.parameters.darkMode;

        const scriptUrl = url.resolveScript({
          scriptId: runtime.getCurrentScript().id,
          deploymentId: runtime.getCurrentScript().deploymentId,
          returnExternalUrl: false,
        });

        // Raw JSON format
        if (
          context.request.parameters.format === "json" &&
          recordType &&
          recordId
        ) {
          const result = RecordDataService.getFullRecordData(
            recordType,
            recordId
          );
          context.response.setHeader({
            name: "Content-Type",
            value: "application/json; charset=utf-8",
          });
          context.response.write(JSON.stringify(result, null, 2));
          return;
        }

        // Compare mode
        if (recordType && recordId && compareId) {
          const compareResult = RecordComparisonService.compareRecords(
            recordType,
            recordId,
            compareId
          );
          // You could create a specialized HTML view for comparison
          // For now, return JSON
          context.response.setHeader({
            name: "Content-Type",
            value: "application/json; charset=utf-8",
          });
          context.response.write(JSON.stringify(compareResult, null, 2));
          return;
        }

        // Normal view
        let result = null;
        if (recordType && recordId) {
          result = RecordDataService.getFullRecordData(recordType, recordId);
        } else {
          result = { success: true, data: {} };
        }

        const html = HTMLTemplateService.createHtmlPage({
          recordType: recordType,
          recordId: recordId,
          result: result,
          scriptUrl: scriptUrl,
          compareId: compareId,
          darkMode: darkMode,
        });

        context.response.write(html);
      }
    } catch (e) {
      context.response.setHeader({
        name: "Content-Type",
        value: "text/html; charset=utf-8",
      });
      context.response.write(`
        <html>
          <body>
            <h1>Error</h1>
            <p><strong>Error:</strong> ${e.message}</p>
            <p><strong>Stack:</strong> ${e.stack}</p>
          </body>
        </html>
      `);
    }
  }

  return {
    onRequest: onRequest,
  };
});
