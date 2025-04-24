# NetSuite Developer Tools

## Overview

This project provides a set of developer tools for NetSuite to help with debugging, record inspection, and development. The tools enable developers to:

1. View complete record data in JSON format
2. Inspect field labels and values
3. Monitor record changes and script execution
4. Easily access record data during development and troubleshooting

## Components

### 1. Record JSON Viewer (SL_record_json_view.js)

A Suitelet script that provides a web interface to view NetSuite record data in JSON format with field labels.

**Features:**
- View complete record JSON data
- Display field labels alongside field IDs
- View both raw values and display text values
- Toggle between JSON view and structured field browser view
- Copy JSON data to clipboard
- Bookmarklet for easy access from any NetSuite record

### 2. Record Info User Event Script (UE_check_record_info.js)

A User Event script that logs detailed execution information and provides a button to view record JSON.

**Features:**
- Logs execution context (beforeLoad, beforeSubmit, afterSubmit)
- Tracks field changes between old and new records
- Adds "View Record JSON" button to record forms
- Logs complete record data to script logs
- Provides role name resolution

## Installation

### Prerequisites
- NetSuite account with SuiteScript 2.1 support
- Administrator or developer role with SuiteScript deployment permissions

### Deployment Steps

1. **Upload Scripts**
   - Upload the script files to the `SuiteScripts/temp/Dev Tool/` directory in your NetSuite account

2. **Deploy Suitelet Script (Record JSON Viewer)**
   - Navigate to Customization > Scripting > Scripts > New
   - Create a new Suitelet script using the uploaded `SL_record_json_view.js` file
   - Deploy the script with the following settings:
     - Script ID: `customscriptsl_record_json_view`
     - Deployment ID: `customdeploysl_record_json_view`
     - Status: `Testing` or `Released`
     - Log Level: `Debug`

3. **Deploy User Event Script (Record Info)**
   - Navigate to Customization > Scripting > Scripts > New
   - Create a new User Event script using the uploaded `UE_check_record_info.js` file
   - Deploy the script with the following settings:
     - Script ID: `customscriptue_check_record_info`
     - Deployment ID: `customdeployue_check_record_info_1`
     - Status: `Testing` or `Released`
     - Apply to: Select the record types you want to monitor
     - Events: Select which events to monitor (Create, Edit, View, Delete)
     - Log Level: `Debug`

4. **Configure User Event Script**
   - Ensure the script constants match your Suitelet deployment:
     ```javascript
     const RECORD_VIEWER_SCRIPT_ID = "customscriptsl_record_json_view";
     const RECORD_VIEWER_DEPLOYMENT_ID = "customdeploysl_record_json_view";
     ```
   - Set the logging preference:
     ```javascript
     const LOG_FULL_RECORD_JSON = true; // Set to false if you don't want complete JSON logs
     ```

## Usage

### Record JSON Viewer

1. **Direct URL Access**
   - Access the Suitelet directly with record type and ID parameters:
   - `https://[account-id].app.netsuite.com/app/site/hosting/scriptlet.nl?script=customscriptsl_record_json_view&deploy=customdeploysl_record_json_view&recordtype=[recordtype]&recordid=[recordid]`

2. **Using the Bookmarklet**
   - Create a bookmark in your browser with the JavaScript code provided by the Suitelet
   - When viewing a NetSuite record, click the bookmarklet to open the JSON viewer

3. **Using the Button on Record Forms**
   - When the User Event script is deployed, a "View Record JSON" button appears on record forms
   - Click this button to view the JSON data for the current record

### Viewing Script Logs

1. Navigate to Administration > Support > Scripting > Logs
2. Find the execution logs for the User Event script
3. Review the detailed information about record operations and field changes

## Technical Details

### SL_record_json_view.js (Suitelet)

A NetSuite Suitelet script that provides a web interface for viewing record data:

- **API Version**: 2.1
- **Script Type**: Suitelet
- **Modules**: N/ui/serverWidget, N/record, N/search, N/runtime, N/url, N/error
- **Key Functions**:
  - `getFullRecordData(recordType, recordId)`: Retrieves complete record data with field labels
  - `createHtmlPage(recordType, recordId, result, scriptUrl)`: Generates the HTML interface
  - `onRequest(context)`: Main Suitelet entry point

