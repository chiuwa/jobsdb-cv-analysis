# N8n JobsDB CV Matcher 設置指南 (Direct Binary Processing)

## 概述
此指南說明如何設置 N8n 工作流程以接收 JobsDB CV Matcher 擴展傳送的職位資訊和 CV 文件。

更新：使用 **Direct Binary Processing** 方法，直接處理 raw body 中的 PDF 二進制數據，避免轉換步驟中的數據損壞。

## 📋 前置要求

- 已安裝並運行的 N8n 實例
- N8n 可通過網路訪問（本地或雲端）
- 基本的 N8n 工作流程建立知識

## 🔧 步驟 1：創建新的 N8n 工作流程

1. 登入您的 N8n 實例
2. 點擊 "New Workflow" 創建新工作流程
3. 為工作流程命名，例如：`JobsDB CV Matcher - Analysis`

## 🌐 步驟 2：設置 Webhook 節點

### 2.1 添加 Webhook 節點

1. 在工作流程畫布中點擊 "+" 添加新節點
2. 搜尋並選擇 "Webhook" 節點
3. 配置 Webhook 節點：

### 2.2 Webhook 配置

```json
{
  "httpMethod": "POST",
  "path": "jobsdb-cv-matcher/analyze-job-with-cv",
  "responseMode": "responseNode",
  "options": {
    "rawBody": true
  }
}
```

**重要設置說明：**
- **HTTP Method**: `POST`
- **Path**: `jobsdb-cv-matcher/analyze-job-with-cv` （必須完全一致）
- **Response Mode**: `Response Node` 或 `Last Node`
- **Response Data**: `JSON`
- **Raw Body**: `true`

### 2.3 取得 Webhook URL

設置完成後，N8n 會顯示 webhook URL，格式如：
```
http://your-n8n-domain:port/webhook/jobsdb-cv-matcher/analyze-job-with-cv
```

## 📤 步驟 3：處理接收的資料

Webhook 會接收包含以下資料的 FormData：

```javascript
{
  "jobDetails": "JSON string containing job information",
  "cvFile": "File object (PDF)",
  "timestamp": "ISO timestamp",
  "source": "jobsdb-extension"
}
```

### 3.1 解析 Job Details

添加 "Set" 節點來解析 jobDetails：

```json
{
  "parameters": {
    "keepOnlySet": false,
    "values": {
      "string": [
        {
          "name": "jobDetailsRaw",
          "value": "={{ $json.headers['x-job-details'] || 'No job details header' }}"
        },
        {
          "name": "cvFilename",
          "value": "={{ $json.headers['x-cv-filename'] || 'No filename header' }}"
        },
        {
          "name": "cvMimetype",
          "value": "={{ $json.headers['x-cv-mimetype'] || 'No mimetype header' }}"
        },
        {
          "name": "cvSize",
          "value": "={{ $json.headers['x-cv-size'] || 'No size header' }}"
        },
        {
          "name": "timestamp",
          "value": "={{ $json.headers['x-timestamp'] || 'No timestamp header' }}"
        },
        {
          "name": "source",
          "value": "={{ $json.headers['x-source'] || 'No source header' }}"
        }
      ],
      "boolean": [
        {
          "name": "hasBinaryData",
          "value": "={{ !!$json.body }}"
        }
      ],
      "number": [
        {
          "name": "bodyLength",
          "value": "={{ $json.body ? $json.body.length : 0 }}"
        }
      ]
    }
  }
}
```

### 3.2 解析職位資訊

添加另一個 "Set" 節點來解析職位資訊：

```json
{
  "parameters": {
    "keepOnlySet": false,
    "values": {
      "object": [
        {
          "name": "jobData",
          "value": "={{ JSON.parse($json.jobDetailsRaw || '{}') }}"
        }
      ],
      "string": [
        {
          "name": "jobTitle",
          "value": "={{ JSON.parse($json.jobDetailsRaw || '{}').title || 'No title' }}"
        },
        {
          "name": "jobCompany", 
          "value": "={{ JSON.parse($json.jobDetailsRaw || '{}').company || 'No company' }}"
        },
        {
          "name": "responsibilitiesCount",
          "value": "={{ (JSON.parse($json.jobDetailsRaw || '{}').responsibilities || []).length }}"
        },
        {
          "name": "requirementsCount",
          "value": "={{ (JSON.parse($json.jobDetailsRaw || '{}').requirements || []).length }}"
        }
      ]
    }
  }
}
```

