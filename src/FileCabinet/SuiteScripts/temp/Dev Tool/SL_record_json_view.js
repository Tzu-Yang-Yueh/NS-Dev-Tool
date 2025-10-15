/**
 * Enhanced NetSuite Record Viewer with Advanced Features
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
 */
define([
  "N/ui/serverWidget",
  "N/record",
  "N/search",
  "N/runtime",
  "N/url",
  "N/error",
  "N/format",
], function (serverWidget, record, search, runtime, url, error, format) {
  // Configuration
  const CONFIG = {
    MAX_SUBLIST_LINES: 1000, // Limit sublist lines for performance
    CACHE_DURATION: 300, // Cache duration in seconds (5 minutes)
    ENABLE_PERFORMANCE_TRACKING: true,
  };

  /**
   * Performance tracker
   */
  class PerformanceTracker {
    constructor(enabled) {
      this.enabled = enabled;
      this.startTime = enabled ? Date.now() : null;
      this.marks = {};
    }

    mark(name) {
      if (this.enabled) {
        this.marks[name] = Date.now() - this.startTime;
      }
    }

    getReport() {
      if (!this.enabled) return null;
      return {
        totalTime: Date.now() - this.startTime,
        marks: this.marks,
      };
    }
  }

  /**
   * Enhanced function to get complete record data with performance tracking
   */
  function getFullRecordData(recordType, recordId, options) {
    const perf = new PerformanceTracker(CONFIG.ENABLE_PERFORMANCE_TRACKING);
    options = options || {};

    try {
      // Validate parameters
      if (!recordType || !recordId) {
        throw new Error("Record type and ID are required");
      }

      // Load record
      perf.mark("load_start");
      const recordObj = record.load({
        type: recordType,
        id: recordId,
        isDynamic: false,
      });
      perf.mark("load_end");

      const recordData = {
        type: recordType,
        id: recordId,
        isDynamic: false,
        metadata: {
          loadedAt: new Date().toISOString(),
          loadedBy: runtime.getCurrentUser().id,
        },
        fields: {},
        sublists: {},
      };

      // Get all body fields
      perf.mark("fields_start");
      const bodyFields = recordObj.getFields();

      for (let i = 0; i < bodyFields.length; i++) {
        const fieldId = bodyFields[i];

        // Skip if field filtering is enabled
        if (options.includeFields && !options.includeFields.includes(fieldId)) {
          continue;
        }

        try {
          const fieldValue = recordObj.getValue({ fieldId: fieldId });
          const fieldText = recordObj.getText({ fieldId: fieldId });

          let fieldObj = null;
          let fieldLabel = fieldId;
          let fieldType = "";
          let isMandatory = false;
          let isDisplay = false;

          try {
            fieldObj = recordObj.getField({ fieldId: fieldId });
            if (fieldObj) {
              fieldLabel = fieldObj.label || fieldId;
              fieldType = fieldObj.type || "";
              isMandatory = fieldObj.isMandatory || false;
              isDisplay = fieldObj.isDisplay || false;
            }
          } catch (labelErr) {
            // Field metadata not available
          }

          recordData.fields[fieldId] = {
            label: fieldLabel,
            type: fieldType,
            value: fieldValue,
            text: fieldText !== fieldValue ? fieldText : undefined,
            isMandatory: isMandatory,
            isDisplay: isDisplay,
          };
        } catch (e) {
          recordData.fields[fieldId] = {
            label: fieldId,
            error: e.message,
          };
        }
      }
      perf.mark("fields_end");

      // Get all sublists
      perf.mark("sublists_start");
      const sublists = recordObj.getSublists();

      for (let i = 0; i < sublists.length; i++) {
        const sublistId = sublists[i];

        // Skip if sublist filtering is enabled
        if (
          options.includeSublists &&
          !options.includeSublists.includes(sublistId)
        ) {
          continue;
        }

        recordData.sublists[sublistId] = {
          lines: [],
          metadata: {},
        };

        const lineCount = recordObj.getLineCount({ sublistId: sublistId });
        recordData.sublists[sublistId].metadata.lineCount = lineCount;

        // Limit lines for performance
        const maxLines = Math.min(lineCount, CONFIG.MAX_SUBLIST_LINES);
        if (lineCount > CONFIG.MAX_SUBLIST_LINES) {
          recordData.sublists[sublistId].metadata.truncated = true;
          recordData.sublists[sublistId].metadata.displayedLines = maxLines;
        }

        for (let line = 0; line < maxLines; line++) {
          const lineData = { _lineNumber: line + 1 };
          const columns = recordObj.getSublistFields({ sublistId: sublistId });

          for (let c = 0; c < columns.length; c++) {
            const columnId = columns[c];

            try {
              const columnValue = recordObj.getSublistValue({
                sublistId: sublistId,
                fieldId: columnId,
                line: line,
              });

              const columnText = recordObj.getSublistText({
                sublistId: sublistId,
                fieldId: columnId,
                line: line,
              });

              let columnLabel = columnId;
              try {
                const columnObj = recordObj.getSublistField({
                  sublistId: sublistId,
                  fieldId: columnId,
                  line: line,
                });
                columnLabel = columnObj.label || columnId;
              } catch (labelErr) {
                // Label not available
              }

              lineData[columnId] = {
                label: columnLabel,
                value: columnValue,
                text: columnText !== columnValue ? columnText : undefined,
              };
            } catch (e) {
              lineData[columnId] = {
                label: columnId,
                error: e.message,
              };
            }
          }

          recordData.sublists[sublistId].lines.push(lineData);
        }
      }
      perf.mark("sublists_end");

      return {
        success: true,
        data: recordData,
        performance: perf.getReport(),
      };
    } catch (e) {
      return {
        success: false,
        error: {
          code: e.name || "ERROR",
          message: e.message || "Unknown error",
          details: e.stack
            ? typeof e.stack === "string"
              ? e.stack.split("\n")
              : e.stack
            : [String(e)],
        },
        performance: perf.getReport(),
      };
    }
  }

  /**
   * Compare two records and return differences
   */
  function compareRecords(recordType, recordId1, recordId2) {
    try {
      const record1 = getFullRecordData(recordType, recordId1);
      const record2 = getFullRecordData(recordType, recordId2);

      if (!record1.success || !record2.success) {
        return {
          success: false,
          error: "Failed to load one or both records",
        };
      }

      const differences = {
        fields: {},
        sublists: {},
      };

      // Compare fields
      const allFieldIds = new Set([
        ...Object.keys(record1.data.fields),
        ...Object.keys(record2.data.fields),
      ]);

      allFieldIds.forEach((fieldId) => {
        const field1 = record1.data.fields[fieldId];
        const field2 = record2.data.fields[fieldId];

        if (!field1 || !field2 || field1.value !== field2.value) {
          differences.fields[fieldId] = {
            label:
              (field1 && field1.label) || (field2 && field2.label) || fieldId,
            record1: field1 || { value: null },
            record2: field2 || { value: null },
            isDifferent: true,
          };
        }
      });

      // Compare sublists (simplified - comparing line counts)
      const allSublistIds = new Set([
        ...Object.keys(record1.data.sublists),
        ...Object.keys(record2.data.sublists),
      ]);

      allSublistIds.forEach((sublistId) => {
        const sublist1 = record1.data.sublists[sublistId];
        const sublist2 = record2.data.sublists[sublistId];

        const lineCount1 = sublist1 ? sublist1.lines.length : 0;
        const lineCount2 = sublist2 ? sublist2.lines.length : 0;

        if (lineCount1 !== lineCount2) {
          differences.sublists[sublistId] = {
            record1LineCount: lineCount1,
            record2LineCount: lineCount2,
            isDifferent: true,
          };
        }
      });

      return {
        success: true,
        differences: differences,
        record1: record1.data,
        record2: record2.data,
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
      };
    }
  }

  /**
   * Create enhanced HTML page with advanced features
   */
  function createHtmlPage(params) {
    const { recordType, recordId, result, scriptUrl, compareId, darkMode } =
      params;

    // Create bookmarklet code
    const bookmarkletCode =
      "javascript:(function(){var recordType='';var recordId='';try{recordType=nlapiGetRecordType();}catch(e){}try{recordId=nlapiGetRecordId();}catch(e){}if(!recordType||!recordId){try{recordType=currentRecord.type;}catch(e){}try{recordId=currentRecord.id;}catch(e){}}if(!recordType||!recordId){var url=window.location.href;var recTypeMatch=url.match(/\\/(\\w+)\\.sl\\?/i)||url.match(/record\\/(\\w+)\\//i);var recIdMatch=url.match(/id=(\\d+)/i)||url.match(/record\\/\\w+\\/(\\d+)/i);if(recTypeMatch)recordType=recTypeMatch[1];if(recIdMatch)recordId=recIdMatch[1];}if(recordType&&recordId){window.open('" +
      scriptUrl.replace(/'/g, "\\'") +
      "?recordtype='+recordType+'&recordid='+recordId,'_blank');}else{alert('Unable to get record information.');}})();";

    // Convert result to safe JSON string for embedding
    var jsonDataStr = "";
    var resultSuccess = false;

    try {
      jsonDataStr = JSON.stringify(
        result.success ? result.data : result.error,
        null,
        2
      );
      resultSuccess = result.success;
    } catch (e) {
      jsonDataStr = '{"error": "Failed to serialize data"}';
      resultSuccess = false;
    }

    const darkModeClass = darkMode === "true" ? "dark-mode" : "";

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NetSuite Record Viewer${
      recordType && recordId ? " - " + recordType + " #" + recordId : ""
    }</title>
    <style>
        :root {
            --bg-primary: #f5f5f5;
            --bg-secondary: white;
            --bg-tertiary: #f8f8f8;
            --text-primary: #333;
            --text-secondary: #666;
            --border-color: #ddd;
            --accent-color: #0066cc;
            --accent-hover: #0052a3;
            --success-color: #28a745;
            --danger-color: #dc3545;
            --warning-color: #ffc107;
        }

        .dark-mode {
            --bg-primary: #1a1a1a;
            --bg-secondary: #2d2d2d;
            --bg-tertiary: #3a3a3a;
            --text-primary: #e0e0e0;
            --text-secondary: #b0b0b0;
            --border-color: #444;
            --accent-color: #4a9eff;
            --accent-hover: #357abd;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            margin: 0;
            padding: 20px;
            background-color: var(--bg-primary);
            transition: background-color 0.3s, color 0.3s;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        h1 {
            color: var(--accent-color);
            margin-bottom: 10px;
            font-size: 2em;
        }

        h2, h3 {
            color: var(--text-primary);
        }

        .version-badge {
            display: inline-block;
            background: var(--accent-color);
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            margin-left: 10px;
        }

        .card {
            background: var(--bg-secondary);
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 24px;
            margin-bottom: 24px;
            transition: background-color 0.3s;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid var(--border-color);
        }

        .form-row {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }

        .form-group {
            flex: 1;
            min-width: 200px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            font-size: 0.9em;
            color: var(--text-secondary);
        }

        input[type="text"], select {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            font-size: 14px;
            transition: border-color 0.3s;
        }

        input[type="text"]:focus, select:focus {
            outline: none;
            border-color: var(--accent-color);
        }

        button, .button {
            background-color: var(--accent-color);
            color: white;
            border: none;
            padding: 10px 18px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
            text-decoration: none;
            display: inline-block;
        }

        button:hover, .button:hover {
            background-color: var(--accent-hover);
        }

        button:disabled {
            background-color: var(--border-color);
            cursor: not-allowed;
        }

        .button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }

        .button-secondary {
            background-color: var(--text-secondary);
        }

        .button-success {
            background-color: var(--success-color);
        }

        .button-danger {
            background-color: var(--danger-color);
        }

        pre {
            background-color: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 20px;
            overflow: auto;
            max-height: 600px;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            line-height: 1.5;
        }

        .alert {
            padding: 15px 20px;
            border-radius: 6px;
            margin-bottom: 20px;
            border-left: 4px solid;
        }

        .alert-danger {
            background-color: rgba(220, 53, 69, 0.1);
            border-left-color: var(--danger-color);
            color: var(--danger-color);
        }

        .alert-success {
            background-color: rgba(40, 167, 69, 0.1);
            border-left-color: var(--success-color);
            color: var(--success-color);
        }

        .alert-warning {
            background-color: rgba(255, 193, 7, 0.1);
            border-left-color: var(--warning-color);
            color: var(--warning-color);
        }

        .tab-container {
            margin-bottom: 20px;
            border-bottom: 2px solid var(--border-color);
        }

        .tab {
            display: inline-block;
            padding: 12px 20px;
            background-color: transparent;
            border: none;
            cursor: pointer;
            margin-right: 5px;
            font-weight: 500;
            color: var(--text-secondary);
            transition: color 0.3s, border-bottom 0.3s;
            border-bottom: 3px solid transparent;
        }

        .tab:hover {
            color: var(--accent-color);
        }

        .tab.active {
            color: var(--accent-color);
            border-bottom-color: var(--accent-color);
        }

        .tab-content {
            display: none;
            animation: fadeIn 0.3s;
        }

        .tab-content.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }

        /* Body fields table styling */
        .body-fields-table {
            table-layout: fixed; /* Fixed layout for better control */
        }

        .body-fields-table th:nth-child(1),
        .body-fields-table td:nth-child(1) {
            width: 20%; /* Field ID column */
        }

        .body-fields-table th:nth-child(2),
        .body-fields-table td:nth-child(2) {
            width: 25%; /* Label column */
        }

        .body-fields-table th:nth-child(3),
        .body-fields-table td:nth-child(3) {
            width: 15%; /* Type column */
        }

        .body-fields-table th:nth-child(4),
        .body-fields-table td:nth-child(4) {
            width: 25%; /* Value column */
        }

        .body-fields-table th:nth-child(5),
        .body-fields-table td:nth-child(5) {
            width: 15%; /* Display Text column */
        }

        /* Value and text cells with proper text wrapping */
        .body-fields-table td:nth-child(4),
        .body-fields-table td:nth-child(5) {
            word-wrap: break-word;
            word-break: break-word;
            white-space: normal;
            max-width: 0; /* Force text wrapping */
        }

        /* Sublist table container with horizontal scroll */
        .sublist-container {
            overflow-x: auto;
            max-width: 100%;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            margin-top: 15px;
        }

        .sublist-table {
            min-width: 800px; /* Minimum width to ensure readability */
            width: max-content; /* Allow table to expand as needed */
        }

        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid var(--border-color);
            white-space: nowrap; /* Prevent text wrapping in cells */
        }

        th {
            background-color: var(--bg-tertiary);
            font-weight: 600;
            color: var(--text-primary);
            position: sticky;
            top: 0;
            z-index: 10;
        }

        /* Make first column (line number) sticky */
        .sublist-table th:first-child,
        .sublist-table td:first-child {
            position: sticky;
            left: 0;
            background-color: var(--bg-tertiary);
            z-index: 5;
            border-right: 2px solid var(--border-color);
        }

        tr:hover {
            background-color: var(--bg-tertiary);
        }

        /* Scrollbar styling for better UX */
        .sublist-container::-webkit-scrollbar {
            height: 8px;
        }

        .sublist-container::-webkit-scrollbar-track {
            background: var(--bg-tertiary);
            border-radius: 4px;
        }

        .sublist-container::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 4px;
        }

        .sublist-container::-webkit-scrollbar-thumb:hover {
            background: var(--text-secondary);
        }

        /* Long text styling */
        .long-text-container {
            position: relative;
        }

        .long-text-preview {
            transition: color 0.2s;
        }

        .long-text-preview:hover {
            color: var(--accent-hover) !important;
        }

        .long-text-full {
            border: 1px solid var(--border-color);
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9em;
        }

        /* Responsive adjustments for body fields */
        @media (max-width: 768px) {
            .body-fields-table {
                font-size: 0.85em;
            }
            
            .body-fields-table th,
            .body-fields-table td {
                padding: 8px 6px;
            }
        }

        .field-type-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75em;
            font-weight: 600;
            background: var(--border-color);
            color: var(--text-primary);
        }

        .mandatory-badge {
            background: var(--danger-color);
            color: white;
        }

        .search-box {
            position: relative;
            margin-bottom: 15px;
        }

        .search-box input {
            padding-left: 40px;
        }

        .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-secondary);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: var(--bg-tertiary);
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid var(--accent-color);
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: var(--accent-color);
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 0.9em;
        }

        .bookmarklet {
            display: inline-block;
            background-color: var(--accent-color);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .bookmarklet:hover {
            background-color: var(--accent-hover);
        }

        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 50px;
            height: 24px;
        }

        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--border-color);
            transition: 0.4s;
            border-radius: 24px;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: 0.4s;
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: var(--accent-color);
        }

        input:checked + .slider:before {
            transform: translateX(26px);
        }

        .performance-info {
            font-size: 0.85em;
            color: var(--text-secondary);
            padding: 10px;
            background: var(--bg-tertiary);
            border-radius: 4px;
            margin-top: 10px;
        }

        @media (max-width: 768px) {
            .form-row {
                flex-direction: column;
            }
            
            .button-group {
                flex-direction: column;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body class="${darkModeClass}">
    <div class="container">
        <div class="card-header" style="background: transparent; border: none; padding-bottom: 0;">
            <h1>
                NetSuite Record Viewer
                <span class="version-badge">v2.0</span>
            </h1>
            <div style="display: flex; align-items: center; gap: 15px;">
                <label style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.9em;">🌙 Dark Mode</span>
                    <label class="toggle-switch">
                        <input type="checkbox" id="darkModeToggle" ${
                          darkMode === "true" ? "checked" : ""
                        }>
                        <span class="slider"></span>
                    </label>
                </label>
            </div>
        </div>
        
        <div class="card">
            <h3>🔍 Record Lookup</h3>
            <div class="form-row">
                <div class="form-group">
                    <label for="recordtype">Record Type</label>
                    <input type="text" id="recordtype" name="recordtype" value="${
                      recordType || ""
                    }" placeholder="e.g., salesorder, customer, transaction">
                </div>
                <div class="form-group">
                    <label for="recordid">Record ID</label>
                    <input type="text" id="recordid" name="recordid" value="${
                      recordId || ""
                    }" placeholder="e.g., 12345">
                </div>
                <div class="form-group" style="flex: 0 0 auto; align-self: flex-end;">
                    <button id="viewRecordBtn">View Record</button>
                </div>
            </div>
        </div>

        ${
          recordType && recordId
            ? `
        ${
          result.success && result.performance
            ? `
        <div class="card">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${
                      Object.keys(result.data.fields).length
                    }</div>
                    <div class="stat-label">Body Fields</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${
                      Object.keys(result.data.sublists).length
                    }</div>
                    <div class="stat-label">Sublists</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${
                      result.performance.totalTime
                    }ms</div>
                    <div class="stat-label">Load Time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${recordType}</div>
                    <div class="stat-label">Record Type</div>
                </div>
            </div>
        </div>
        `
            : ""
        }
        
        <div class="card">
            <div class="button-group">
                <button id="copyJson" class="button">📋 Copy JSON</button>
                <button id="downloadJson" class="button">💾 Download JSON</button>
                <button id="downloadCsv" class="button-secondary">📊 Export CSV</button>
                <button id="openRawJson" class="button">🔗 Raw JSON</button>
            </div>
            
            <div class="tab-container">
                <button class="tab active" data-tab="field-view">📋 Field Browser</button>
                <button class="tab" data-tab="raw-json">💻 Raw JSON</button>
                <button class="tab" data-tab="compare-view">⚖️ Compare Records</button>
            </div>
            
            ${
              !result.success
                ? `
            <div class="alert alert-danger">
                <strong>❌ Error:</strong> ${result.error.message}
            </div>
            `
                : ""
            }
            
            <div id="field-view" class="tab-content active">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="fieldSearch" placeholder="Search fields...">
                </div>
                <div id="fieldBrowser">Loading...</div>
            </div>
            
            <div id="raw-json" class="tab-content">
                <pre id="jsonData">${jsonDataStr}</pre>
            </div>

            <div id="compare-view" class="tab-content">
                <div class="alert alert-warning">
                    <strong>ℹ️ Compare Feature:</strong> Enter another record ID of the same type to compare
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="compareId">Compare with Record ID</label>
                        <input type="text" id="compareId" placeholder="Enter record ID to compare">
                    </div>
                    <div class="form-group" style="flex: 0 0 auto; align-self: flex-end;">
                        <button id="compareBtn">Compare</button>
                    </div>
                </div>
                <div id="compareResults"></div>
            </div>

            ${
              result.performance
                ? `
            <div class="performance-info">
                ⚡ Performance: Load ${
                  result.performance.marks.load_end
                }ms | Fields ${
                    result.performance.marks.fields_end -
                    result.performance.marks.fields_start
                  }ms | Sublists ${
                    result.performance.marks.sublists_end -
                    result.performance.marks.sublists_start
                  }ms
            </div>
            `
                : ""
            }
        </div>
        `
            : ""
        }
        
        <div class="card">
            <h3>🔖 Bookmarklet</h3>
            <p>Drag this link to your bookmarks bar to quickly view any NetSuite record:</p>
            <a href="" id="bookmarkletLink" class="bookmarklet">📊 NetSuite Record Viewer</a>
            <p style="margin-top: 15px; color: var(--text-secondary); font-size: 0.9em;">
                Click the bookmarklet while viewing any NetSuite record to instantly open this viewer.
            </p>
        </div>
    </div>
    
    <script>
    (function() {
        'use strict';
        
        // Safe script URL and data
        var SCRIPT_URL = ${JSON.stringify(scriptUrl)};
        var RECORD_TYPE = ${JSON.stringify(recordType || "")};
        var RECORD_ID = ${JSON.stringify(recordId || "")};
        var HAS_RESULT = ${resultSuccess};
        var JSON_DATA_STRING = ${JSON.stringify(jsonDataStr)};
        var BOOKMARKLET_CODE = ${JSON.stringify(bookmarkletCode)};
        
        // Set bookmarklet href
        var bookmarkletLink = document.getElementById('bookmarkletLink');
        if (bookmarkletLink) {
            bookmarkletLink.href = BOOKMARKLET_CODE;
        }
        // View Record button handler
        var viewRecordBtn = document.getElementById('viewRecordBtn');
        if (viewRecordBtn) {
            viewRecordBtn.addEventListener('click', function() {
                var recordType = document.getElementById('recordtype').value;
                var recordId = document.getElementById('recordid').value;
                
                if (recordType) recordType = recordType.trim();
                if (recordId) recordId = recordId.trim();
                
                if (!recordType || !recordId) {
                    showNotification('⚠️ Please enter both Record Type and Record ID', 'warning');
                    return;
                }
                
                var darkModeEnabled = document.body.classList.contains('dark-mode');
                var url = SCRIPT_URL + '&recordtype=' + encodeURIComponent(recordType) + 
                           '&recordid=' + encodeURIComponent(recordId) +
                           '&darkMode=' + (darkModeEnabled ? 'true' : 'false');
                
                window.location.href = url;
            });
            
            // Allow Enter key to trigger view
            var recordTypeInput = document.getElementById('recordtype');
            var recordIdInput = document.getElementById('recordid');
            
            if (recordTypeInput) {
                recordTypeInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' || e.keyCode === 13) {
                        viewRecordBtn.click();
                    }
                });
            }
            
            if (recordIdInput) {
                recordIdInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' || e.keyCode === 13) {
                        viewRecordBtn.click();
                    }
                });
            }
        }
        
        // Dark mode toggle
        var darkModeToggle = document.getElementById('darkModeToggle');
        
        if (darkModeToggle) {
            darkModeToggle.addEventListener('change', function() {
                document.body.classList.toggle('dark-mode');
                try {
                    localStorage.setItem('nsRecordViewerDarkMode', this.checked);
                } catch (e) {
                    // localStorage not available
                }
            });
        }

        // Tab switching
        var tabs = document.querySelectorAll('.tab');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                tabs.forEach(function(t) {
                    t.classList.remove('active');
                });
                
                var tabContents = document.querySelectorAll('.tab-content');
                tabContents.forEach(function(content) {
                    content.classList.remove('active');
                });
                
                this.classList.add('active');
                var tabId = this.getAttribute('data-tab');
                var targetContent = document.getElementById(tabId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                if (tabId === 'field-view' && !window.fieldBrowserInitialized) {
                    initializeFieldBrowser();
                }
            });
        });

        // Copy JSON button
        var copyButton = document.getElementById('copyJson');
        if (copyButton) {
            copyButton.addEventListener('click', function() {
                var jsonData = JSON_DATA_STRING;
                
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(jsonData).then(function() {
                        showNotification('✅ JSON copied to clipboard!', 'success');
                    }, function(err) {
                        fallbackCopy(jsonData);
                    });
                } else {
                    fallbackCopy(jsonData);
                }
            });
        }
        
        function fallbackCopy(text) {
            var textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showNotification('✅ JSON copied to clipboard!', 'success');
            } catch (err) {
                showNotification('❌ Failed to copy to clipboard', 'danger');
            }
            document.body.removeChild(textArea);
        }

        // Open Raw JSON button
        var openRawJsonBtn = document.getElementById('openRawJson');
        if (openRawJsonBtn) {
            openRawJsonBtn.addEventListener('click', function() {
                var url = SCRIPT_URL + '&recordtype=' + encodeURIComponent(RECORD_TYPE) + 
                         '&recordid=' + encodeURIComponent(RECORD_ID) + '&format=json';
                window.open(url, '_blank');
            });
        }

        // Download JSON button
        var downloadJsonBtn = document.getElementById('downloadJson');
        if (downloadJsonBtn) {
            downloadJsonBtn.addEventListener('click', function() {
                var jsonData = JSON_DATA_STRING;
                var blob = new Blob([jsonData], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = RECORD_TYPE + '_' + RECORD_ID + '_' + new Date().toISOString().split('T')[0] + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification('✅ JSON downloaded!', 'success');
            });
        }

        // Download CSV button
        var downloadCsvBtn = document.getElementById('downloadCsv');
        if (downloadCsvBtn) {
            downloadCsvBtn.addEventListener('click', function() {
                if (!HAS_RESULT) {
                    showNotification('❌ No data to export', 'danger');
                    return;
                }
                
                try {
                    var data = JSON.parse(JSON_DATA_STRING);
                    var csv = 'Field ID,Field Label,Field Type,Value,Display Text\\n';
                    
                    for (var fieldId in data.fields) {
                        var field = data.fields[fieldId];
                        var value = (field.value || '').toString().replace(/"/g, '""');
                        var text = (field.text || '').toString().replace(/"/g, '""');
                        var label = (field.label || '').toString().replace(/"/g, '""');
                        var type = (field.type || '').toString().replace(/"/g, '""');
                        csv += '"' + fieldId.replace(/"/g, '""') + '","' + label.replace(/"/g, '""') + '","' + type.replace(/"/g, '""') + '","' + value.replace(/"/g, '""') + '","' + text.replace(/"/g, '""') + '"\\n';
                    }
                    
                    var blob = new Blob([csv], { type: 'text/csv' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = RECORD_TYPE + '_' + RECORD_ID + '_fields_' + new Date().toISOString().split('T')[0] + '.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showNotification('✅ CSV exported!', 'success');
                } catch (e) {
                    showNotification('❌ Error exporting CSV: ' + e.message, 'danger');
                }
            });
        }

        // Field search functionality
        var fieldSearch = document.getElementById('fieldSearch');
        if (fieldSearch) {
            fieldSearch.addEventListener('input', function() {
                var searchTerm = this.value.toLowerCase();
                var fieldBrowser = document.getElementById('fieldBrowser');
                if (!fieldBrowser) return;
                
                var rows = fieldBrowser.querySelectorAll('table tbody tr');
                
                rows.forEach(function(row) {
                    var text = row.textContent.toLowerCase();
                    if (text.indexOf(searchTerm) !== -1) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        }

        // Compare button
        var compareBtn = document.getElementById('compareBtn');
        if (compareBtn) {
            compareBtn.addEventListener('click', function() {
                var compareId = document.getElementById('compareId').value;
                
                if (compareId) compareId = compareId.trim();
                
                if (!compareId) {
                    showNotification('⚠️ Please enter a record ID to compare', 'warning');
                    return;
                }
                
                var darkModeEnabled = document.body.classList.contains('dark-mode');
                var url = SCRIPT_URL + '&recordtype=' + encodeURIComponent(RECORD_TYPE) + 
                         '&recordid=' + encodeURIComponent(RECORD_ID) + 
                         '&compareid=' + encodeURIComponent(compareId) + 
                         '&darkMode=' + (darkModeEnabled ? 'true' : 'false');
                
                window.location.href = url;
            });
            
            // Allow Enter key to trigger compare
            var compareInput = document.getElementById('compareId');
            if (compareInput) {
                compareInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' || e.keyCode === 13) {
                        compareBtn.click();
                    }
                });
            }
        }

        // Initialize field browser
        window.fieldBrowserInitialized = false;
        
        function initializeFieldBrowser() {
            if (window.fieldBrowserInitialized) return;
            window.fieldBrowserInitialized = true;
            
            var fieldBrowser = document.getElementById('fieldBrowser');
            if (!fieldBrowser) return;
            
            if (!HAS_RESULT) {
                fieldBrowser.innerHTML = '<div class="alert alert-danger">❌ Unable to load record data</div>';
                return;
            }
            
            try {
                var data = JSON.parse(JSON_DATA_STRING);
                var html = '<div>';
                
                // Body fields
                html += '<h3>📝 Body Fields</h3>';
                html += '<table class="body-fields-table"><thead><tr>';
                html += '<th>Field ID</th>';
                html += '<th>Label</th>';
                html += '<th>Type</th>';
                html += '<th>Value</th>';
                html += '<th>Display Text</th>';
                html += '</tr></thead><tbody>';
                
                var sortedFields = Object.keys(data.fields).sort();
                
                for (var i = 0; i < sortedFields.length; i++) {
                    var fieldId = sortedFields[i];
                    var field = data.fields[fieldId];
                    html += '<tr>';
                    html += '<td><code>' + String(fieldId).replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '</code></td>';
                    html += '<td><strong>' + String(field.label || fieldId).replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '</strong>';
                    if (field.isMandatory) {
                        html += ' <span class="field-type-badge mandatory-badge">Required</span>';
                    }
                    html += '</td>';
                    html += '<td><span class="field-type-badge">' + (field.type || 'unknown') + '</span></td>';
                    html += '<td>' + formatValue(field.value) + '</td>';
                    html += '<td>' + (field.text ? String(field.text).replace(/'/g, '&#39;').replace(/"/g, '&quot;') : '-') + '</td>';
                    html += '</tr>';
                }
                
                html += '</tbody></table>';
                
                // Sublists
                for (var sublistId in data.sublists) {
                    var sublistData = data.sublists[sublistId];
                    var sublistLines = sublistData.lines || [];
                    
                    if (sublistLines.length > 0) {
                        html += '<h3 style="margin-top: 30px;">📋 Sublist: ' + String(sublistId).replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '</h3>';
                        
                        if (sublistData.metadata && sublistData.metadata.truncated) {
                            html += '<div class="alert alert-warning">';
                            html += '⚠️ Showing ' + sublistData.metadata.displayedLines + ' of ' + sublistData.metadata.lineCount + ' lines (truncated for performance)';
                            html += '</div>';
                        }
                        
                        var columnIds = [];
                        for (var colId in sublistLines[0]) {
                            if (colId !== '_lineNumber') {
                                columnIds.push(colId);
                            }
                        }
                        
                        html += '<div class="sublist-container">';
                        html += '<table class="sublist-table"><thead><tr>';
                        html += '<th>#</th>';
                        
                        for (var c = 0; c < columnIds.length; c++) {
                            var columnId = columnIds[c];
                            var columnLabel = sublistLines[0][columnId].label || columnId;
                            html += '<th>' + String(columnLabel).replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '<br><small><code>' + String(columnId).replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '</code></small></th>';
                        }
                        
                        html += '</tr></thead><tbody>';
                        
                        for (var line = 0; line < sublistLines.length; line++) {
                            var lineData = sublistLines[line];
                            html += '<tr>';
                            html += '<td>' + lineData._lineNumber + '</td>';
                            
                            for (var c = 0; c < columnIds.length; c++) {
                                var columnId = columnIds[c];
                                var column = lineData[columnId];
                                html += '<td>';
                                html += formatValue(column.value);
                                if (column.text && column.text !== column.value) {
                                    html += '<br><small style="color: var(--text-secondary);">' + String(column.text).replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '</small>';
                                }
                                html += '</td>';
                            }
                            
                            html += '</tr>';
                        }
                        
                        html += '</tbody></table>';
                        html += '</div>';
                    }
                }
                
                html += '</div>';
                fieldBrowser.innerHTML = html;
            } catch (e) {
                fieldBrowser.innerHTML = '<div class="alert alert-danger">❌ Error parsing record data: ' + e.message + '</div>';
            }
        }
        
        // Format value helper
        function formatValue(value, isLongText) {
            if (value === null || value === undefined) {
                return '<span style="color: var(--text-secondary); font-style: italic;">null</span>';
            } else if (value === '') {
                return '<span style="color: var(--text-secondary); font-style: italic;">(empty)</span>';
            } else if (typeof value === 'boolean') {
                return value ? 
                    '<span style="color: var(--success-color); font-weight: bold;">✓ true</span>' : 
                    '<span style="color: var(--danger-color); font-weight: bold;">✗ false</span>';
            } else if (typeof value === 'number') {
                return '<span style="color: var(--accent-color);">' + value + '</span>';
            } else {
                var strValue = String(value);
                
                // For long text, show truncated version with expand option
                if (strValue.length > 100) {
                    var truncated = strValue.substring(0, 100);
                    var uniqueId = 'longtext_' + Math.random().toString(36).substr(2, 9);
                    
                    // Escape quotes in the text to prevent JavaScript syntax errors
                    var escapedTruncated = truncated.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
                    var escapedFullValue = strValue.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
                    
                    return '<div class="long-text-container">' +
                           '<div class="long-text-preview" data-toggle-id="' + uniqueId + '" style="cursor: pointer; color: var(--accent-color);">' +
                           escapedTruncated + '... <small>(click to expand)</small>' +
                           '</div>' +
                           '<div id="' + uniqueId + '" class="long-text-full" style="display: none; word-break: break-word; white-space: pre-wrap; background: var(--bg-tertiary); padding: 8px; border-radius: 4px; margin-top: 4px;">' +
                           escapedFullValue +
                           '</div>' +
                           '</div>';
                } else {
                    // Escape quotes in short text as well
                    return strValue.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
                }
            }
        }

        // Toggle long text visibility using event delegation
        document.addEventListener('click', function(e) {
            if (e.target && e.target.classList.contains('long-text-preview')) {
                var toggleId = e.target.getAttribute('data-toggle-id');
                if (toggleId) {
                    var element = document.getElementById(toggleId);
                    if (element) {
                        element.style.display = element.style.display === 'none' ? 'block' : 'none';
                    }
                }
            }
        });

        // Notification helper
        function showNotification(message, type) {
            var notification = document.createElement('div');
            notification.className = 'alert alert-' + type;
            notification.textContent = message;
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.right = '20px';
            notification.style.zIndex = '10000';
            notification.style.minWidth = '300px';
            notification.style.animation = 'slideIn 0.3s ease-out';
            
            document.body.appendChild(notification);
            
            setTimeout(function() {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(function() {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }

        // Initialize on load
        if (HAS_RESULT) {
            initializeFieldBrowser();
        }

        // Add animation styles
        var style = document.createElement('style');
        style.textContent = 
            '@keyframes slideIn {' +
            '  from { transform: translateX(400px); opacity: 0; }' +
            '  to { transform: translateX(0); opacity: 1; }' +
            '}' +
            '@keyframes slideOut {' +
            '  from { transform: translateX(0); opacity: 1; }' +
            '  to { transform: translateX(400px); opacity: 0; }' +
            '}';
        document.head.appendChild(style);
    })();
    </script>
</body>
</html>`;

    return html;
  }

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
          const result = getFullRecordData(recordType, recordId);
          context.response.setHeader({
            name: "Content-Type",
            value: "application/json; charset=utf-8",
          });
          context.response.write(JSON.stringify(result, null, 2));
          return;
        }

        // Compare mode
        if (recordType && recordId && compareId) {
          const compareResult = compareRecords(recordType, recordId, compareId);
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
          result = getFullRecordData(recordType, recordId);
        } else {
          result = { success: true, data: {} };
        }

        const html = createHtmlPage({
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
