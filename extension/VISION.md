# Vision: Loggy

## Project Overview
**Loggy** is a specialized Chrome DevTools extension designed to capture, prune, and export high-signal debugging data. Unlike standard log dumpers, Loggy focuses on **Signal-to-Noise Ratio**, allowing developers to quickly move relevant browser state (Console & Network) into LLMs or issue trackers without hitting context window limits.

## Core Features
1. **Unified Capture:** One-click retrieval of both current Console Logs and Network HAR data.
2. **Dynamic Filtering:** - **Console Filter:** A string-based filter (regex supported) to include/exclude specific log patterns.
   - **Network Filter:** A string-based filter to isolate specific domains, endpoints, or file types (e.g., `api.v1`, `-*.png`).
3. **Data Pruning (The "Signal" Engine):**
   - Automatically strips binary data, base64 strings, and massive font/image blobs.
   - Truncates repetitive logs (e.g., "100 identical re-renders").
   - Minifies stack traces to focus on application code rather than library internals.
4. **Smart Export:**
   - Formats data into a structured Markdown schema optimized for LLM readability.
   - Automatically copies to the system clipboard upon triggering.

## User Interface (DevTools Panel)
- **Top Bar:** Two input fields for "Console Filter" and "Network Filter."
- **Center:** A live-updating "Preview" window showing a summarized version of what will be exported.
- **Bottom:** A prominent "Copy to Clipboard" button.

## Technical Architecture
- **Type:** Chrome DevTools Extension (Manifest V3).
- **APIs:** - `chrome.devtools.network.getHAR()` for network capture.
    - `chrome.devtools.inspectedWindow.eval()` for console log extraction.
    - `navigator.clipboard.writeText()` for the export.
- **Environment:** Designed for local "Developer Mode" installation for maximum privacy and performance.

## Target Output Format
```markdown
### Environment
- URL: [Current URL]
- Time: [Timestamp]

### Console Logs (Filtered)
[Timestamp] [Level] Message...

### Network Activity (Filtered Summary)
[Method] [Status] [Path]
- Request Payload: { ... }
- Response Summary: { ... }
