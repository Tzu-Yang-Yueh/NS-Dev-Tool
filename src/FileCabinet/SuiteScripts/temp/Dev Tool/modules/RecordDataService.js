/**
 * Record Data Service Module
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 *
 * Handles loading and processing NetSuite record data
 */

define(["N/record", "N/runtime", "./PerformanceTracker"], function (
  record,
  runtime,
  PerformanceTrackerModule
) {
  const PerformanceTracker = PerformanceTrackerModule.PerformanceTracker;

  // Configuration
  const CONFIG = {
    MAX_SUBLIST_LINES: 1000, // Limit sublist lines for performance
  };

  /**
   * Enhanced function to get complete record data with performance tracking
   */
  function getFullRecordData(recordType, recordId, options) {
    const perf = new PerformanceTracker(true);
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

  return {
    getFullRecordData: getFullRecordData,
  };
});