### 3.3 設置二進制數據 (關鍵步驟)

添加 "Set" 節點 (version 3) 來直接設置二進制數據：

```json
{
  "parameters": {
    "keepOnlySet": false,
    "values": {
      "string": [
        {
          "name": "filename",
          "value": "={{ $('Extract Headers and Body').item.json.cvFilename }}"
        },
        {
          "name": "mimeType",
          "value": "={{ $('Extract Headers and Body').item.json.cvMimetype }}"
        }
      ]
    },
    "include": "none",
    "options": {
      "setBinaryData": {
        "data": {
          "fileName": "={{ $('Extract Headers and Body').item.json.cvFilename }}",
          "mimeType": "={{ $('Extract Headers and Body').item.json.cvMimetype }}",
          "data": "={{ $('Webhook').item.json.body }}"
        }
      }
    }
  }
}
```

**重要：** 
- 使用 Set 節點 v3 版本
- 在 Options > Set Binary Data 中配置
- 直接使用 `$('Webhook').item.json.body` 作為數據源

### 3.4 處理 PDF 文件

添加 "Extract From File" 節點來處理 PDF：

```json
{
  "parameters": {
    "action": "pdf",
    "options": {}
  }
}
```

現在您可以通過以下方式訪問數據：

- PDF 文件：`$binary.data`
- 提取的文字：`$json.text`
- 頁數：`$json.pages`

## 🤖 步驟 4：AI 分析邏輯

### 4.1 推薦的分析流程

1. **提取 CV 內容**：
   - 使用 PDF 解析節點
   - 提取文字內容

2. **準備分析提示**：
   ```javascript
   // 組合 job requirements 和 CV content
   const prompt = `
   分析以下職位要求和履歷的匹配度：
   
   職位要求：
   ${jobData.requirements.join('\n')}
   
   履歷內容：
   ${cvContent}
   
   請提供：
   1. 匹配度分數 (0-100)
   2. 優勢分析
   3. 改進建議
   `;
   ```

3. **調用 AI API**：
   - OpenAI GPT
   - Claude AI
   - 其他 AI 服務

### 4.2 回應格式

確保回應包含以下結構：

```json
{
  "success": true,
  "analysis": {
    "matchScore": 85,
    "strengths": [
      "具備相關技術經驗",
      "教育背景符合要求"
    ],
    "recommendations": [
      "建議加強專案管理經驗",
      "考慮取得相關證照"
    ],
    "improvements": [
      "履歷格式可以更清晰",
      "突出關鍵技能"
    ]
  }
}
```

## 🧪 步驟 5：測試 Webhook

### 5.1 N8n 內建測試

1. 在 Webhook 節點中點擊 "Listen for Test Event"
2. 工作流程會等待測試請求

### 5.2 從擴展測試

1. 確保 N8n 處於測試模式（listening）
2. 在擴展中配置 webhook URL：
   ```
   http://your-n8n-domain:port/webhook/jobsdb-cv-matcher/analyze-job-with-cv
   ```
3. 點擊 "測試連接" 按鈕
4. 嘗試分析功能

## 🔧 擴展配置

### API URL 配置選項

**選項 1：完整 Webhook URL**
```
http://localhost:5678/webhook/jobsdb-cv-matcher/analyze-job-with-cv
```

**選項 2：基礎 URL（推薦）**
```
http://localhost:5678
```
系統會自動添加 `/webhook/jobsdb-cv-matcher/analyze-job-with-cv`

## 🐛 常見問題排解

### 問題 1：404 Webhook Not Found

**原因：**
- Webhook path 不匹配
- 工作流程未啟動
- N8n 未運行

**解決方案：**
1. 確認 webhook path 為：`jobsdb-cv-matcher/analyze-job-with-cv`
2. 啟動工作流程
3. 檢查 N8n 服務狀態

### 問題 2：測試模式限制

**原因：**
N8n 測試模式只允許一次調用

**解決方案：**
1. 點擊 "Listen for Test Event" 重新啟動測試
2. 或者正式激活工作流程

### 問題 3：CORS 錯誤

**原因：**
瀏覽器 CORS 政策限制

**解決方案：**
在 N8n 設置中配置 CORS：
```json
{
  "endpoints": {
    "webhook": {
      "cors": {
        "enabled": true,
        "origin": "*"
      }
    }
  }
}
```

## 📝 完整範例工作流程

### 4. 完整工作流程範例

使用提供的 `n8n-test-workflow.json` 文件，此工作流程包含：

