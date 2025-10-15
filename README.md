# NetSuite Developer Tools

## Overview

This project provides a comprehensive set of developer tools for NetSuite to help with debugging, record inspection, and development. The tools enable developers to:

1. View complete record data in JSON format with advanced UI
2. Compare records side-by-side
3. Monitor record changes and script execution
4. Export data in multiple formats (JSON, CSV)
5. Easily access record data during development and troubleshooting

## Components

### 1. Enhanced Record JSON Viewer (SL_record_json_view.js)

A modularized Suitelet script that provides an advanced web interface to view NetSuite record data with enhanced features.

**Features:**
- **Advanced UI**: Modern, responsive interface with dark mode support
- **Complete Record Data**: View all fields and sublists with labels and metadata
- **Field Browser**: Structured table view with search and filtering
- **Record Comparison**: Side-by-side comparison of two records
- **Multiple Export Formats**: JSON, CSV, and Excel-ready exports
- **Performance Tracking**: Built-in performance monitoring
- **Bookmarklet**: Quick access from any NetSuite record
- **Modular Architecture**: Clean, maintainable code structure

### 2. Enhanced Record Info User Event Script (UE_check_record_info.js)

An advanced User Event script that provides comprehensive logging and record inspection capabilities.

**Features:**
- **Detailed Execution Logging**: Complete context tracking (beforeLoad, beforeSubmit, afterSubmit)
- **Field Change Tracking**: Monitors and logs all field changes with labels
- **Record Viewer Integration**: Direct button integration with the Record Viewer
- **Role Name Resolution**: Automatic role name lookup
- **Mass Update Detection**: Special handling for mass update operations
- **Complete JSON Logging**: Optional full record JSON logging to script logs
- **Performance Monitoring**: Execution time and usage tracking

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
   - **Raw JSON Format**: Add `&format=json` for direct JSON output
   - **Dark Mode**: Add `&darkMode=true` for dark theme

2. **Using the Bookmarklet**
   - Create a bookmark in your browser with the JavaScript code provided by the Suitelet
   - When viewing a NetSuite record, click the bookmarklet to open the JSON viewer
   - Automatically detects record type and ID from the current page

3. **Using the Button on Record Forms**
   - When the User Event script is deployed, a "查看記錄 JSON" button appears on record forms
   - Click this button to view the JSON data for the current record

4. **Advanced Features**
   - **Field Search**: Use the search box to filter fields by name or value
   - **Record Comparison**: Enter another record ID to compare two records side-by-side
   - **Export Options**: Download data as JSON or CSV files
   - **Dark Mode Toggle**: Switch between light and dark themes
   - **Performance Stats**: View loading times and performance metrics

### Viewing Script Logs

1. Navigate to Administration > Support > Scripting > Logs
2. Find the execution logs for the User Event script
3. Review the detailed information about record operations and field changes

## Technical Details

### SL_record_json_view.js (Suitelet)

A modularized NetSuite Suitelet script with advanced features:

- **API Version**: 2.1
- **Script Type**: Suitelet
- **Modules**: N/runtime, N/url, RecordDataService, RecordComparisonService, HTMLTemplateService
- **Key Functions**:
  - `onRequest(context)`: Main Suitelet entry point with format support (JSON, comparison)
  - **Modular Architecture**: Separated concerns into dedicated service modules
  - **Performance Tracking**: Built-in timing and performance monitoring
  - **Multiple Formats**: Raw JSON, HTML interface, and comparison views

### UE_check_record_info.js (User Event)

An enhanced NetSuite User Event script with comprehensive logging:

- **API Version**: 2.1
- **Script Type**: UserEventScript
- **Modules**: N/log, N/runtime, N/record, N/url, N/ui/serverWidget, N/search
- **Key Functions**:
  - `logExecutionContext(context, eventType)`: Enhanced execution logging with performance stats
  - `getRecordViewerUrl(recordType, recordId)`: Generates URL to Record Viewer
  - `trackRecordChanges(context, executionInfo)`: Advanced field change tracking
  - `getFullRecordJson(recordType, recordId)`: Complete record JSON with metadata
  - `getUserRoleName(roleId)`: Role name resolution
  - Event handlers: `beforeLoad`, `beforeSubmit`, `afterSubmit`

