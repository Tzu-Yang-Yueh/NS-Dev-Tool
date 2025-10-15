/**
 * Record Comparison Service Module
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 *
 * Handles comparing two NetSuite records and finding differences
 */

define(["./RecordDataService"], function (RecordDataService) {
  /**
   * Compare two records and return differences
   */
  function compareRecords(recordType, recordId1, recordId2) {
    try {
      const record1 = RecordDataService.getFullRecordData(
        recordType,
        recordId1
      );
      const record2 = RecordDataService.getFullRecordData(
        recordType,
        recordId2
      );

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

  return {
    compareRecords: compareRecords,
  };
});