1. **Webhook** - 接收 binary 請求
2. **Extract Headers and Body** - 提取 headers 和 body 信息
3. **Parse Job Data** - 解析職位資訊
4. **Set Binary Data** - 直接設置二進制文件數據
5. **Extract PDF Text** - 提取 PDF 文字內容
6. **Respond with Results** - 返回處理結果

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "jobsdb-cv-matcher/analyze-job-with-cv",
        "responseMode": "responseNode"
      }
    },
    {
      "name": "Extract Headers and Body",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "keepOnlySet": false,
        "values": {
          "string": [
            {
              "name": "jobDetailsRaw",
              "value": "={{ $json.headers['x-job-details'] || 'No job details header' }}"
            },
            {
              "name": "cvFilename",
              "value": "={{ $json.headers['x-cv-filename'] || 'No filename header' }}"
            },
            {
              "name": "cvMimetype",
              "value": "={{ $json.headers['x-cv-mimetype'] || 'No mimetype header' }}"
            },
            {
              "name": "cvSize",
              "value": "={{ $json.headers['x-cv-size'] || 'No size header' }}"
            },
            {
              "name": "timestamp",
              "value": "={{ $json.headers['x-timestamp'] || 'No timestamp header' }}"
            },
            {
              "name": "source",
              "value": "={{ $json.headers['x-source'] || 'No source header' }}"
            }
          ],
          "boolean": [
            {
              "name": "hasBinaryData",
              "value": "={{ !!$json.body }}"
            }
          ],
          "number": [
            {
              "name": "bodyLength",
              "value": "={{ $json.body ? $json.body.length : 0 }}"
            }
          ]
        }
      }
    },
    {
      "name": "Parse Job Data",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "parameters": {
          "keepOnlySet": false,
          "values": {
            "object": [
              {
                "name": "jobData",
                "value": "={{ JSON.parse($json.jobDetailsRaw || '{}') }}"
              }
            ],
            "string": [
              {
                "name": "jobTitle",
                "value": "={{ JSON.parse($json.jobDetailsRaw || '{}').title || 'No title' }}"
              },
              {
                "name": "jobCompany", 
                "value": "={{ JSON.parse($json.jobDetailsRaw || '{}').company || 'No company' }}"
              },
              {
                "name": "responsibilitiesCount",
                "value": "={{ (JSON.parse($json.jobDetailsRaw || '{}').responsibilities || []).length }}"
              },
              {
                "name": "requirementsCount",
                "value": "={{ (JSON.parse($json.jobDetailsRaw || '{}').requirements || []).length }}"
              }
            ]
          }
        }
      }
    },
    {
      "name": "Set Binary Data",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "keepOnlySet": false,
        "values": {
          "string": [
            {
              "name": "filename",
              "value": "={{ $('Extract Headers and Body').item.json.cvFilename }}"
            },
            {
              "name": "mimeType",
              "value": "={{ $('Extract Headers and Body').item.json.cvMimetype }}"
            }
          ]
        },
        "include": "none",
        "options": {
          "setBinaryData": {
            "data": {
              "fileName": "={{ $('Extract Headers and Body').item.json.cvFilename }}",
              "mimeType": "={{ $('Extract Headers and Body').item.json.cvMimetype }}",
              "data": "={{ $('Webhook').item.json.body }}"
            }
          }
        }
      }
    },
    {
      "name": "Extract PDF Text",
      "type": "n8n-nodes-base.extractFromFile",
      "parameters": {
        "action": "pdf",
        "options": {}
      }
    },
    {
      "name": "AI Analysis",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "operation": "chat",
        "messages": {
          "messageType": "content",
          "content": "分析職位和履歷匹配度..."
        }
      }
    },
    {
      "name": "Response",
      "type": "n8n-nodes-base.respond",
      "parameters": {
        "responseBody": {
          "success": true,
          "analysis": "={{ $json }}"
        }
      }
    }
  ]
}
```

## 🚀 生產環境建議

1. **安全性**：
   - 設置 API 金鑰認證
   - 使用 HTTPS
   - 限制來源 IP

2. **效能**：
   - 設置合理的超時時間
   - 考慮快取機制
   - 監控資源使用

3. **可靠性**：
   - 實施錯誤處理
   - 設置重試機制
   - 記錄詳細日誌

---

如果您在設置過程中遇到問題，請檢查 N8n 日誌和擴展的開發者工具控制台以獲取更多資訊。 