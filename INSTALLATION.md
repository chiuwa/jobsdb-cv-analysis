# 快速安裝指南

## 前置要求

- Chrome瀏覽器 (版本88+)
- N8n實例 (可選，用於AI分析功能)

## 步驟1：準備擴展文件

### 創建必要的圖標文件

在開始之前，你需要創建擴展圖標。最快的方法：

1. 訪問 [Favicon Generator](https://favicon.io/emoji-favicons/direct-hit/)
2. 選擇🎯 emoji
3. 下載生成的文件
4. 將以下文件重命名並放入 `icons/` 目錄：
   - `android-chrome-192x192.png` → `icon128.png`
   - `favicon-32x32.png` → `icon48.png`
   - `favicon-16x16.png` → `icon16.png`

或者直接使用在線工具生成：
```bash
# 創建簡單的佔位圖標 (如果你有ImageMagick)
convert -size 16x16 xc:blue icons/icon16.png
convert -size 48x48 xc:blue icons/icon48.png
convert -size 128x128 xc:blue icons/icon128.png
```

## 步驟2：安裝到Chrome

1. **打開Chrome擴展管理頁面**
   - 在地址欄輸入：`chrome://extensions/`
   - 或者：更多工具 → 擴展程序

2. **啟用開發者模式**
   - 點擊右上角的"開發者模式"開關

3. **加載擴展**
   - 點擊"加載已解壓的擴展程序"
   - 選擇這個項目的根目錄 (`jobsdb-extention`)
   - 點擊"選擇文件夾"

4. **確認安裝**
   - 擴展應該出現在列表中
   - 確保它已啟用（開關打開）

## 步驟3：基本測試

### 測試1：擴展基本功能

1. 點擊Chrome工具欄中的擴展圖標
2. 應該看到彈出窗口顯示
3. 檢查各個部分是否正常顯示

### 測試2：JobsDB頁面集成

1. 打開任何JobsDB職位頁面，例如：
   - https://hk.jobsdb.com/job/
   - https://tw.jobsdb.com/job/

2. 頁面加載完成後，右側應該出現"CV匹配分析"面板

3. 點擊面板頭部可以展開/收起

### 測試3：CV上傳功能

1. 在JobsDB頁面的分析面板中點擊"上傳CV"
2. 選擇一個測試文件（PDF、DOC、DOCX或TXT）
3. 確認文件上傳處理正常

## 步驟4：N8n配置 (可選)

如果你想使用AI分析功能，需要設置N8n：

### 快速N8n設置

1. **安裝N8n**
   ```bash
   npm install n8n -g
   n8n start
   ```

2. **創建基本工作流**
   - 訪問 http://localhost:5678
   - 創建新工作流
   - 添加Webhook節點：
     - HTTP Method: POST
     - Path: jobsdb-cv-matcher
   - 添加響應節點

3. **配置擴展**
   - 點擊擴展圖標 → 設置
   - API URL: `http://localhost:5678/webhook/jobsdb-cv-matcher`
   - API Key: 留空（測試環境）
   - 點擊"測試連接"

### 高級AI分析工作流

如果你有OpenAI API Key：

```json
{
  "nodes": [
    {
      "parameters": {
        "path": "jobsdb-cv-matcher",
        "httpMethod": "POST"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook"
    },
    {
      "parameters": {
        "operation": "chat",
        "model": "gpt-3.5-turbo",
        "messages": [
          {
            "role": "system",
            "content": "你是一個專業的HR顧問。請分析求職者的CV與職位要求的匹配度，並提供0-100的匹配分數和具體建議。回應格式必須是JSON：{\"matchScore\": 85, \"recommendations\": [\"建議1\", \"建議2\"], \"strengths\": [\"優勢1\"], \"improvements\": [\"改進1\"]}"
          },
          {
            "role": "user", 
            "content": "職位要求：{{ $json.job.requirements.join(', ') }}\n職位職責：{{ $json.job.responsibilities.join(', ') }}\nCV信息：{{ $json.cv.name }}"
          }
        ]
      },
      "name": "OpenAI",
      "type": "n8n-nodes-base.openAi"
    },
    {
      "parameters": {
        "responseMode": "responseNode",
        "responseData": "={{ JSON.parse($json.message.content) }}"
      },
      "name": "Response",
      "type": "n8n-nodes-base.respondToWebhook"
    }
  ]
}
```

## 步驟5：功能測試檢查表

### ✅ 基本功能
- [ ] 擴展成功安裝
- [ ] 彈出窗口正常顯示
- [ ] 設置頁面可以打開和關閉
- [ ] API狀態正確顯示

### ✅ JobsDB集成
- [ ] 在JobsDB職位頁面自動顯示分析面板
- [ ] 職位信息正確提取（標題、公司、職責、要求）
- [ ] 面板可以展開收起

### ✅ CV管理
- [ ] 可以上傳CV文件
- [ ] CV信息正確保存和顯示
- [ ] 可以更換和刪除CV
- [ ] 統計信息正確顯示

### ✅ AI分析 (如果配置了N8n)
- [ ] API連接正常
- [ ] 分析請求成功發送
- [ ] 結果正確顯示
- [ ] 匹配分數和建議正常

## 常見問題解決

### 問題：擴展無法加載

**解決方案：**
1. 確認所有必要文件都存在
2. 檢查manifest.json語法是否正確
3. 查看Chrome擴展頁面的錯誤信息

### 問題：JobsDB頁面沒有顯示面板

**解決方案：**
1. 確認你在正確的JobsDB職位詳情頁面
2. 刷新頁面重試
3. 檢查瀏覽器控制台是否有錯誤

### 問題：API連接失敗

**解決方案：**
1. 確認N8n正在運行
2. 檢查URL格式是否正確
3. 確認防火牆沒有阻擋連接

### 調試技巧

1. **查看擴展日誌：**
   - 打開開發者工具 (F12)
   - 切換到Console標籤
   - 過濾 "JobsDB CV Matcher"

2. **檢查服務工作者：**
   - 訪問 `chrome://extensions/`
   - 點擊擴展的"詳細信息"
   - 點擊"檢查視圖 服務工作者"

3. **調試內容腳本：**
   - 在JobsDB頁面按F12
   - Console中查看相關日誌

## 下一步

安裝成功後，你可以：

1. **自定義設置**：調整擴展行為偏好
2. **設置N8n工作流**：實現更複雜的AI分析
3. **添加更多CV**：管理多個版本的履歷
4. **查看分析歷史**：跟蹤你的求職進度

## 開發模式

如果你想修改代碼：

1. **實時重載**：修改代碼後在擴展管理頁面點擊刷新按鈕
2. **查看更改**：重新訪問JobsDB頁面測試
3. **調試工具**：使用Chrome開發者工具調試

祝你使用愉快！🎯 