### UE_check_record_info.js (User Event)

A NetSuite User Event script that logs execution information and provides record view functionality:

- **API Version**: 2.1
- **Script Type**: UserEventScript
- **Modules**: N/log, N/runtime, N/record, N/url, N/ui/serverWidget, N/search
- **Key Functions**:
  - `logExecutionContext(context, eventType)`: Logs execution information
  - `getRecordViewerUrl(recordType, recordId)`: Generates URL to Record Viewer
  - `trackRecordChanges(context, executionInfo)`: Tracks field changes
  - `getFullRecordJson(recordType, recordId)`: Gets complete record JSON
  - Event handlers: `beforeLoad`, `beforeSubmit`, `afterSubmit`

## Notes

- The tools are designed for development and debugging purposes
- The User Event script generates extensive logs that can impact performance
- Consider setting `LOG_FULL_RECORD_JSON = false` for production environments
- The scripts include traditional Chinese (繁體中文) comments and interface elements

## Project Structure

```
SuiteScripts/
└── temp/
    └── Dev Tool/
        ├── SL_record_json_view.js        # Record JSON viewer Suitelet
        └── UE_check_record_info.js       # Record info User Event script

Objects/
├── customscriptsl_record_json_view.xml   # Suitelet deployment configuration
└── customscriptue_check_record_info.xml  # User Event deployment configuration
```

## License

This project is for internal use within NetSuite environments. No specific license is provided.


# NetSuite 開發工具

## 概述

本項目提供了一套 NetSuite 開發工具，用於幫助調試、記錄檢查和開發。這些工具使開發人員能夠：

1. 以 JSON 格式查看完整記錄數據
2. 檢查字段標籤和值
3. 監控記錄變更和腳本執行
4. 在開發和故障排除過程中輕鬆訪問記錄數據

## 組件

### 1. 記錄 JSON 查看器 (SL_record_json_view.js)

一個 Suitelet 腳本，提供網頁界面以 JSON 格式查看 NetSuite 記錄數據及字段標籤。

**功能：**
- 查看完整記錄 JSON 數據
- 顯示字段標籤和字段 ID
- 同時查看原始值和顯示文本值
- 在 JSON 視圖和結構化字段瀏覽器視圖之間切換
- 將 JSON 數據複製到剪貼板
- 提供書籤小工具，方便從任何 NetSuite 記錄快速訪問

### 2. 記錄信息用戶事件腳本 (UE_check_record_info.js)

一個用戶事件腳本，記錄詳細的執行信息並提供按鈕查看記錄 JSON。

**功能：**
- 記錄執行上下文（beforeLoad、beforeSubmit、afterSubmit）
- 跟踪舊記錄和新記錄之間的字段變更
- 在記錄表單上添加"查看記錄 JSON"按鈕
- 將完整記錄數據記錄到腳本日誌
- 提供角色名稱解析

## 安裝

### 前提條件
- 支持 SuiteScript 2.1 的 NetSuite 賬戶
- 具有 SuiteScript 部署權限的管理員或開發人員角色

### 部署步驟

1. **上傳腳本**
   - 將腳本文件上傳到 NetSuite 賬戶中的 `SuiteScripts/temp/Dev Tool/` 目錄

2. **部署 Suitelet 腳本（記錄 JSON 查看器）**
   - 轉到「自定義 > 腳本 > 腳本 > 新建」
   - 使用上傳的 `SL_record_json_view.js` 文件創建一個新的 Suitelet 腳本
   - 使用以下設置部署腳本：
     - 腳本 ID：`customscriptsl_record_json_view`
     - 部署 ID：`customdeploysl_record_json_view`
     - 狀態：`測試中` 或 `已發佈`
     - 日誌級別：`調試`