### Supporting Modules

#### RecordDataService.js
- **Purpose**: Handles record loading and data processing
- **Features**: Performance tracking, field filtering, sublist truncation
- **Key Function**: `getFullRecordData(recordType, recordId, options)`

#### RecordComparisonService.js
- **Purpose**: Compares two records and identifies differences
- **Features**: Field-by-field comparison, sublist line count comparison
- **Key Function**: `compareRecords(recordType, recordId1, recordId2)`

#### HTMLTemplateService.js
- **Purpose**: Generates advanced HTML interface
- **Features**: Dark mode support, responsive design, interactive elements
- **Key Function**: `createHtmlPage(params)`

#### PerformanceTracker.js
- **Purpose**: Tracks execution performance and timing
- **Features**: Mark-based timing, performance reports
- **Key Function**: `PerformanceTracker` class with mark/report methods

## Advanced Features

### Performance Optimizations
- **Sublist Truncation**: Large sublists are automatically truncated for performance (configurable limit)
- **Field Filtering**: Optional field filtering to reduce data load
- **Performance Tracking**: Built-in timing for all operations
- **Efficient Data Processing**: Optimized record loading and processing

### User Interface Enhancements
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode**: Toggle between light and dark themes with persistence
- **Interactive Elements**: Expandable long text, searchable fields, tabbed interface
- **Export Capabilities**: Multiple export formats (JSON, CSV, Excel-ready)
- **Real-time Search**: Instant field filtering and search

### Development Features
- **Modular Architecture**: Clean separation of concerns for maintainability
- **Error Handling**: Comprehensive error handling and user feedback
- **Logging Integration**: Detailed logging for debugging and monitoring
- **Bookmarklet Support**: Quick access from any NetSuite record
- **Comparison Tools**: Side-by-side record comparison functionality

## Notes

- The tools are designed for development and debugging purposes
- The User Event script generates extensive logs that can impact performance
- Consider setting `LOG_FULL_RECORD_JSON = false` for production environments
- The scripts include traditional Chinese (繁體中文) comments and interface elements
- Performance tracking helps identify bottlenecks in record operations
- Modular design allows for easy customization and extension

## Project Structure

```
SuiteScripts/
└── temp/
    └── Dev Tool/
        ├── SL_record_json_view.js        # Enhanced Record JSON viewer Suitelet
        ├── UE_check_record_info.js       # Enhanced Record info User Event script
        └── modules/
            ├── HTMLTemplateService.js    # Advanced HTML template generation
            ├── PerformanceTracker.js    # Performance monitoring and timing
            ├── RecordComparisonService.js # Record comparison functionality
            └── RecordDataService.js      # Record data loading and processing

Objects/
├── customscriptsl_record_json_view.xml   # Suitelet deployment configuration
└── customscriptue_check_record_info.xml  # User Event deployment configuration
```

## License

This project is for internal use within NetSuite environments. No specific license is provided.


# NetSuite 開發工具

## 概述

本項目提供了一套全面的 NetSuite 開發工具，用於幫助調試、記錄檢查和開發。這些工具使開發人員能夠：

1. 以 JSON 格式查看完整記錄數據，具有高級 UI
2. 並排比較記錄
3. 監控記錄變更和腳本執行
4. 以多種格式導出數據（JSON、CSV）
5. 在開發和故障排除過程中輕鬆訪問記錄數據

## 組件

### 1. 增強型記錄 JSON 查看器 (SL_record_json_view.js)

一個模組化的 Suitelet 腳本，提供高級網頁界面來查看 NetSuite 記錄數據，具有增強功能。

