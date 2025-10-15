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

    const bookmarkletCode = `javascript:(function(){var recordType='';var recordId='';try{recordType=nlapiGetRecordType();}catch(e){}try{recordId=nlapiGetRecordId();}catch(e){}if(!recordType||!recordId){try{recordType=currentRecord.type;}catch(e){}try{recordId=currentRecord.id;}catch(e){}}if(!recordType||!recordId){var url=window.location.href;var recTypeMatch=url.match(/\\/(\\w+)\\.sl\\?/i)||url.match(/record\\/(\\w+)\\//i);var recIdMatch=url.match(/id=(\\d+)/i)||url.match(/record\\/\\w+\\/(\\d+)/i);if(recTypeMatch)recordType=recTypeMatch[1];if(recIdMatch)recordId=recIdMatch[1];}if(recordType&&recordId){window.open('${scriptUrl}?recordtype='+recordType+'&recordid='+recordId,'_blank');}else{alert('Unable to get record information.');}})();`;

    const jsonDataStr = JSON.stringify(
      result.success ? result.data : result.error,
      null,
      2
    );

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

        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid var(--border-color);
        }

        th {
            background-color: var(--bg-tertiary);
            font-weight: 600;
            color: var(--text-primary);
            position: sticky;
            top: 0;
        }

        tr:hover {
            background-color: var(--bg-tertiary);
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
            <form action="${scriptUrl}" method="GET" id="mainForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="recordtype">Record Type</label>
                        <input type="text" id="recordtype" name="recordtype" value="${
                          recordType || ""
                        }" required placeholder="e.g., salesorder, customer, transaction">
                    </div>
                    <div class="form-group">
                        <label for="recordid">Record ID</label>
                        <input type="text" id="recordid" name="recordid" value="${
                          recordId || ""
                        }" required placeholder="e.g., 12345">
                    </div>
                    <div class="form-group" style="flex: 0 0 auto; align-self: flex-end;">
                        <button type="submit">View Record</button>
                    </div>
                </div>
                <input type="hidden" name="darkMode" id="darkModeInput" value="${
                  darkMode || "false"
                }">
            </form>
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
                <a href="${scriptUrl}?recordtype=${recordType}&recordid=${recordId}&format=json" target="_blank" class="button">
                    🔗 Raw JSON
                </a>
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
            <a href="${bookmarkletCode}" class="bookmarklet">📊 NetSuite Record Viewer</a>
            <p style="margin-top: 15px; color: var(--text-secondary); font-size: 0.9em;">
                Click the bookmarklet while viewing any NetSuite record to instantly open this viewer.
            </p>
        </div>
    </div>
    
    <script>
    (function() {
        // Dark mode toggle
        const darkModeToggle = document.getElementById('darkModeToggle');
        const darkModeInput = document.getElementById('darkModeInput');
        
        if (darkModeToggle) {
            darkModeToggle.addEventListener('change', function() {
                document.body.classList.toggle('dark-mode');
                darkModeInput.value = this.checked ? 'true' : 'false';
                localStorage.setItem('nsRecordViewerDarkMode', this.checked);
            });
        }

        // Tab switching
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                this.classList.add('active');
                const tabId = this.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
                
                if (tabId === 'field-view' && !window.fieldBrowserInitialized) {
                    initializeFieldBrowser();
                }
            });
        });

        // Copy JSON button
        const copyButton = document.getElementById('copyJson');
        if (copyButton) {
            copyButton.addEventListener('click', function() {
                const jsonData = ${JSON.stringify(jsonDataStr)};
                navigator.clipboard.writeText(jsonData).then(function() {
                    showNotification('✅ JSON copied to clipboard!', 'success');
                }, function() {
                    showNotification('❌ Failed to copy to clipboard', 'danger');
                });
            });
        }

        // Download JSON button
        const downloadJsonBtn = document.getElementById('downloadJson');
        if (downloadJsonBtn) {
            downloadJsonBtn.addEventListener('click', function() {
                const jsonData = ${JSON.stringify(jsonDataStr)};
                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '${recordType}_${recordId}_' + new Date().toISOString().split('T')[0] + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification('✅ JSON downloaded!', 'success');
            });
        }

        // Download CSV button
        const downloadCsvBtn = document.getElementById('downloadCsv');
        if (downloadCsvBtn) {
            downloadCsvBtn.addEventListener('click', function() {
                ${
                  result.success
                    ? `
                const data = ${JSON.stringify(result.data)};
                let csv = 'Field ID,Field Label,Field Type,Value,Display Text\\n';
                
                for (const fieldId in data.fields) {
                    const field = data.fields[fieldId];
                    const value = (field.value || '').toString().replace(/"/g, '""');
                    const text = (field.text || '').toString().replace(/"/g, '""');
                    const label = (field.label || '').toString().replace(/"/g, '""');
                    const type = (field.type || '').toString().replace(/"/g, '""');
                    csv += '"' + fieldId + '","' + label + '","' + type + '","' + value + '","' + text + '"\\n';
                }
                
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '${recordType}_${recordId}_fields_' + new Date().toISOString().split('T')[0] + '.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification('✅ CSV exported!', 'success');
                `
                    : `
                showNotification('❌ No data to export', 'danger');
                `
                }
            });
        }

        // Field search functionality
        const fieldSearch = document.getElementById('fieldSearch');
        if (fieldSearch) {
            fieldSearch.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const rows = document.querySelectorAll('#fieldBrowser table tbody tr');
                
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    if (text.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        }

        // Compare button
        const compareBtn = document.getElementById('compareBtn');
        if (compareBtn) {
            compareBtn.addEventListener('click', function() {
                const compareId = document.getElementById('compareId').value;
                if (compareId) {
                    window.location.href = '${scriptUrl}?recordtype=${recordType}&recordid=${recordId}&compareid=' + compareId + '&darkMode=${
      darkMode || "false"
    }';
                } else {
                    showNotification('⚠️ Please enter a record ID to compare', 'warning');
                }
            });
        }

        // Initialize field browser
        window.fieldBrowserInitialized = false;
        
        function initializeFieldBrowser() {
            if (window.fieldBrowserInitialized) return;
            window.fieldBrowserInitialized = true;
            
            const fieldBrowser = document.getElementById('fieldBrowser');
            ${
              result.success
                ? `
            try {
                const data = ${JSON.stringify(result.data)};
                let html = '<div>';
                
                // Body fields
                html += '<h3>📝 Body Fields</h3>';
                html += '<table><thead><tr>';
                html += '<th>Field ID</th>';
                html += '<th>Label</th>';
                html += '<th>Type</th>';
                html += '<th>Value</th>';
                html += '<th>Display Text</th>';
                html += '</tr></thead><tbody>';
                
                const sortedFields = Object.keys(data.fields).sort();
                
                sortedFields.forEach(fieldId => {
                    const field = data.fields[fieldId];
                    html += '<tr>';
                    html += '<td><code>' + fieldId + '</code></td>';
                    html += '<td><strong>' + (field.label || fieldId) + '</strong>';
                    if (field.isMandatory) {
                        html += ' <span class="field-type-badge mandatory-badge">Required</span>';
                    }
                    html += '</td>';
                    html += '<td><span class="field-type-badge">' + (field.type || 'unknown') + '</span></td>';
                    html += '<td>' + formatValue(field.value) + '</td>';
                    html += '<td>' + (field.text ? field.text : '-') + '</td>';
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
                
                // Sublists
                for (const sublistId in data.sublists) {
                    const sublistData = data.sublists[sublistId];
                    const sublistLines = sublistData.lines || [];
                    
                    if (sublistLines.length > 0) {
                        html += '<h3 style="margin-top: 30px;">📋 Sublist: ' + sublistId + '</h3>';
                        
                        if (sublistData.metadata && sublistData.metadata.truncated) {
                            html += '<div class="alert alert-warning">';
                            html += '⚠️ Showing ' + sublistData.metadata.displayedLines + ' of ' + sublistData.metadata.lineCount + ' lines (truncated for performance)';
                            html += '</div>';
                        }
                        
                        const columnIds = Object.keys(sublistLines[0]).filter(k => k !== '_lineNumber');
                        
                        html += '<table><thead><tr>';
                        html += '<th>#</th>';
                        
                        columnIds.forEach(columnId => {
                            const columnLabel = sublistLines[0][columnId].label || columnId;
                            html += '<th>' + columnLabel + '<br><small><code>' + columnId + '</code></small></th>';
                        });
                        
                        html += '</tr></thead><tbody>';
                        
                        sublistLines.forEach((lineData, index) => {
                            html += '<tr>';
                            html += '<td>' + lineData._lineNumber + '</td>';
                            
                            columnIds.forEach(columnId => {
                                const column = lineData[columnId];
                                html += '<td>';
                                html += formatValue(column.value);
                                if (column.text && column.text !== column.value) {
                                    html += '<br><small style="color: var(--text-secondary);">' + column.text + '</small>';
                                }
                                html += '</td>';
                            });
                            
                            html += '</tr>';
                        });
                        
                        html += '</tbody></table>';
                    }
                }
                
                html += '</div>';
                fieldBrowser.innerHTML = html;
            } catch (e) {
                fieldBrowser.innerHTML = '<div class="alert alert-danger">❌ Error parsing record data: ' + e.message + '</div>';
            }
            `
                : `
            fieldBrowser.innerHTML = '<div class="alert alert-danger">❌ Unable to load record data</div>';
            `
            }
        }
        
        // Format value helper
        function formatValue(value) {
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
                return String(value).substring(0, 200) + (String(value).length > 200 ? '...' : '');
            }
        }

        // Notification helper
        function showNotification(message, type) {
            const notification = document.createElement('div');
            notification.className = 'alert alert-' + type;
            notification.textContent = message;
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.right = '20px';
            notification.style.zIndex = '10000';
            notification.style.minWidth = '300px';
            notification.style.animation = 'slideIn 0.3s ease-out';
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }, 3000);
        }

        // Initialize on load
        if (${result.success ? "true" : "false"}) {
            initializeFieldBrowser();
        }

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        \`;
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
  }

  return {
    onRequest: onRequest,
  };
});
