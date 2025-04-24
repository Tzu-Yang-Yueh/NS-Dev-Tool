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