**功能：**
- **高級 UI**：現代化、響應式界面，支持深色模式
- **完整記錄數據**：查看所有字段和子列表，包含標籤和元數據
- **字段瀏覽器**：結構化表格視圖，支持搜索和過濾
- **記錄比較**：並排比較兩個記錄
- **多種導出格式**：JSON、CSV 和 Excel 就緒的導出
- **性能跟踪**：內建性能監控
- **書籤小工具**：從任何 NetSuite 記錄快速訪問
- **模組化架構**：清潔、可維護的代碼結構

### 2. 增強型記錄信息用戶事件腳本 (UE_check_record_info.js)

一個高級用戶事件腳本，提供全面的日誌記錄和記錄檢查功能。

**功能：**
- **詳細執行日誌**：完整的上下文跟踪（beforeLoad、beforeSubmit、afterSubmit）
- **字段變更跟踪**：監控和記錄所有字段變更，包含標籤
- **記錄查看器集成**：與記錄查看器直接按鈕集成
- **角色名稱解析**：自動角色名稱查找
- **批量更新檢測**：批量更新操作的特殊處理
- **完整 JSON 日誌**：可選的完整記錄 JSON 日誌記錄到腳本日誌
- **性能監控**：執行時間和使用量跟踪

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
   - **原始 JSON 格式**：添加 `&format=json` 獲取直接 JSON 輸出
   - **深色模式**：添加 `&darkMode=true` 啟用深色主題

2. **使用書籤小工具**
   - 在瀏覽器中創建一個包含 Suitelet 提供的 JavaScript 代碼的書籤
   - 在查看 NetSuite 記錄時，點擊書籤小工具打開 JSON 查看器
   - 自動檢測當前頁面的記錄類型和 ID

3. **使用記錄表單上的按鈕**
   - 當用戶事件腳本部署後，記錄表單上會出現「查看記錄 JSON」按鈕
   - 點擊此按鈕查看當前記錄的 JSON 數據

4. **高級功能**
   - **字段搜索**：使用搜索框按名稱或值過濾字段
   - **記錄比較**：輸入另一個記錄 ID 來並排比較兩個記錄
   - **導出選項**：將數據下載為 JSON 或 CSV 文件
   - **深色模式切換**：在淺色和深色主題之間切換
   - **性能統計**：查看加載時間和性能指標

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

## 高級功能

### 性能優化
- **子列表截斷**：大型子列表會自動截斷以提高性能（可配置限制）
- **字段過濾**：可選的字段過濾以減少數據負載
- **性能跟踪**：所有操作的內建計時
- **高效數據處理**：優化的記錄加載和處理

### 用戶界面增強
- **響應式設計**：在桌面和移動設備上都能正常工作
- **深色模式**：在淺色和深色主題之間切換，具有持久性
- **交互元素**：可展開的長文本、可搜索字段、標籤界面
- **導出功能**：多種導出格式（JSON、CSV、Excel 就緒）
- **實時搜索**：即時字段過濾和搜索

### 開發功能
- **模組化架構**：清潔的關注點分離，便於維護
- **錯誤處理**：全面的錯誤處理和用戶反饋
- **日誌集成**：用於調試和監控的詳細日誌
- **書籤小工具支持**：從任何 NetSuite 記錄快速訪問
- **比較工具**：並排記錄比較功能

## 項目結構

```
SuiteScripts/
└── temp/
    └── Dev Tool/
        ├── SL_record_json_view.js        # 增強型記錄 JSON 查看器 Suitelet
        ├── UE_check_record_info.js       # 增強型記錄信息用戶事件腳本
        └── modules/
            ├── HTMLTemplateService.js    # 高級 HTML 模板生成
            ├── PerformanceTracker.js      # 性能監控和計時
            ├── RecordComparisonService.js # 記錄比較功能
            └── RecordDataService.js      # 記錄數據加載和處理

Objects/
├── customscriptsl_record_json_view.xml   # Suitelet 部署配置
└── customscriptue_check_record_info.xml  # 用戶事件部署配置
```

## 授權

本項目供 NetSuite 環境內部使用。未提供特定授權。
