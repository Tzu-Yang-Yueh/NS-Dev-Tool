/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * Enhanced User Event Script for logging execution states and information
 * with integrated Record Viewer functionality and direct JSON logging
 */
define([
  "N/log",
  "N/runtime",
  "N/record",
  "N/url",
  "N/ui/serverWidget",
  "N/search",
], function (log, runtime, record, url, serverWidget, search) {
  // 記錄查看器 Suitelet 的 scriptId (根據你的部署修改)
  const RECORD_VIEWER_SCRIPT_ID = "customscriptsl_record_json_view";
  const RECORD_VIEWER_DEPLOYMENT_ID = "customdeploysl_record_json_view";

  // 是否直接記錄完整 JSON
  const LOG_FULL_RECORD_JSON = true;

  /**
   * 將對象轉換為更易讀的字符串格式
   *
   * @param {Object} obj - 要格式化的對象
   * @returns {string} 格式化的字符串
   */
  function formatObject(obj) {
    try {
      if (typeof obj === "object" && obj !== null) {
        return JSON.stringify(obj, null, 2);
      }
      return String(obj);
    } catch (e) {
      return "Error formatting object: " + e.message;
    }
  }

  /**
   * 獲取 Record Viewer URL
   *
   * @param {string} recordType - 記錄類型
   * @param {string} recordId - 記錄 ID
   * @returns {string} Record Viewer URL
   */
  function getRecordViewerUrl(recordType, recordId) {
    try {
      return url.resolveScript({
        scriptId: RECORD_VIEWER_SCRIPT_ID,
        deploymentId: RECORD_VIEWER_DEPLOYMENT_ID,
        params: {
          recordtype: recordType,
          recordid: recordId,
        },
        returnExternalUrl: false,
      });
    } catch (e) {
      log.error({
        title: "Error generating Record Viewer URL",
        details: e.message,
      });
      return "#";
    }
  }

  /**
   * Function to log detailed information about the current execution
   *
   * @param {Object} context - Script context
   * @param {string} eventType - Event type (beforeLoad, beforeSubmit, afterSubmit)
   */
  function logExecutionContext(context, eventType) {
    const executionContext = runtime.executionContext;
    const currentScript = runtime.getCurrentScript();
    const currentUser = runtime.getCurrentUser();

    // 基本執行資訊
    const executionInfo = {
      eventType: eventType,
      executionContext: runtime.ContextType[executionContext],
      type: context.type,
      recordType: context.newRecord.type,
      recordId: context.newRecord.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      roleName: getUserRoleName(currentUser.role),
      scriptId: currentScript.id,
      deploymentId: currentScript.deploymentId,
      dateTime: new Date().toISOString(),
    };

    // Record Viewer URL
    const recordViewerUrl = getRecordViewerUrl(
      context.newRecord.type,
      context.newRecord.id
    );

    executionInfo.recordViewerUrl = recordViewerUrl;

    // 記錄更詳細的資訊
    if (eventType === "beforeLoad") {
      executionInfo.form = context.form
        ? "Form Object Present"
        : "No Form Object";
      executionInfo.operation = context.type;
    }

    if (eventType === "beforeSubmit" || eventType === "afterSubmit") {
      if (context.oldRecord) {
        executionInfo.hasOldRecord = true;
        executionInfo.changedFields = getChangedFields(
          context.oldRecord,
          context.newRecord
        );
      } else {
        executionInfo.hasOldRecord = false;
      }
    }

    log.audit({
      title: `USER EVENT - ${eventType} | ${context.newRecord.type} #${context.newRecord.id}`,
      details: formatObject(executionInfo),
    });

    // 記錄效能統計
    log.debug({
      title: `Performance Stats - ${eventType}`,
      details: {
        remainingUsage: currentScript.getRemainingUsage(),
        startTime: currentScript.startTime,
      },
    });

    return executionInfo;
  }

  /**
   * 獲取角色名稱
   *
   * @param {number} roleId - 角色ID
   * @returns {string} 角色名稱
   */
  function getUserRoleName(roleId) {
    try {
      var roleName = "";
      var roleSearch = search
        .create({
          type: search.Type.ROLE,
          filters: [["internalid", "anyof", roleId]],
          columns: ["name"],
        })
        .run()
        .getRange(0, 1);

      if (roleSearch && roleSearch.length > 0) {
        roleName = roleSearch[0].getValue("name");
      }

      return roleName || String(roleId);
    } catch (e) {
      log.error({
        title: "Error getting role name",
        details: e.message,
      });
      return String(roleId);
    }
  }

  /**
   * Get changed fields between old and new record
   *
   * @param {Record} oldRecord - Original record
   * @param {Record} newRecord - Modified record
   * @returns {Array} Array of changed field information
   */
  function getChangedFields(oldRecord, newRecord) {
    const changedFields = [];
    const fields = newRecord.getFields();

    fields.forEach(function (fieldId) {
      try {
        const oldValue = oldRecord.getValue({ fieldId: fieldId });
        const newValue = newRecord.getValue({ fieldId: fieldId });

        // 檢查值是否相同，注意null和undefined的處理
        const valuesAreDifferent =
          (oldValue === null && newValue !== null) ||
          (oldValue !== null && newValue === null) ||
          (oldValue !== undefined && newValue === undefined) ||
          (oldValue === undefined && newValue !== undefined) ||
          oldValue !== newValue;

        if (valuesAreDifferent) {
          let fieldObj;
          let fieldLabel = fieldId;
          let fieldType = "";

          // 嘗試獲取字段標籤和類型
          try {
            fieldObj = newRecord.getField({ fieldId: fieldId });
            if (fieldObj) {
              fieldLabel = fieldObj.label || fieldId;
              fieldType = fieldObj.type || "";
            }
          } catch (e) {
            // 忽略錯誤，使用默認值
          }

          // 獲取文本值（如果適用）
          let oldText = undefined;
          let newText = undefined;

          try {
            if (oldValue !== null && oldValue !== undefined) {
              oldText = oldRecord.getText({ fieldId: fieldId });
            }
            if (newValue !== null && newValue !== undefined) {
              newText = newRecord.getText({ fieldId: fieldId });
            }
          } catch (e) {
            // 某些字段可能沒有getText方法，忽略錯誤
          }

          changedFields.push({
            fieldId: fieldId,
            label: fieldLabel,
            type: fieldType,
            oldValue: oldValue,
            newValue: newValue,
            oldText: oldText !== oldValue ? oldText : undefined,
            newText: newText !== newValue ? newText : undefined,
          });
        }
      } catch (e) {
        // 某些欄位可能無法取得值，忽略這些錯誤
        log.error({
          title: "Error comparing field values",
          details: `Field: ${fieldId}, Error: ${e.message}`,
        });
      }
    });

    return changedFields;
  }

  /**
   * 添加 Record Viewer 按鈕到表單
   *
   * @param {Object} form - 表單對象
   * @param {string} recordType - 記錄類型
   * @param {string} recordId - 記錄 ID
   */
  function addRecordViewerButton(form, recordType, recordId) {
    try {
      if (form && recordType && recordId) {
        const recordViewerUrl = getRecordViewerUrl(recordType, recordId);

        form.addButton({
          id: "custpage_view_record_json",
          label: "查看記錄 JSON",
          functionName: `window.open('${recordViewerUrl}', '_blank')`,
        });
      }
    } catch (e) {
      log.error({
        title: "Error adding Record Viewer button",
        details: e.message,
      });
    }
  }

  /**
   * 追蹤記錄變更
   *
   * @param {Object} context - Script context
   * @param {Object} executionInfo - 執行信息
   */
  function trackRecordChanges(context, executionInfo) {
    try {
      if (
        context.type !== "create" &&
        context.type !== "edit" &&
        context.type !== "xedit"
      ) {
        return;
      }

      // 只有在有舊記錄時才追蹤變更
      if (!context.oldRecord) {
        return;
      }

      const changedFields = executionInfo.changedFields || [];

      if (changedFields.length === 0) {
        log.debug({
          title: "No fields changed",
          details: "Operation caused no field changes",
        });
        return;
      }

      // 記錄詳細的變更
      log.audit({
        title: `Record changes detected [${context.newRecord.type} #${context.newRecord.id}]`,
        details:
          `Changed ${changedFields.length} field(s): ` +
          changedFields.map((f) => `${f.label} (${f.fieldId})`).join(", "),
      });

      // 提供 Record Viewer 連結
      log.audit({
        title: "View complete record",
        details: `Record Viewer URL: ${executionInfo.recordViewerUrl}`,
      });
    } catch (e) {
      log.error({
        title: "Error tracking record changes",
        details: e.message,
      });
    }
  }

  /**
   * Before Load Function
   *
   * @param {Object} context
   * @param {Record} context.newRecord - New record
   * @param {string} context.type - Trigger type
   * @param {Form} context.form - Current form
   */
  function beforeLoad(context) {
    try {
      // 添加 Record Viewer 按鈕
      if (context.type === "view" || context.type === "edit") {
        addRecordViewerButton(
          context.form,
          context.newRecord.type,
          context.newRecord.id
        );
      }

      // 記錄表單相關資訊（如果有）
      if (context.form) {
        log.debug({
          title: "Form Information",
          details: {
            hasClientScript: !!context.form.clientScriptModulePath,
            formTitle: context.form.title,
          },
        });

        log.debug({
          title: "ALL Field Information",
          details: {
            fields: getFullRecordJson(
              context.newRecord.type,
              context.newRecord.id
            ),
          },
        });
        const executionInfo = logExecutionContext(context, "beforeLoad");
      }
    } catch (e) {
      log.error({
        title: "Error in beforeLoad",
        details: e.message + "\n" + e.stack,
      });
    }
  }

  /**
   * Before Submit Function
   *
   * @param {Object} context
   * @param {Record} context.newRecord - New record
   * @param {Record} context.oldRecord - Old record
   * @param {string} context.type - Trigger type
   */
  function beforeSubmit(context) {
    try {
      const executionInfo = logExecutionContext(context, "beforeSubmit");

      // 記錄即將提交的更改摘要
      if (
        context.type === context.UserEventType.EDIT ||
        context.type === context.UserEventType.XEDIT
      ) {
        trackRecordChanges(context, executionInfo);
      }
    } catch (e) {
      log.error({
        title: "Error in beforeSubmit",
        details: e.message + "\n" + e.stack,
      });
    }
  }

  /**
   * 獲取完整記錄 JSON
   *
   * @param {string} recordType - 記錄類型
   * @param {string} recordId - 記錄 ID
   * @returns {Object} 完整記錄資料
   */
  function getFullRecordJson(recordType, recordId) {
    try {
      // 載入記錄
      var recordObj = record.load({
        type: recordType,
        id: recordId,
        isDynamic: false,
      });

      // 創建一個物件來存儲記錄資料
      var recordData = {
        type: recordType,
        id: recordId,
        fields: {},
        sublists: {},
      };

      // 獲取所有主體字段
      var bodyFields = recordObj.getFields();
      for (var i = 0; i < bodyFields.length; i++) {
        var fieldId = bodyFields[i];
        try {
          var fieldValue = recordObj.getValue({ fieldId: fieldId });
          var fieldText = recordObj.getText({ fieldId: fieldId });

          // 嘗試獲取字段標籤
          var fieldLabel = "";
          try {
            var fieldObj = recordObj.getField({
              fieldId: fieldId,
            });
            fieldLabel = fieldObj.label || fieldId;
          } catch (labelErr) {
            fieldLabel = fieldId; // 如果無法獲取標籤，使用字段ID作為標籤
          }

          recordData.fields[fieldId] = {
            label: fieldLabel,
            value: fieldValue,
            text: fieldText !== fieldValue ? fieldText : undefined,
          };
        } catch (e) {
          recordData.fields[fieldId] = {
            label: fieldId,
            value: "無法讀取: " + e.message,
          };
        }
      }

      // 獲取所有子列表
      var sublists = recordObj.getSublists();
      for (var i = 0; i < sublists.length; i++) {
        var sublistId = sublists[i];
        recordData.sublists[sublistId] = [];

        var lineCount = recordObj.getLineCount({ sublistId: sublistId });

        for (var line = 0; line < lineCount; line++) {
          var lineData = {};
          var columns = recordObj.getSublistFields({ sublistId: sublistId });

          for (var c = 0; c < columns.length; c++) {
            var columnId = columns[c];
            try {
              var columnValue = recordObj.getSublistValue({
                sublistId: sublistId,
                fieldId: columnId,
                line: line,
              });

              var columnText = recordObj.getSublistText({
                sublistId: sublistId,
                fieldId: columnId,
                line: line,
              });

              // 嘗試獲取子列表字段標籤
              var columnLabel = "";
              try {
                var columnObj = recordObj.getSublistField({
                  sublistId: sublistId,
                  fieldId: columnId,
                  line: line,
                });
                columnLabel = columnObj.label || columnId;
              } catch (labelErr) {
                columnLabel = columnId;
              }

              lineData[columnId] = {
                label: columnLabel,
                value: columnValue,
                text: columnText !== columnValue ? columnText : undefined,
              };
            } catch (e) {
              lineData[columnId] = {
                label: columnId,
                value: "無法讀取: " + e.message,
              };
            }
          }

          recordData.sublists[sublistId].push(lineData);
        }
      }

      return recordData;
    } catch (e) {
      log.error({
        title: "Error getting full record JSON",
        details: e.message + "\n" + e.stack,
      });

      return {
        error: true,
        message: e.message,
        stack: e.stack,
      };
    }
  }

  /**
   * After Submit Function
   *
   * @param {Object} context
   * @param {Record} context.newRecord - New record
   * @param {Record} context.oldRecord - Old record
   * @param {string} context.type - Trigger type
   */
  function afterSubmit(context) {
    try {
      const executionInfo = logExecutionContext(context, "afterSubmit");

      // 記錄儲存後的結果
      log.audit({
        title: "Record Saved Successfully",
        details: {
          recordId: context.newRecord.id,
          type: context.type,
          timestamp: new Date().toISOString(),
          recordViewUrl: executionInfo.recordViewerUrl,
        },
      });

      // 如果是 Mass Update 執行，特別標記
      if (runtime.executionContext === runtime.ContextType.MASS_UPDATE) {
        log.audit({
          title: "Mass Update Detected",
          details: "This execution is triggered by Mass Update Script",
        });
      }

      // 直接記錄完整記錄 JSON
      if (LOG_FULL_RECORD_JSON) {
        try {
          const fullRecordData = getFullRecordJson(
            context.newRecord.type,
            context.newRecord.id
          );

          log.audit({
            title: `FULL RECORD JSON | ${context.newRecord.type} #${context.newRecord.id}`,
            details: "開始記錄完整 JSON 資料",
          });

          // 由於 log 大小限制，分段記錄主體字段
          log.audit({
            title: "RECORD FIELDS",
            details: formatObject(fullRecordData.fields),
          });

          // 分段記錄各個子列表
          const sublists = Object.keys(fullRecordData.sublists);
          for (let i = 0; i < sublists.length; i++) {
            const sublistId = sublists[i];

            log.audit({
              title: `SUBLIST: ${sublistId}`,
              details: formatObject(fullRecordData.sublists[sublistId]),
            });
          }

          log.audit({
            title: `FULL RECORD JSON COMPLETE | ${context.newRecord.type} #${context.newRecord.id}`,
            details: "完整 JSON 記錄完成",
          });
        } catch (jsonError) {
          log.error({
            title: "Error logging full record JSON",
            details: jsonError.message + "\n" + jsonError.stack,
          });
        }
      }
    } catch (e) {
      log.error({
        title: "Error in afterSubmit",
        details: e.message + "\n" + e.stack,
      });
    }
  }

  return {
    beforeLoad: beforeLoad,
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit,
  };
});

