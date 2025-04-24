/**
 * NetSuite Record Viewer (包含字段標籤)
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define([
  "N/ui/serverWidget",
  "N/record",
  "N/search",
  "N/runtime",
  "N/url",
  "N/error",
], function (serverWidget, record, search, runtime, url, error) {
  /**
   * 獲取記錄的完整資訊並轉換為對象 (包含字段標籤)
   */
  function getFullRecordData(recordType, recordId) {
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

      return {
        success: true,
        data: recordData,
      };
    } catch (e) {
      return {
        success: false,
        error: {
          code: e.name || "ERROR",
          message: e.message || "未知錯誤",
          details:
            typeof e.stack === "string"
              ? e.stack.split("\n")
              : Array.isArray(e.stack)
              ? e.stack
              : [String(e)],
        },
      };
    }
  }

  /**
   * 創建簡單的 HTML 頁面
   */
  function createHtmlPage(recordType, recordId, result, scriptUrl) {
    // 創建書籤小工具代碼
    var bookmarkletCode =
      "javascript:(function(){" +
      "var recordType='';" +
      "var recordId='';" +
      "// 嘗試使用 SuiteScript 1.0 API" +
      "try { recordType=nlapiGetRecordType(); } catch(e) { }" +
      "try { recordId=nlapiGetRecordId(); } catch(e) { }" +
      "// 如果上面方法失敗，嘗試 SuiteScript 2.x API" +
      "if(!recordType || !recordId) {" +
      "  try { recordType=currentRecord.type; } catch(e) { }" +
      "  try { recordId=currentRecord.id; } catch(e) { }" +
      "}" +
      "// 如果還是失敗，嘗試從 URL 獲取" +
      "if(!recordType || !recordId) {" +
      "  var url = window.location.href;" +
      "  var recTypeMatch = url.match(/\\/(\\w+)\\.sl\\?/i) || url.match(/record\\/(\\w+)\\//i);" +
      "  var recIdMatch = url.match(/id=(\\d+)/i) || url.match(/record\\/\\w+\\/(\\d+)/i);" +
      "  if(recTypeMatch) recordType = recTypeMatch[1];" +
      "  if(recIdMatch) recordId = recIdMatch[1];" +
      "}" +
      "if(recordType && recordId){" +
      "  window.open('" +
      scriptUrl +
      "?recordtype='+recordType+'&recordid='+recordId,'_blank');" +
      "}else{" +
      "  alert('無法獲取記錄信息。請確保您在記錄頁面上使用此書籤小工具。');" +
      "}" +
      "})();";

    // 轉換 JSON 為字符串
    var jsonDataStr = JSON.stringify(
      result.success ? result.data : result.error,
      null,
      2
    );

    // HTML 模板
    var html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NetSuite Record Viewer${
      recordType && recordId ? " - " + recordType + " #" + recordId : ""
    }</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #0066cc;
            margin-bottom: 20px;
        }
        .card {
            background: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 20px;
        }
        .form-row {
            display: flex;
            margin-bottom: 15px;
        }
        .form-group {
            flex: 1;
            margin-right: 10px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            background-color: #0066cc;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #0052a3;
        }
        pre {
            background-color: #f8f8f8;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            overflow: auto;
            max-height: 600px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .alert {
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .alert-danger {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .json-actions {
            margin-bottom: 10px;
        }
        .json-actions button {
            margin-right: 5px;
        }
        .bookmarklet {
            display: inline-block;
            background-color: #0066cc;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            text-decoration: none;
            margin: 10px 0;
        }
        .json-viewer {
            font-family: monospace;
            font-size: 14px;
        }
        .json-viewer .prop {
            font-weight: bold;
            color: #0066cc;
        }
        .json-viewer .string {
            color: green;
        }
        .json-viewer .number {
            color: blue;
        }
        .json-viewer .boolean {
            color: red;
        }
        .json-viewer .null {
            color: gray;
        }
        .tab-container {
            margin-bottom: 15px;
        }
        .tab {
            display: inline-block;
            padding: 8px 15px;
            background-color: #eee;
            border: 1px solid #ddd;
            border-radius: 4px 4px 0 0;
            cursor: pointer;
            margin-right: 5px;
        }
        .tab.active {
            background-color: white;
            border-bottom: 1px solid white;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>NetSuite Record Viewer (包含字段標籤)</h1>
        
        <div class="card">
            <form action="${scriptUrl}" method="GET">
                <div class="form-row">
                    <div class="form-group">
                        <label for="recordtype">記錄類型</label>
                        <input type="text" id="recordtype" name="recordtype" value="${
                          recordType || ""
                        }" required placeholder="例如: salesorder, customer, transaction...">
                    </div>
                    <div class="form-group">
                        <label for="recordid">記錄 ID</label>
                        <input type="text" id="recordid" name="recordid" value="${
                          recordId || ""
                        }" required placeholder="例如: 12345">
                    </div>
                    <div class="form-group" style="flex: 0 0 auto; align-self: flex-end;">
                        <button type="submit">查詢</button>
                    </div>
                </div>
            </form>
        </div>
        
        ${
          recordType && recordId
            ? `
        <div class="card">
            <div class="json-actions">
                <button id="copyJson">複製 JSON</button>
                <button id="toggleView">切換顯示方式</button>
                <a href="${scriptUrl}?recordtype=${recordType}&recordid=${recordId}&format=json" target="_blank" style="text-decoration:none;">
                    <button>純 JSON 查看</button>
                </a>
            </div>
            
            <div class="tab-container">
                <div class="tab active" data-tab="raw-json">JSON 格式</div>
                <div class="tab" data-tab="field-view">字段瀏覽</div>
            </div>
            
            ${
              !result.success
                ? `
            <div class="alert alert-danger">
                <strong>錯誤:</strong> ${result.error.message}
            </div>
            `
                : ""
            }
            
            <div id="raw-json" class="tab-content active">
                <pre id="jsonData">${jsonDataStr}</pre>
            </div>
            
            <div id="field-view" class="tab-content">
                <div id="fieldBrowser">載入中...</div>
            </div>
        </div>
        `
            : ""
        }
        
        <div class="card">
            <h3>書籤小工具</h3>
            <p>將此連結拖曳到您的書籤列：</p>
            <a href="${bookmarkletCode}" class="bookmarklet">NetSuite Record Viewer</a>
            <p>在任何 NetSuite 記錄頁面上點擊此書籤即可查看該記錄的 JSON 數據。</p>
        </div>
    </div>
    
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // 處理複製按鈕
        var copyButton = document.getElementById('copyJson');
        if (copyButton) {
            copyButton.addEventListener('click', function() {
                var jsonData = ${JSON.stringify(jsonDataStr)};
                navigator.clipboard.writeText(jsonData).then(function() {
                    alert('JSON 已複製到剪貼簿');
                }, function() {
                    alert('無法複製到剪貼簿');
                });
            });
        }
        
        // 處理標籤切換
        var tabs = document.querySelectorAll('.tab');
        if (tabs.length) {
            tabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    // 移除所有標籤的 active 類
                    tabs.forEach(t => t.classList.remove('active'));
                    // 將所有內容區域隱藏
                    document.querySelectorAll('.tab-content').forEach(content => {
                        content.classList.remove('active');
                    });
                    
                    // 添加 active 類到當前標籤
                    this.classList.add('active');
                    // 顯示相應的內容區
                    const tabId = this.getAttribute('data-tab');
                    document.getElementById(tabId).classList.add('active');
                    
                    // 如果是字段瀏覽標籤，初始化字段瀏覽器
                    if (tabId === 'field-view') {
                        initializeFieldBrowser();
                    }
                });
            });
        }
        
        // 初始化字段瀏覽器
        function initializeFieldBrowser() {
            var fieldBrowser = document.getElementById('fieldBrowser');
            ${
              result.success
                ? `
            try {
                var data = ${JSON.stringify(result.data)};
                var html = '<div style="margin-bottom:20px;">';
                
                // 主體字段部分
                html += '<h3>主體字段</h3>';
                html += '<table style="width:100%; border-collapse:collapse;">';
                html += '<thead><tr>';
                html += '<th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">字段 ID</th>';
                html += '<th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">標籤</th>';
                html += '<th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">值</th>';
                html += '<th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">顯示文本</th>';
                html += '</tr></thead><tbody>';
                
                for (var fieldId in data.fields) {
                    var field = data.fields[fieldId];
                    html += '<tr>';
                    html += '<td style="padding:8px; border-bottom:1px solid #ddd;">' + fieldId + '</td>';
                    html += '<td style="padding:8px; border-bottom:1px solid #ddd;">' + (field.label || fieldId) + '</td>';
                    html += '<td style="padding:8px; border-bottom:1px solid #ddd;">' + formatValue(field.value) + '</td>';
                    html += '<td style="padding:8px; border-bottom:1px solid #ddd;">' + (field.text ? field.text : '') + '</td>';
                    html += '</tr>';
                }
                
                html += '</tbody></table>';
                
                // 子列表部分
                for (var sublistId in data.sublists) {
                    var sublistLines = data.sublists[sublistId];
                    if (sublistLines.length > 0) {
                        html += '<h3>子列表: ' + sublistId + '</h3>';
                        
                        // 取得所有列的 ID
                        var columnIds = [];
                        for (var columnId in sublistLines[0]) {
                            columnIds.push(columnId);
                        }
                        
                        html += '<table style="width:100%; border-collapse:collapse;">';
                        html += '<thead><tr>';
                        html += '<th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">行</th>';
                        
                        // 添加列標題
                        for (var i = 0; i < columnIds.length; i++) {
                            var columnId = columnIds[i];
                            var columnLabel = sublistLines[0][columnId].label || columnId;
                            html += '<th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">' + columnLabel + '<br><small>' + columnId + '</small></th>';
                        }
                        
                        html += '</tr></thead><tbody>';
                        
                        // 添加行數據
                        for (var line = 0; line < sublistLines.length; line++) {
                            var lineData = sublistLines[line];
                            html += '<tr>';
                            html += '<td style="padding:8px; border-bottom:1px solid #ddd;">' + (line + 1) + '</td>';
                            
                            for (var i = 0; i < columnIds.length; i++) {
                                var columnId = columnIds[i];
                                var column = lineData[columnId];
                                html += '<td style="padding:8px; border-bottom:1px solid #ddd;">';
                                html += formatValue(column.value);
                                if (column.text && column.text !== column.value) {
                                    html += '<br><small>' + column.text + '</small>';
                                }
                                html += '</td>';
                            }
                            
                            html += '</tr>';
                        }
                        
                        html += '</tbody></table>';
                    }
                }
                
                html += '</div>';
                fieldBrowser.innerHTML = html;
            } catch (e) {
                fieldBrowser.innerHTML = '<div class="alert alert-danger">無法解析記錄數據: ' + e.message + '</div>';
            }
            `
                : `
            fieldBrowser.innerHTML = '<div class="alert alert-danger">無法獲取記錄數據</div>';
            `
            }
        }
        
        // 格式化顯示值
        function formatValue(value) {
            if (value === null || value === undefined) {
                return '<span style="color:gray;">null</span>';
            } else if (value === '') {
                return '<span style="color:gray;">(空)</span>';
            } else if (typeof value === 'boolean') {
                return value ? '<span style="color:green;">true</span>' : '<span style="color:red;">false</span>';
            } else {
                return String(value);
            }
        }
    });
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * SuiteLet 主函數
   */
  function onRequest(context) {
    if (context.request.method === "GET") {
      // 獲取記錄類型和 ID 參數
      var recordType = context.request.parameters.recordtype;
      var recordId = context.request.parameters.recordid;

      // 獲取 SuiteLet URL
      var scriptUrl = url.resolveScript({
        scriptId: runtime.getCurrentScript().id,
        deploymentId: runtime.getCurrentScript().deploymentId,
        returnExternalUrl: false,
      });

      // 檢查是否要 JSON 格式的資料
      if (
        context.request.parameters.format === "json" &&
        recordType &&
        recordId
      ) {
        var result = getFullRecordData(recordType, recordId);
        context.response.setHeader({
          name: "Content-Type",
          value: "application/json; charset=utf-8",
        });
        context.response.write(JSON.stringify(result, null, 2));
        return;
      }

      // 如果提供了記錄類型和 ID，則獲取記錄資料
      var result = null;
      if (recordType && recordId) {
        result = getFullRecordData(recordType, recordId);
      } else {
        result = { success: true, data: {} };
      }

      // 創建 HTML 頁面
      var html = createHtmlPage(recordType, recordId, result, scriptUrl);
      context.response.write(html);
    }
  }

  return {
    onRequest: onRequest,
  };
});