3. **部署用戶事件腳本（記錄信息）**
   - 轉到「自定義 > 腳本 > 腳本 > 新建」
   - 使用上傳的 `UE_check_record_info.js` 文件創建一個新的用戶事件腳本
   - 使用以下設置部署腳本：
     - 腳本 ID：`customscriptue_check_record_info`
     - 部署 ID：`customdeployue_check_record_info_1`
     - 狀態：`測試中` 或 `已發佈`
     - 應用於：選擇您要監控的記錄類型
     - 事件：選擇要監控的事件（創建、編輯、查看、刪除）
     - 日誌級別：`調試`

4. **配置用戶事件腳本**
   - 確保腳本常量與您的 Suitelet 部署相匹配：
     ```javascript
     const RECORD_VIEWER_SCRIPT_ID = "customscriptsl_record_json_view";
     const RECORD_VIEWER_DEPLOYMENT_ID = "customdeploysl_record_json_view";
     ```
   - 設置日誌記錄偏好：
     ```javascript
     const LOG_FULL_RECORD_JSON = true; // 如果不需要完整的 JSON 日誌，設置為 false
     ```

## 使用方法

### 記錄 JSON 查看器

1. **直接 URL 訪問**
   - 使用記錄類型和 ID 參數直接訪問 Suitelet：
   - `https://[account-id].app.netsuite.com/app/site/hosting/scriptlet.nl?script=customscriptsl_record_json_view&deploy=customdeploysl_record_json_view&recordtype=[recordtype]&recordid=[recordid]`

2. **使用書籤小工具**
   - 在瀏覽器中創建一個包含 Suitelet 提供的 JavaScript 代碼的書籤
   - 在查看 NetSuite 記錄時，點擊書籤小工具打開 JSON 查看器

3. **使用記錄表單上的按鈕**
   - 當用戶事件腳本部署後，記錄表單上會出現「查看記錄 JSON」按鈕
   - 點擊此按鈕查看當前記錄的 JSON 數據

### 查看腳本日誌

1. 轉到「管理 > 支持 > 腳本 > 日誌」
2. 找到用戶事件腳本的執行日誌
3. 查看有關記錄操作和字段變更的詳細信息

## 技術細節

### SL_record_json_view.js (Suitelet)

一個提供記錄數據Web界面的 NetSuite Suitelet 腳本：

- **API 版本**：2.1
- **腳本類型**：Suitelet
- **模塊**：N/ui/serverWidget, N/record, N/search, N/runtime, N/url, N/error
- **主要功能**：
  - `getFullRecordData(recordType, recordId)`：檢索帶有字段標籤的完整記錄數據
  - `createHtmlPage(recordType, recordId, result, scriptUrl)`：生成 HTML 界面
  - `onRequest(context)`：主要 Suitelet 入口點

### UE_check_record_info.js (用戶事件)

一個記錄執行信息並提供記錄查看功能的 NetSuite 用戶事件腳本：

- **API 版本**：2.1
- **腳本類型**：UserEventScript
- **模塊**：N/log, N/runtime, N/record, N/url, N/ui/serverWidget, N/search
- **主要功能**：
  - `logExecutionContext(context, eventType)`：記錄執行信息
  - `getRecordViewerUrl(recordType, recordId)`：生成到記錄查看器的 URL
  - `trackRecordChanges(context, executionInfo)`：跟踪字段變更
  - `getFullRecordJson(recordType, recordId)`：獲取完整記錄 JSON
  - 事件處理程序：`beforeLoad`, `beforeSubmit`, `afterSubmit`

## 註意事項

- 這些工具專為開發和調試目的而設計
- 用戶事件腳本生成大量日誌，可能影響性能
- 對於生產環境，請考慮設置 `LOG_FULL_RECORD_JSON = false`
- 腳本包含繁體中文註釋和界面元素

## 項目結構

```
SuiteScripts/
└── temp/
    └── Dev Tool/
        ├── SL_record_json_view.js        # 記錄 JSON 查看器 Suitelet
        └── UE_check_record_info.js       # 記錄信息用戶事件腳本

Objects/
├── customscriptsl_record_json_view.xml   # Suitelet 部署配置
└── customscriptue_check_record_info.xml  # 用戶事件部署配置
```

## 授權

本項目供 NetSuite 環境內部使用。未提供特定授權。