/**
 * 使用說明：
 *
 * 1. 先部署 Suitelet 記錄查看器（Record Viewer）
 *    - 將記錄查看器代碼保存為 Suitelet
 *    - 記住 scriptId 和 deploymentId
 *
 * 2. 修改此 User Event Script 中的常量：
 *    - RECORD_VIEWER_SCRIPT_ID
 *    - RECORD_VIEWER_DEPLOYMENT_ID
 *    - LOG_FULL_RECORD_JSON - 設為 true 將直接記錄完整 JSON
 *
 * 3. 部署此 User Event Script
 *    - 選擇需要監控的記錄類型
 *    - 選擇要監控的事件類型（Create, Edit, Delete）
 *
 * 此增強版 User Event Logger 會:
 * - 記錄詳細的事件觸發信息
 * - 追蹤字段變更（含標籤和文本值）
 * - 添加 "查看記錄 JSON" 按鈕到記錄表單
 * - 提供記錄查看器的直接連結
 * - 支持角色名稱解析
 * - 完整集成 Mass Update 檢測
 * - 直接將完整記錄 JSON 寫入日誌 (若 LOG_FULL_RECORD_JSON 設為 true)
 *
 * JSON 日誌結構:
 * - "FULL RECORD JSON | [記錄類型] #[記錄ID]" - 開始記錄
 * - "RECORD FIELDS" - 主體字段
 * - "SUBLIST: [子列表ID]" - 每個子列表
 * - "FULL RECORD JSON COMPLETE | [記錄類型] #[記錄ID]" - 結束記錄
 *
 * 所有日誌可以在 Script Execution Log 中查看
 */
