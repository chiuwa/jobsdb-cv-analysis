# JobsDB CV Analysis Chrome Extension

一個智能的Chrome擴展程序，可以自動提取多個求職網站的職位信息，並通過AI分析您的CV與職位的匹配度。
上架啦: https://chromewebstore.google.com/detail/jobsdb-cv-analysis/mamnnehbnghmnbjhbencjcknmkmccmdc?pli=1
## 🎥 功能演示

### 📺 影片演示
[![JobsDB CV Analysis 演示影片](https://img.youtube.com/vi/EEyVj6jnGm8/maxresdefault.jpg)](https://www.youtube.com/watch?v=EEyVj6jnGm8)

*點擊上方圖片觀看完整功能演示*

### 📸 功能截圖

🔍 查看功能截圖

![螢幕擷取畫面 2025-06-04 120757](https://github.com/user-attachments/assets/44e4e408-5a7c-4051-a66e-cdfeba2739b5)

![image](https://github.com/user-attachments/assets/09e35a7e-9df3-4c88-bb57-e6f0c799efba)



![image](https://github.com/user-attachments/assets/6a9717fe-1ebf-4bb5-8f19-058b90b36621)


## ✨ 功能特點

### 🌐 多網站支援
- **完全支援**: JobsDB (香港/台灣/新加坡)
- **智能檢測**: 自動判斷網站類型並載入相應的提取器

### 📄 智能職位提取
- **專用提取器**: 針對JobsDB優化的高精度提取
- **通用提取器**: 支援其他求職網站的基本信息提取
- **多策略提取**: 智能處理結構化和非結構化內容
- **中文優化**: 增強的中文職責和要求識別

### 💼 CV管理系統
- **格式支援**: PDF
- **多CV管理**: 上傳和切換多個CV文件
- **智能儲存**: 安全的本地存儲機制
- **大小限制**: 最大10MB文件支援

### 🤖 AI智能分析
- **匹配度評分**: 0-100%的精確匹配度評估
- **詳細分析**: 結構化的優勢和改進建議
- **智能解析**: 自動格式化AI分析結果
- **中文支援**: 完全中文化的分析報告


## 🏗️ 技術架構


### 目錄結構
```
src/
├── services/                 # 服務層
│   ├── LoggerService.js     # 統一日誌服務
│   ├── ApiService.js        # N8n API通信
│   └── CVService.js         # CV檔案管理
├── extractors/              # 職位提取器
│   ├── JobsDBExtractor.js   # JobsDB專用提取器
│   └── GenericJobExtractor.js # 通用網站提取器
├── content/                 # 內容腳本
│   └── jobExtractor.js      # 主要內容腳本
├── background/              # 背景服務
│   └── serviceWorker.js     # 服務工作者
├── popup/                   # 彈出視窗
│   ├── popup.html          # 使用者界面
│   ├── popup.js            # 邏輯處理
│   └── popup.css           # 樣式設計
└── styles/                  # 共用樣式
    └── content.css         # 內容腳本樣式
```

## 🚀 快速開始

### 1. 安裝擴展

#### 方法一：從源碼安裝
```bash
# 下載源碼
git clone https://github.com/chiuwa/jobsdb-cv-analysis.git
cd jobsdb-cv-analysis

# 在Chrome中載入
# 1. 打開 chrome://extensions/
# 2. 啟用 "開發者模式"
# 3. 點擊 "載入已解壓的擴充功能"
# 4. 選擇專案資料夾
```

### 2. 配置N8n API

1. **取得N8n Webhook URL**
   ```
   https://your-n8n-instance.com/webhook/jobsdb-cv-analysis
   ```

2. **在擴展中配置**
   - 點擊擴展圖示 🎯
   - 點擊設定按鈕 ⚙️
   - 填入Webhook URL和API Key（可選）
   - 點擊"測試連接"
   - 儲存設定

### 3. 準備您的CV
- 支援格式：PDF
- 檔案大小：最大10MB
- 建議：使用結構清晰的CV格式

## 🔧 N8n工作流程設定

### 基本工作流程
sample : **https://github.com/chiuwa/jobsdb-cv-analysis/blob/main/n8n-test-workflow.json**
![image](https://github.com/user-attachments/assets/628b7474-d2c1-4e50-8483-92fe1ffadf76)
你可以使用其他任意AI mdeol 


## 📖 使用指南

### 基本流程

1. **瀏覽職位**
   ```
   支援網站：
   ✅ JobsDB (hk/tw/sg.jobsdb.com) - 完全支援

   ```

2. **提取職位資訊**
   - 點擊 "🔍 提取資訊" 按鈕
   - 系統自動分析職位職責和要求
   - 查看提取結果

3. **上傳CV**
   - 點擊 "📁 上傳CV" 按鈕
   - 選擇您的CV檔案
   - 等待上傳完成

4. **開始分析**
   - 點擊 "🔍 開始分析匹配度" 按鈕
   - 等待AI分析（通常1-2分鐘）
   - 查看詳細分析報告

### 進階功能

- **CV管理**: 上傳多個CV並隨時切換
- **資料匯出**: 匯出分析結果和CV資料
- **除錯工具**: 內建的診斷和測試工具
- **網站支援檢查**: 即時檢查當前網站支援狀態

## 🌍 支援的網站

| 網站 | 支援程度 | 功能 |
|------|---------|------|
| JobsDB 香港/台灣/新加坡 | ✅ 完全支援 | 專用提取器、高精度分析 |


## 🔒 隱私與安全

### 資料保護
- ✅ **本地處理**: 所有CV資料在您的裝置上處理
- ✅ **自主N8n**: 分析通過您自己的N8n實例進行
- ✅ **無第三方**: 不會將資料傳送到未授權伺服器
- ✅ **可刪除**: 隨時清除所有本地資料

### 安全措施
- 🔐 檔案大小限制防止濫用
- 🔐 內容腳本隔離保護
- 🔐 加密儲存敏感設定
- 🔐 HTTPS通信保證傳輸安全

## 🛠️ 故障排除

### 常見問題

**❓ "Could not establish connection" 錯誤**
```
解決方案：
1. 確認當前網站是否在支援列表中
2. 重新整理頁面後重試
3. 檢查擴展是否正確載入
4. 對於部分支援的網站，請多嘗試幾次
```

**❓ 分析結果顯示 "0%" 或錯誤評分**
```
可能原因：
- N8n API配置錯誤
- AI回應格式不符預期
- 網路連線問題

解決方案：
1. 檢查N8n工作流程配置
2. 確認Webhook URL正確
3. 查看瀏覽器開發者工具的錯誤訊息
```

**❓ CV上傳失敗**
```
檢查項目：
- 檔案大小是否超過10MB
- 檔案格式是否受支援
- 網路連線是否穩定
- N8n實例是否正常運作
```

### 除錯模式

1. **開啟開發者工具**: F12 或右鍵 → 檢查
2. **查看主控台**: Console標籤
3. **過濾訊息**: 搜尋 "🔍 DEBUG" 或 "JobsDB"
4. **分析錯誤**: 查看紅色錯誤訊息

### 測試工具

擴展內建了測試頁面：
- `test-responsibilities-debug.html` - 職責提取測試
- `test-website-support.html` - 網站支援狀態檢查

## 👩‍💻 開發指南

### 本地開發環境

```bash
# 複製專案
git clone https://github.com/chiuwa/jobsdb-cv-analysis.git
cd jobsdb-cv-analysis

# 在Chrome中載入進行測試
# 修改程式碼後重新載入擴展即可
```


### 擴展新網站支援

1. **建立新提取器**
   ```javascript
   class NewSiteExtractor {
     constructor(logger) {
       this.logger = logger;
     }
     
     async extractJobInfo() {
       // 實現提取邏輯
     }
   }
   ```

2. **更新manifest.json**
   ```json
   {
     "content_scripts": [{
       "matches": ["https://newsite.com/*"],
       "js": ["src/extractors/NewSiteExtractor.js"]
     }]
   }
   ```

3. **測試和驗證**
   - 使用內建除錯工具
   - 確保錯誤處理完善
   - 提供降級方案

## 📈 更新日誌

### v1.0.0 (2024-12-19)
- 🎉 **初始發布**: 完整的JobsDB支援和AI分析功能
- ✨ **多網站支援**: 擴展至政府職位網、Indeed等網站
- ✨ **智能提取**: 多策略職責和要求提取系統
- ✨ **UI優化**: 現代化界面設計和用戶體驗改進
- ✨ **除錯工具**: 內建診斷和測試功能
- 🐛 **錯誤修復**: 解決API響應格式不匹配問題
- 🐛 **顯示優化**: 統一評分格式為百分比顯示
- 🔧 **效能改進**: 優化CV上傳和儲存機制

## 🤝 貢獻

歡迎各種形式的貢獻！

### 貢獻方式
- 🐛 **回報問題**: 在GitHub Issues中回報Bug
- 💡 **功能建議**: 提出新功能想法
- 🔧 **程式碼貢獻**: 提交Pull Request
- 📖 **文件改進**: 完善使用說明和API文件

### 開發流程
1. Fork本專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 建立Pull Request

## 📄 授權

本專案採用MIT授權 - 詳見 [LICENSE](LICENSE) 檔案

## 📞 聯絡方式

- **專案**: [GitHub Repository](https://github.com/chiuwa/jobsdb-cv-analysis)
- **問題回報**: [GitHub Issues](https://github.com/chiuwa/jobsdb-cv-analysis/issues)
- **討論**: [GitHub Discussions](https://github.com/chiuwa/jobsdb-cv-analysis/discussions)

---

⭐ 如果這個專案對您有幫助，請給我們一個Star！ 
