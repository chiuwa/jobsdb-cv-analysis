/**
 * Popup script for JobsDB CV Matcher extension
 * Follows Single Responsibility Principle - handles popup UI interactions
 */

// Initialize logger
const logger = new LoggerService('Popup');

/**
 * Popup application controller
 * Manages the popup interface and user interactions
 */
class PopupApp {
  constructor() {
    this.isInitialized = false;
    this.currentApiStatus = null;
    this.currentCVList = [];
    this.currentCV = null;
  }

  /**
   * Initializes the popup application
   */
  async init() {
    try {
      logger.info('Initializing popup application');

      // Set up event listeners
      this.setupEventListeners();

      // Load initial data
      await this.loadInitialData();

      // Update UI
      this.updateUI();

      // Hide loading and show main content
      this.showMainContent();

      this.isInitialized = true;
      logger.info('Popup application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize popup application', error);
      this.showError('初始化失敗：' + error.message);
    }
  }

  /**
   * Sets up event listeners for UI elements
   */
  setupEventListeners() {
    try {
      // Header actions
      document.getElementById('refresh-btn').addEventListener('click', this.refreshData.bind(this));
      document.getElementById('settings-btn').addEventListener('click', this.showSettings.bind(this));
      document.getElementById('close-settings-btn').addEventListener('click', this.hideSettings.bind(this));

      // Job extraction
      document.getElementById('extract-job-btn').addEventListener('click', this.extractJobInfo.bind(this));

      // CV Upload
      document.getElementById('upload-cv-btn').addEventListener('click', this.triggerFileUpload.bind(this));
      document.getElementById('upload-first-cv-btn').addEventListener('click', this.triggerFileUpload.bind(this));
      document.getElementById('change-cv-btn').addEventListener('click', this.triggerFileUpload.bind(this));
      document.getElementById('cv-file-input').addEventListener('change', this.handleFileUpload.bind(this));

      // API Configuration
      document.getElementById('api-config-form').addEventListener('submit', this.handleApiConfig.bind(this));
      document.getElementById('test-connection-btn').addEventListener('click', this.testApiConnection.bind(this));
      document.getElementById('toggle-api-key').addEventListener('click', this.toggleApiKeyVisibility.bind(this));

      // Quick Actions
      document.getElementById('open-jobsdb-btn').addEventListener('click', this.openJobsDB.bind(this));
      document.getElementById('view-history-btn').addEventListener('click', this.viewHistory.bind(this));

      // Data Management
      document.getElementById('export-data-btn').addEventListener('click', this.exportData.bind(this));
      document.getElementById('clear-data-btn').addEventListener('click', this.clearData.bind(this));

      // CV Management
      document.getElementById('clear-all-cvs-btn').addEventListener('click', this.clearAllCVs.bind(this));

      // Debug Tools
      document.getElementById('debug-cv-btn').addEventListener('click', this.debugCVData.bind(this));
      document.getElementById('debug-job-extraction-btn').addEventListener('click', this.debugJobExtraction.bind(this));

      document.getElementById('analyze-btn').addEventListener('click', this.handleAnalyzeClick.bind(this));

      logger.debug('Event listeners set up');
    } catch (error) {
      logger.error('Failed to set up event listeners', error);
    }
  }

  /**
   * Loads initial data from background script
   */
  async loadInitialData() {
    try {
      // Load API status
      await this.loadApiStatus();

      // Load CV data
      await this.loadCVData();

      // Load settings
      await this.loadSettings();

      logger.debug('Initial data loaded');
    } catch (error) {
      logger.error('Failed to load initial data', error);
    }
  }

  /**
   * Loads API status
   */
  async loadApiStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getApiStatus' });
      
      if (response && response.success) {
        this.currentApiStatus = response.status;
      } else {
        logger.warn('Failed to get API status', response?.error);
      }
    } catch (error) {
      logger.error('Error loading API status', error);
    }
  }

  /**
   * Loads CV data
   */
  async loadCVData() {
    try {
      const [cvListResponse, currentCVResponse] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getCVList' }),
        chrome.runtime.sendMessage({ action: 'getCurrentCV' })
      ]);

      if (cvListResponse && cvListResponse.success) {
        this.currentCVList = cvListResponse.cvList || [];
        this.cvStats = cvListResponse.stats || {};
      } else {
        this.currentCVList = [];
        this.cvStats = {};
      }

      if (currentCVResponse && currentCVResponse.success && currentCVResponse.cv) {
        this.currentCV = currentCVResponse.cv;
      } else {
        this.currentCV = null;
      }

      logger.debug('CV data loaded', {
        cvCount: this.currentCVList.length,
        hasCurrentCV: !!this.currentCV
      });
    } catch (error) {
      this.currentCVList = [];
      this.currentCV = null;
      logger.error('Error loading CV data', error);
    }
  }

  /**
   * Loads user settings
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['userSettings', 'apiConfig']);
      
      const settings = result.userSettings || {};
      const apiConfig = result.apiConfig || {};

      // Update settings form
      document.getElementById('auto-extract').checked = settings.autoExtract !== false;
      document.getElementById('show-notifications').checked = settings.showNotifications !== false;

      // Update API config form
      if (apiConfig.baseUrl) {
        document.getElementById('api-url').value = apiConfig.baseUrl;
      }
      if (apiConfig.apiKey) {
        document.getElementById('api-key').value = apiConfig.apiKey;
      }

      logger.debug('Settings loaded');
    } catch (error) {
      logger.error('Error loading settings', error);
    }
  }

  /**
   * Updates the UI with current data
   */
  updateUI() {
    try {
      // Update API status
      this.updateApiStatus();

      // Update CV section
      this.updateCVSection();

      // Update statistics
      this.updateStatistics();

      logger.debug('UI updated');
    } catch (error) {
      logger.error('Failed to update UI', error);
    }
  }

  /**
   * Updates API status display
   */
  updateApiStatus() {
    const statusElement = document.getElementById('api-status');
    const errorElement = document.getElementById('api-error');
    const statusDot = statusElement.querySelector('.status-dot');
    const statusText = statusElement.querySelector('.status-text');

    if (!this.currentApiStatus) {
      statusDot.className = 'status-dot status-unknown';
      statusText.textContent = '未知狀態';
      return;
    }

    if (this.currentApiStatus.isConfigured && this.currentApiStatus.connectionStatus) {
      statusDot.className = 'status-dot status-connected';
      statusText.textContent = '已連接';
      errorElement.style.display = 'none';
    } else if (this.currentApiStatus.isConfigured) {
      statusDot.className = 'status-dot status-error';
      statusText.textContent = '連接失敗';
      errorElement.style.display = 'block';
      document.getElementById('api-error-text').textContent = 'API連接失敗，請檢查配置';
    } else {
      statusDot.className = 'status-dot status-not-configured';
      statusText.textContent = '未配置';
      errorElement.style.display = 'block';
      document.getElementById('api-error-text').textContent = '請配置N8n API以使用AI分析功能';
    }
  }

  /**
   * Updates CV section display
   */
  updateCVSection() {
    const currentCVElement = document.getElementById('current-cv');
    const noCVElement = document.getElementById('no-cv');
    const cvListElement = document.getElementById('cv-list');

    if (this.currentCV) {
      // Show current CV
      currentCVElement.style.display = 'block';
      noCVElement.style.display = 'none';
      
      document.getElementById('current-cv-name').textContent = this.currentCV.name;
      document.getElementById('current-cv-meta').textContent = 
        `${this.formatFileSize(this.currentCV.size)} • ${this.formatDate(this.currentCV.uploadedAt)}`;
    } else {
      // Show no CV message
      currentCVElement.style.display = 'none';
      noCVElement.style.display = 'block';
    }

    // Show CV list if there are multiple CVs
    if (this.currentCVList.length > 1) {
      cvListElement.style.display = 'block';
      this.updateCVList();
    } else {
      cvListElement.style.display = 'none';
    }
  }

  /**
   * Updates CV list display
   */
  updateCVList() {
    const container = document.getElementById('cv-items');
    container.innerHTML = '';

    this.currentCVList.forEach(cv => {
      const item = document.createElement('div');
      item.className = 'cv-item';
      if (this.currentCV && cv.id === this.currentCV.id) {
        item.classList.add('current');
      }

      item.innerHTML = `
        <div class="cv-item-info">
          <div class="cv-item-name">${cv.name}</div>
          <div class="cv-item-meta">${this.formatFileSize(cv.size)} • ${this.formatDate(cv.uploadedAt)}</div>
        </div>
        <div class="cv-item-actions">
          ${this.currentCV && cv.id === this.currentCV.id ? 
            '<span class="current-badge">當前</span>' : 
            `<button class="btn-link select-cv-btn">選擇</button>`
          }
          <button class="btn-link text-danger remove-cv-btn">刪除</button>
        </div>
      `;

      // 綁定事件
      if (!(this.currentCV && cv.id === this.currentCV.id)) {
        item.querySelector('.select-cv-btn').addEventListener('click', () => this.setCurrentCV(cv.id));
      }
      item.querySelector('.remove-cv-btn').addEventListener('click', () => this.removeCV(cv.id));

      container.appendChild(item);
    });
  }

  /**
   * Updates statistics display
   */
  updateStatistics() {
    if (this.currentCVList.length > 0) {
      document.getElementById('cv-stats').style.display = 'block';
      document.getElementById('total-cvs').textContent = this.currentCVList.length;
      document.getElementById('total-size').textContent = 
        this.formatFileSize(this.cvStats.totalFileSize || 0);
      
      // 顯示CV管理動作按鈕
      document.getElementById('cv-actions').style.display = 'block';
    } else {
      document.getElementById('cv-stats').style.display = 'none';
      document.getElementById('cv-actions').style.display = 'none';
    }
  }

  /**
   * Shows main content and hides loading
   */
  showMainContent() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
  }

  /**
   * Shows settings panel
   */
  showSettings() {
    document.getElementById('settings-panel').style.display = 'block';
  }

  /**
   * Hides settings panel
   */
  hideSettings() {
    document.getElementById('settings-panel').style.display = 'none';
  }

  /**
   * Triggers file upload dialog
   */
  triggerFileUpload() {
    const input = document.getElementById('cv-file-input');
    if (input) {
      input.value = '';
      input.click();
    } else {
      this.showError('找不到檔案上傳元件，請重新整理頁面');
    }
  }

  /**
   * Handles file upload
   */
  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
      logger.debug('No file selected');
      return;
    }

    logger.info('Handling file upload', { name: file.name, size: file.size, type: file.type });
    this.showMessage('正在處理文件...', 'loading'); // Show loading message

    try {
      // 1. Validate file (client-side basic validation if needed, or rely on service worker)
      // For now, we rely on service worker for detailed validation.

      // 2. Read file content as ArrayBuffer here in popup.js
      logger.debug('Starting to read file as ArrayBuffer...');
      const fileContent = await this.readFileAsArrayBuffer(file);

      if (!fileContent) {
        throw new Error('無法讀取文件內容。');
      }

      logger.debug('File read successfully', {
        fileName: file.name,
        originalSize: file.size,
        arrayBufferSize: fileContent.byteLength,
        sizesMatch: file.size === fileContent.byteLength,
        isArrayBuffer: fileContent instanceof ArrayBuffer
      });

      // 驗證 ArrayBuffer 內容
      if (fileContent.byteLength >= 4) {
        const headerView = new Uint8Array(fileContent, 0, 4);
        const header = String.fromCharCode(...headerView);
        logger.debug('File header check', { 
          header: header,
          isPDF: header === '%PDF',
          firstBytes: Array.from(headerView).map(b => b.toString(16)).join(' ')
        });
      }

      // 3. Convert ArrayBuffer to Uint8Array for Chrome message passing
      // Chrome's message passing doesn't handle ArrayBuffer well, so we convert it
      const uint8Array = new Uint8Array(fileContent);
      
      logger.debug('Converted ArrayBuffer to Uint8Array for message passing', {
        originalArrayBufferSize: fileContent.byteLength,
        uint8ArrayLength: uint8Array.length,
        typesMatch: fileContent.byteLength === uint8Array.length,
        uint8ArrayConstructor: uint8Array.constructor.name
      });

      // 4. Prepare file information (metadata + content)
      const fileInfo = {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified
      };
      
      logger.debug('Prepared file info for service worker', {
        fileInfo: fileInfo,
        uint8ArrayLength: uint8Array.length
      });

      // 5. Send to background script
      logger.debug('Sending file to background script for processing', { fileName: file.name });

      const response = await chrome.runtime.sendMessage({
        action: 'uploadCV',
        fileInfo: fileInfo, // Metadata
        fileContent: Array.from(uint8Array) // Convert to regular array for Chrome message passing
      });

      logger.debug('Received response from service worker', {
        success: response?.success,
        hasCV: !!response?.cv,
        cvSize: response?.cv?.size,
        error: response?.error
      });

      if (response && response.success) {
        logger.info('CV processed and saved successfully by service worker', { cv: response.cv });
        
        // 驗證返回的CV數據
        if (response.cv.size !== file.size) {
          logger.warn('Size mismatch between original file and saved CV', {
            originalSize: file.size,
            savedSize: response.cv.size
          });
        }
        
        this.currentCV = response.cv; // Update current CV
        this.currentCVList.unshift(response.cv); // Add to list
        if (this.currentCVList.length > 10) {
          this.currentCVList.pop();
        }
        this.updateCVSection();
        this.updateCVList(); // If you have a separate list rendering
        this.updateStatistics();
        this.showMessage('CV 已成功保存!', 'success');
      } else {
        logger.error('Failed to upload/save CV via service worker', response?.error);
        this.showError(`保存失敗: ${response?.error || '未知錯誤'}`);
      }
    } catch (error) {
      logger.error('Error handling file upload in popup', error);
      this.showError(`上傳出錯: ${error.message}`);
    } finally {
      // Clear the input for next upload
      event.target.value = null;
      // Hide loading message if it was the only one, or manage message queue
      // For simplicity, assume showMessage handles this or replace if a queue is used.
      // If showMessage('...', 'loading') creates a persistent message, ensure it's cleared.
    }
  }

  /**
   * Handles API configuration form submission
   */
  async handleApiConfig(event) {
    event.preventDefault();
    
    try {
      const baseUrl = document.getElementById('api-url').value.trim();
      const apiKey = document.getElementById('api-key').value.trim();

      if (!baseUrl) {
        throw new Error('請填寫API URL');
      }

      this.showMessage('正在保存配置...', 'info');

      const response = await chrome.runtime.sendMessage({
        action: 'configureApi',
        config: { baseUrl, apiKey }
      });

      if (response && response.success) {
        this.showMessage('API配置已保存！', 'success');
        
        const statusResponse = await chrome.runtime.sendMessage({ action: 'getApiStatus' });
        if (statusResponse && statusResponse.success) {
          this.currentApiStatus = statusResponse.status;
          logger.info('API status reloaded after config save:', this.currentApiStatus);
        } else {
          logger.warn('Failed to reload API status after config save', statusResponse?.error);
        }
        this.updateApiStatus(); // Update UI with the newly fetched status

        this.hideSettings(); // CRITICAL CHANGE: Hide settings panel after successful save and UI update

      } else {
        throw new Error(response.error || 'API配置失敗');
      }

    } catch (error) {
      logger.error('API configuration failed', error);
      this.showMessage('API配置失敗：' + error.message, 'error');
    }
  }

  /**
   * Tests API connection
   */
  async testApiConnection() {
    try {
      const baseUrl = document.getElementById('api-url').value.trim();
      const apiKey = document.getElementById('api-key').value.trim();

      if (!baseUrl) {
        throw new Error('請先填寫API URL');
      }

      console.log('Testing connection to:', baseUrl);
      this.showMessage('正在測試連接...', 'info');

      // Save temporarily and test
      const response = await chrome.runtime.sendMessage({
        action: 'configureApi',
        config: { baseUrl, apiKey: apiKey || '' }
      });

      console.log('API test response:', response);

      if (response && response.success) {
        this.showMessage('連接測試成功！', 'success');
      } else {
        console.error('API test failed:', response);
        throw new Error(response.error || '連接測試失敗');
      }

    } catch (error) {
      console.error('Connection test error:', error);
      logger.error('Connection test failed', error);
      this.showMessage('連接測試失敗：' + error.message, 'error');
    }
  }

  /**
   * Toggles API key visibility
   */
  toggleApiKeyVisibility() {
    const input = document.getElementById('api-key');
    const button = document.getElementById('toggle-api-key');
    
    if (input.type === 'password') {
      input.type = 'text';
      button.innerHTML = '<span>🙈</span>';
    } else {
      input.type = 'password';
      button.innerHTML = '<span>👁️</span>';
    }
  }

  /**
   * Opens JobsDB in new tab
   */
  async openJobsDB() {
    try {
      await chrome.tabs.create({ url: 'https://hk.jobsdb.com' });
      window.close();
    } catch (error) {
      logger.error('Failed to open JobsDB', error);
    }
  }

  /**
   * Views analysis history
   */
  async viewHistory() {
    // For now, show a message
    this.showMessage('歷史功能即將推出', 'info');
  }

  /**
   * Sets current CV
   */
  async setCurrentCV(cvId) {
    try {
      const cv = this.currentCVList.find(cv => cv.id === cvId);
      if (!cv) {
        throw new Error('CV not found');
      }

      const response = await chrome.runtime.sendMessage({
        action: 'setCurrentCV',
        cvInfo: cv
      });

      if (response && response.success) {
        this.currentCV = cv;
        this.updateCVSection();
        this.showMessage('CV已設置為當前使用', 'success');
      } else {
        throw new Error(response.error || 'Failed to set current CV');
      }

    } catch (error) {
      logger.error('Failed to set current CV', error);
      this.showMessage('設置CV失敗：' + error.message, 'error');
    }
  }

  /**
   * Removes CV
   */
  async removeCV(cvId) {
    try {
      if (!confirm('確定要刪除這個CV嗎？')) {
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'removeCV',
        cvId: cvId
      });

      if (response && response.success) {
        // Reload data and update UI
        await this.loadCVData();
        this.updateUI();
        this.showMessage('CV已刪除', 'success');
      } else {
        throw new Error(response.error || 'Failed to remove CV');
      }

    } catch (error) {
      logger.error('Failed to remove CV', error);
      this.showMessage('刪除CV失敗：' + error.message, 'error');
    }
  }

  /**
   * Exports data
   */
  async exportData() {
    try {
      // Get all data from storage
      const result = await chrome.storage.local.get(null);
      
      const exportData = {
        cvList: result.cvList || [],
        userSettings: result.userSettings || {},
        exportedAt: new Date().toISOString()
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `jobsdb-cv-matcher-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      this.showMessage('數據已導出', 'success');

    } catch (error) {
      logger.error('Failed to export data', error);
      this.showMessage('導出數據失敗：' + error.message, 'error');
    }
  }

  /**
   * Clears all data
   */
  async clearData() {
    try {
      if (!confirm('確定要清除所有數據嗎？此操作不可撤銷。')) {
        return;
      }

      await chrome.storage.local.clear();
      
      // Reload data and update UI
      await this.loadInitialData();
      this.updateUI();
      
      this.showMessage('所有數據已清除', 'success');

    } catch (error) {
      logger.error('Failed to clear data', error);
      this.showMessage('清除數據失敗：' + error.message, 'error');
    }
  }

  /**
   * Clears all CV files
   */
  async clearAllCVs() {
    try {
      if (!confirm('確定要清除所有CV嗎？此操作不可撤銷。')) {
        return;
      }

      logger.info('Starting to clear all CVs');

      // Clear CV-related data from storage
      await chrome.storage.local.remove(['cvList', 'currentCV']);

      // Reload CV data and update UI
      this.currentCVList = [];
      this.currentCV = null;
      this.cvStats = {};
      
      this.updateCVSection();
      this.updateStatistics();
      
      this.showMessage('所有CV已清除', 'success');
      logger.info('All CVs cleared successfully');

    } catch (error) {
      logger.error('Failed to clear all CVs', error);
      this.showMessage('清除CV失敗：' + error.message, 'error');
    }
  }

  /**
   * Debug CV data to identify size issues
   */
  async debugCVData() {
    try {
      logger.info('Starting CV data debug...');
      
      const result = await chrome.storage.local.get(['cvList', 'currentCV']);
      
      let debugOutput = '<h4>🔍 CV數據診斷報告</h4>';
      
      if (result.cvList && result.cvList.length > 0) {
        debugOutput += `<p><strong>總CV數量:</strong> ${result.cvList.length}</p>`;
        
        let totalDeclaredSize = 0;
        let totalEstimatedSize = 0;
        let problematicCount = 0;
        
        debugOutput += '<div style="margin: 10px 0;"><strong>CV詳細資訊:</strong></div>';
        
        result.cvList.forEach((cv, index) => {
          const declaredSize = Number(cv.size) || 0;
          const base64Length = cv.contentBase64 ? cv.contentBase64.length : 0;
          const estimatedSize = base64Length > 0 ? Math.floor(base64Length * 3 / 4) : 0;
          const sizeMismatch = Math.abs(declaredSize - estimatedSize) > 1000 || declaredSize === 0;
          
          totalDeclaredSize += declaredSize;
          totalEstimatedSize += estimatedSize;
          
          if (sizeMismatch) problematicCount++;
          
          debugOutput += `<div style="border: 1px solid ${sizeMismatch ? '#ff6b6b' : '#4caf50'}; margin: 5px 0; padding: 8px; border-radius: 3px; background: ${sizeMismatch ? '#ffe6e6' : '#e8f5e8'};">`;
          debugOutput += `<strong>${cv.name}</strong><br>`;
          debugOutput += `聲明大小: <span style="color: ${declaredSize === 0 ? 'red' : 'green'}; font-weight: bold;">${declaredSize} bytes</span><br>`;
          debugOutput += `估算大小: ${estimatedSize} bytes<br>`;
          debugOutput += `Base64長度: ${base64Length}<br>`;
          debugOutput += `有內容: ${!!cv.contentBase64 ? '✅ 是' : '❌ 否'}<br>`;
          debugOutput += `大小匹配: ${sizeMismatch ? '❌ 不匹配' : '✅ 匹配'}<br>`;
          debugOutput += `</div>`;
        });
        
        debugOutput += `<div style="margin-top: 15px; padding: 10px; background: #f0f8ff; border-radius: 4px;">`;
        debugOutput += `<strong>📊 統計摘要:</strong><br>`;
        debugOutput += `總聲明大小: <span style="color: ${totalDeclaredSize === 0 ? 'red' : 'green'}; font-weight: bold;">${totalDeclaredSize} bytes (${(totalDeclaredSize/1024).toFixed(1)} KB)</span><br>`;
        debugOutput += `總估算大小: <span style="font-weight: bold;">${totalEstimatedSize} bytes (${(totalEstimatedSize/1024).toFixed(1)} KB)</span><br>`;
        debugOutput += `問題CV數量: <span style="color: ${problematicCount > 0 ? 'red' : 'green'}; font-weight: bold;">${problematicCount}</span><br>`;
        debugOutput += `</div>`;
        
        if (problematicCount > 0) {
          debugOutput += `<div style="margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">`;
          debugOutput += `<strong>⚠️ 發現問題:</strong> 有 ${problematicCount} 個CV的大小數據不正確。這可能是文件保存過程中出現的問題。`;
          debugOutput += `</div>`;
        }
        
      } else {
        debugOutput += '<p>❌ 沒有找到CV數據</p>';
      }
      
      if (result.currentCV) {
        const cv = result.currentCV;
        const declaredSize = Number(cv.size) || 0;
        const base64Length = cv.contentBase64 ? cv.contentBase64.length : 0;
        const estimatedSize = base64Length > 0 ? Math.floor(base64Length * 3 / 4) : 0;
        
        debugOutput += '<div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 4px;">';
        debugOutput += '<h5>📋 當前選中CV:</h5>';
        debugOutput += `<p>名稱: <strong>${cv.name}</strong></p>`;
        debugOutput += `<p>聲明大小: <span style="color: ${declaredSize === 0 ? 'red' : 'green'}; font-weight: bold;">${declaredSize} bytes</span></p>`;
        debugOutput += `<p>估算大小: <strong>${estimatedSize} bytes</strong></p>`;
        debugOutput += `<p>Base64長度: <strong>${base64Length}</strong></p>`;
        debugOutput += '</div>';
      }
      
      document.getElementById('debug-output').innerHTML = debugOutput;
      document.getElementById('debug-output').style.display = 'block';
      
      this.showMessage('CV數據診斷完成', 'info');
      logger.info('CV debug completed successfully');
      
    } catch (error) {
      logger.error('Failed to debug CV data', error);
      document.getElementById('debug-output').innerHTML = 
        `<div style="color: red; padding: 10px; background: #ffe6e6; border-radius: 4px;">
          <strong>❌ 調試失敗:</strong> ${error.message}
        </div>`;
      document.getElementById('debug-output').style.display = 'block';
    }
  }

  /**
   * Debug storage details
   */
  async debugStorageDetails() {
    try {
      logger.info('Starting storage debug...');
      
      const result = await chrome.storage.local.get(null);
      const keys = Object.keys(result);
      
      let debugOutput = '<h4>🗂️ 存儲詳細資訊</h4>';
      debugOutput += `<p><strong>存儲鍵總數:</strong> ${keys.length}</p>`;
      
      debugOutput += '<div style="margin: 10px 0;"><strong>存儲內容概覽:</strong></div>';
      
      keys.forEach(key => {
        const value = result[key];
        let size = 0;
        let type = typeof value;
        let description = '';
        
        try {
          size = JSON.stringify(value).length;
        } catch (e) {
          size = 'unknown';
        }
        
        switch (key) {
          case 'cvList':
            description = `CV列表 (${value?.length || 0} 個CV)`;
            break;
          case 'currentCV':
            description = `當前CV (${value?.name || 'unknown'})`;
            break;
          case 'apiConfig':
            description = 'API配置';
            break;
          case 'userSettings':
            description = '用戶設定';
            break;
          default:
            description = '其他數據';
        }
        
        debugOutput += `<div style="border: 1px solid #ddd; margin: 5px 0; padding: 8px; border-radius: 3px;">`;
        debugOutput += `<strong>${key}</strong> (${type})<br>`;
        debugOutput += `描述: ${description}<br>`;
        debugOutput += `大小: ${size} characters<br>`;
        if (key === 'cvList' && Array.isArray(value)) {
          debugOutput += `CV數量: ${value.length}<br>`;
          const totalSize = value.reduce((sum, cv) => sum + (cv.size || 0), 0);
          debugOutput += `總聲明大小: ${totalSize} bytes<br>`;
        }
        debugOutput += `</div>`;
      });
      
      // 計算總存儲使用量
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        debugOutput += `<div style="margin-top: 15px; padding: 10px; background: #f0f8ff; border-radius: 4px;">`;
        debugOutput += `<strong>📊 存儲使用量:</strong><br>`;
        debugOutput += `已使用: ${bytesInUse} bytes (${(bytesInUse/1024).toFixed(1)} KB)<br>`;
        debugOutput += `Chrome限制: 5MB (5,242,880 bytes)<br>`;
        debugOutput += `使用率: ${((bytesInUse/5242880)*100).toFixed(1)}%<br>`;
        debugOutput += `</div>`;
        
        document.getElementById('debug-output').innerHTML = debugOutput;
      });
      
      document.getElementById('debug-output').style.display = 'block';
      this.showMessage('存儲詳情檢查完成', 'info');
      
    } catch (error) {
      logger.error('Failed to debug storage details', error);
      document.getElementById('debug-output').innerHTML = 
        `<div style="color: red; padding: 10px; background: #ffe6e6; border-radius: 4px;">
          <strong>❌ 存儲調試失敗:</strong> ${error.message}
        </div>`;
      document.getElementById('debug-output').style.display = 'block';
    }
  }

  /**
   * Shows a message to the user
   */
  showMessage(message, type = 'info') {
    const container = document.getElementById('message-container');
    
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    container.appendChild(messageEl);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      messageEl.remove();
    }, 3000);
  }

  /**
   * Shows error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Reads file as ArrayBuffer
   */
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = error => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Formats file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Formats date for display
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  async handleAnalyzeClick() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const analysisResult = document.getElementById('analysis-result');
    
    try {
      // 改善按鈕UX - 顯示載入狀態 (移除旋轉動畫)
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '⏳ 分析中...';
      analyzeBtn.style.opacity = '0.7';
      
      // 清除之前的結果
      analysisResult.innerHTML = '';
      analysisResult.style.display = 'none';
      
      // 顯示準備狀態消息
      this.showMessage('🔍 正在準備分析...', 'info');
      
      // 首先檢查當前CV狀態
      logger.debug('Starting analysis - checking CV status...');
      const cvCheckResponse = await chrome.runtime.sendMessage({ action: 'getCurrentCV' });
      
      if (!cvCheckResponse || !cvCheckResponse.success || !cvCheckResponse.cv) {
        logger.error('No current CV available', cvCheckResponse);
        throw new Error('沒有找到當前CV，請先上傳CV文件');
      }
      
      logger.debug('Current CV found', {
        cvName: cvCheckResponse.cv.name,
        cvSize: cvCheckResponse.cv.size,
        hasContentBase64: !!cvCheckResponse.cv.contentBase64,
        contentBase64Length: cvCheckResponse.cv.contentBase64?.length || 0
      });
      
      if (!cvCheckResponse.cv.contentBase64) {
        logger.error('CV found but missing content', {
          cvId: cvCheckResponse.cv.id,
          cvName: cvCheckResponse.cv.name,
          cvKeys: Object.keys(cvCheckResponse.cv)
        });
        throw new Error('CV文件內容缺失，請重新上傳CV');
      }
      
      // 更新狀態消息
      this.showMessage('📄 正在提取職位資訊...', 'info');
      
      // 取得目前 tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        throw new Error('無法取得當前分頁');
      }
      
      // 按依賴順序注入所有必要的文件
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/src/services/LoggerService.js']
        });
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/src/extractors/JobsDBExtractor.js']
        });
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/src/extractors/GenericJobExtractor.js']
        });
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/src/content/jobExtractor.js']
        });
        
        // 給 content script 一點時間初始化
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (e) {
        logger.warn('Failed to inject some scripts, trying to continue', e);
      }
      
      // 發送訊息給 content script 請求職位資訊
      const jobData = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' });
      
      if (!jobData || !jobData.success) {
        throw new Error('無法取得職位資訊：' + (jobData?.error || '請確認當前頁面支援分析'));
      }
      
      // 更新狀態消息
      this.showMessage('🤖 AI分析中...此過程可能需要1-2分鐘，請耐心等候', 'info');
      
      // 添加進度提示
      let progressStep = 0;
      const progressMessages = [
        '🔍 正在提取和處理職位資訊...',
        '📄 正在分析CV內容...',
        '🤖 AI正在深度分析匹配度...',
        '📊 正在評估技能匹配程度...',
        '📝 正在生成詳細分析報告...'
      ];
      
      const progressInterval = setInterval(() => {
        if (progressStep < progressMessages.length - 1) {
          progressStep++;
          this.showMessage(progressMessages[progressStep], 'info');
        }
      }, 20000); // 每20秒更新一次進度訊息
      
      try {
        // 呼叫 service worker 進行分析
        const response = await chrome.runtime.sendMessage({
          action: 'analyzeMatch',
          jobData: jobData.data
        });
        
        // 詳細的響應檢查和日誌記錄
        logger.info('Analysis API response received', {
          hasResponse: !!response,
          responseType: typeof response,
          success: response?.success,
          hasAnalysis: !!response?.analysis,
          analysisType: typeof response?.analysis,
          analysisLength: Array.isArray(response?.analysis) ? response.analysis.length : 'not array',
          error: response?.error,
          fullResponse: response
        });
        
        // 添加控制台調試信息 - 查看實際數據
        console.log('🔍 DEBUG: 完整的API響應', response);
        console.log('🔍 DEBUG: response.analysis', response?.analysis);
        if (Array.isArray(response?.analysis) && response.analysis.length > 0) {
          console.log('🔍 DEBUG: response.analysis[0]', response.analysis[0]);
          if (response.analysis[0].output) {
            console.log('🔍 DEBUG: response.analysis[0].output', response.analysis[0].output);
            console.log('🔍 DEBUG: vote值原始', response.analysis[0].output.vote);
            console.log('🔍 DEBUG: vote值類型', typeof response.analysis[0].output.vote);
          }
        }
        
        if (response && response.success && response.analysis) {
          // Parse the N8n response - handle both array and object formats
          let analysisData = response.analysis;
          
          logger.debug('Raw analysis data', {
            type: typeof analysisData,
            isArray: Array.isArray(analysisData),
            length: Array.isArray(analysisData) ? analysisData.length : 'N/A',
            firstItem: Array.isArray(analysisData) && analysisData.length > 0 ? analysisData[0] : null,
            directOutput: analysisData.output
          });
          
          // Handle both formats: array format [{"output": {...}}] OR direct object format {"output": {...}}
          let output = null;
          if (Array.isArray(analysisData) && analysisData.length > 0 && analysisData[0].output) {
            // Array format: [{"output": {"vote": "9", "consideration": "..."}}]
            output = analysisData[0].output;
            console.log('🔍 DEBUG: 使用數組格式', output);
          } else if (analysisData.output) {
            // Direct object format: {"output": {"vote": "95%", "consideration": "..."}}
            output = analysisData.output;
            console.log('🔍 DEBUG: 使用直接對象格式', output);
          }
          
          if (output) {
            logger.debug('Processing N8n output format', { 
              output,
              vote: output.vote,
              voteType: typeof output.vote,
              considerationLength: output.consideration?.length || 0
            });
            
            // 處理不同的vote格式
            const voteValue = output.vote;
            let parsedVote = 0;
            let isValidVote = false;
            
            // 添加詳細的解析調試
            console.log('🔍 DEBUG: Vote 解析過程');
            console.log('  voteValue:', voteValue);
            console.log('  voteValue type:', typeof voteValue);
            
            if (typeof voteValue === 'string') {
              if (voteValue.includes('%')) {
                // 處理百分比格式 "95%" -> 95
                const percentMatch = voteValue.match(/(\d+(?:\.\d+)?)%/);
                if (percentMatch) {
                  parsedVote = parseInt(percentMatch[1]);
                  isValidVote = !isNaN(parsedVote) && parsedVote >= 0 && parsedVote <= 100;
                  console.log('  百分比格式:', percentMatch[1], '-> parsed:', parsedVote);
                }
              } else {
                // 處理數字字符串格式 "9" -> 9
                parsedVote = parseInt(voteValue);
                isValidVote = !isNaN(parsedVote) && parsedVote >= 0 && parsedVote <= 10;
                console.log('  數字格式:', voteValue, '-> parsed:', parsedVote);
              }
            } else if (typeof voteValue === 'number') {
              parsedVote = voteValue;
              isValidVote = parsedVote >= 0 && (parsedVote <= 10 || parsedVote <= 100);
              console.log('  數字類型:', voteValue);
            }
            
            console.log('  isNaN(parsedVote):', isNaN(parsedVote));
            console.log('  isValidVote:', isValidVote);
            
            logger.debug('Vote parsing details', {
              original: voteValue,
              parsed: parsedVote,
              isValid: isValidVote,
              isNaN: isNaN(parsedVote)
            });
            
            analysisData = {
              matchScore: isValidVote ? parsedVote : 0,
              vote: isValidVote ? voteValue : '0', // 保持原始格式
              voteNumber: isValidVote ? parsedVote : 0, // 數字格式用於計算
              consideration: output.consideration || '',
              recommendations: [], // Will be extracted from consideration if needed
              strengths: [],
              improvements: []
            };
            
            // 智能解析consideration內容，提取結構化信息
            if (analysisData.consideration) {
              const parsed = this.parseConsiderationText(analysisData.consideration);
              analysisData.strengths = parsed.strengths;
              analysisData.improvements = parsed.improvements;
              analysisData.recommendations = parsed.recommendations;
              analysisData.formattedConsideration = parsed.formattedText;
            }
            
            // 添加最終結果調試
            console.log('🔍 DEBUG: 最終 analysisData');
            console.log('  analysisData.vote:', analysisData.vote);
            console.log('  analysisData.voteNumber:', analysisData.voteNumber);
            console.log('  analysisData.matchScore:', analysisData.matchScore);
            
            logger.info('Final analysisData after N8n processing', {
              vote: analysisData.vote,
              voteNumber: analysisData.voteNumber,
              matchScore: analysisData.matchScore,
              hasConsideration: !!analysisData.consideration
            });
          } else {
            logger.warn('No valid output found in analysis data', { 
              analysisData,
              isArray: Array.isArray(analysisData),
              hasOutput: !!analysisData.output,
              hasArrayOutput: Array.isArray(analysisData) && analysisData.length > 0 && analysisData[0].output
            });
            // 使用默認值
            analysisData = {
              matchScore: 0,
              vote: '0',
              voteNumber: 0,
              consideration: '',
              recommendations: [],
              strengths: [],
              improvements: []
            };
          }

          logger.info('Processed analysis data', {
            vote: analysisData.vote,
            voteNumber: analysisData.voteNumber,
            matchScore: analysisData.matchScore,
            hasConsideration: !!analysisData.consideration,
            considerationLength: analysisData.consideration?.length || 0
          });

          // 建立分析結果HTML
          const displayValue = analysisData.vote || analysisData.voteNumber || analysisData.matchScore || '0';
          console.log('🔍 DEBUG: HTML顯示值');
          console.log('  analysisData.vote:', analysisData.vote);
          console.log('  analysisData.voteNumber:', analysisData.voteNumber); 
          console.log('  analysisData.matchScore:', analysisData.matchScore);
          console.log('  最終顯示值:', displayValue);
          
          const resultHTML = `
            <div class="message message-success">
              <h4>🎯 CV匹配分析結果</h4>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <div style="text-align: center; margin-bottom: 15px;">
                  <div style="display: inline-block; width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #a54858 0%, #8a3a47 100%); display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                    <span style="font-size: 20px; font-weight: bold; color: white;">${displayValue}</span>
                  </div>
                  <div style="font-size: 14px; color: #a54858; font-weight: 500;">
                    匹配度 (%)
                  </div>
                </div>
                
                ${analysisData.consideration ? `
                  <div style="margin-bottom: 15px;">
                    <h5 style="color: #a54858; margin-bottom: 8px;">💡 詳細分析</h5>
                    <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #a54858; line-height: 1.6;">${analysisData.formattedConsideration || analysisData.consideration}</div>
                  </div>
                ` : ''}
                
                ${analysisData.recommendations && analysisData.recommendations.length > 0 ? `
                  <div style="margin-bottom: 15px;">
                    <h5 style="color: #a54858; margin-bottom: 8px;">📋 建議</h5>
                    <ul style="margin: 0; padding-left: 20px;">
                      ${analysisData.recommendations.map(rec => `<li style="margin-bottom: 4px;">${rec}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
                
                ${analysisData.strengths && analysisData.strengths.length > 0 ? `
                  <div style="margin-bottom: 15px;">
                    <h5 style="color: #2d7d32; margin-bottom: 8px;">✅ 優勢</h5>
                    <ul style="margin: 0; padding-left: 20px;">
                      ${analysisData.strengths.map(strength => `<li style="margin-bottom: 4px; color: #2d7d32;">${strength}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
                
                ${analysisData.improvements && analysisData.improvements.length > 0 ? `
                  <div style="margin-bottom: 10px;">
                    <h5 style="color: #e65100; margin-bottom: 8px;">⚠️ 改進建議</h5>
                    <ul style="margin: 0; padding-left: 20px;">
                      ${analysisData.improvements.map(improvement => `<li style="margin-bottom: 4px; color: #e65100;">${improvement}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
                  分析時間: ${new Date().toLocaleString()}
                </div>
              </div>
            </div>`;

          // 顯示結果
          analysisResult.innerHTML = resultHTML;
          analysisResult.style.display = 'block';
          
          // 滾動到結果區域
          analysisResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          
          this.showMessage('✅ AI分析完成！', 'success');
          
        } else {
          // 處理分析失敗
          const errorMsg = response?.error || '未知錯誤';
          logger.error('Analysis failed', { response, errorMsg });
          
          analysisResult.innerHTML = `
            <div class="message message-error">
              <h4>❌ 分析失敗</h4>
              <p>${errorMsg}</p>
              <p><small>AI分析需要較長時間，如果是超時錯誤請稍候再試。</small></p>
            </div>`;
          analysisResult.style.display = 'block';
          
          throw new Error('分析失敗：' + errorMsg);
        }
        
      } catch (analysisError) {
        logger.error('Analysis request failed', analysisError);
        
        // 檢查是否為超時錯誤
        const isTimeout = analysisError.message.includes('超時') || analysisError.message.includes('timeout');
        
        analysisResult.innerHTML = `
          <div class="message message-error">
            <h4>❌ ${isTimeout ? 'AI分析超時' : '分析過程出錯'}</h4>
            <p>${analysisError.message}</p>
            ${isTimeout ? `
              <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;">
                <p style="margin: 0; color: #856404;"><strong>💡 提示：</strong>AI分析通常需要1-2分鐘時間，超時限制已放寬至2分鐘。如果持續超時，請檢查:</p>
                <ul style="margin: 8px 0 0 20px; color: #856404;">
                  <li>網路連接是否穩定</li>
                  <li>N8n服務是否正常運行</li>
                  <li>等候片刻後再次嘗試</li>
                </ul>
              </div>
            ` : ''}
            <div style="margin-top: 10px;">
              <button onclick="location.reload()" style="background: #a54858; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                🔄 重新載入
              </button>
            </div>
          </div>`;
        analysisResult.style.display = 'block';
        
        throw analysisError;
      }
      
    } catch (error) {
      logger.error('Analysis process failed', error);
      this.showError('分析過程出錯：' + error.message);
      
    } finally {
      // 清除進度指示器和恢復按鈕狀態
      if (typeof progressInterval !== 'undefined') {
        clearInterval(progressInterval);
      }
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '🔍 開始分析匹配度';
      analyzeBtn.style.opacity = '1';
    }
  }

  /**
   * Debug current CV status and content
   */
  async debugCurrentCVStatus() {
    try {
      logger.info('Starting current CV status debug...');
      
      // 1. 檢查 getCurrentCV API
      const cvResponse = await chrome.runtime.sendMessage({ action: 'getCurrentCV' });
      
      let debugOutput = '<h4>🔍 當前CV狀態診斷</h4>';
      
      debugOutput += '<div style="margin: 10px 0;"><strong>getCurrentCV API 響應:</strong></div>';
      debugOutput += `<div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 3px; background: #f9f9f9;">`;
      debugOutput += `<pre style="margin: 0; font-size: 11px;">${JSON.stringify(cvResponse, null, 2)}</pre>`;
      debugOutput += `</div>`;
      
      // 2. 檢查存儲中的原始數據
      const storageData = await chrome.storage.local.get(['currentCV', 'cvList']);
      
      debugOutput += '<div style="margin: 10px 0;"><strong>存儲中的原始數據:</strong></div>';
      
      if (storageData.currentCV) {
        const cv = storageData.currentCV;
        debugOutput += `<div style="border: 1px solid #4caf50; padding: 10px; margin: 5px 0; border-radius: 3px; background: #e8f5e9;">`;
        debugOutput += `<strong>currentCV 存在:</strong><br>`;
        debugOutput += `名稱: ${cv.name}<br>`;
        debugOutput += `大小: ${cv.size} bytes<br>`;
        debugOutput += `類型: ${cv.type}<br>`;
        debugOutput += `ID: ${cv.id}<br>`;
        debugOutput += `有 contentBase64: ${!!cv.contentBase64 ? '✅ 是' : '❌ 否'}<br>`;
        if (cv.contentBase64) {
          debugOutput += `contentBase64 長度: ${cv.contentBase64.length}<br>`;
          debugOutput += `預估文件大小: ${Math.floor(cv.contentBase64.length * 3/4)} bytes<br>`;
          debugOutput += `大小匹配: ${Math.abs(cv.size - Math.floor(cv.contentBase64.length * 3/4)) <= 3 ? '✅ 匹配' : '❌ 不匹配'}<br>`;
          
          // 檢查前幾個字符
          const preview = cv.contentBase64.substring(0, 50);
          debugOutput += `Base64 前50字符: ${preview}...<br>`;
          
          // 嘗試解碼並檢查PDF頭部
          try {
            const binary = atob(cv.contentBase64.substring(0, 8)); // 只解碼前幾個字節
            const header = binary.substring(0, 4);
            debugOutput += `PDF頭部: ${header} ${header === '%PDF' ? '✅' : '❌'}<br>`;
          } catch (e) {
            debugOutput += `PDF頭部檢查失敗: ${e.message}<br>`;
          }
        }
        debugOutput += `</div>`;
      } else {
        debugOutput += `<div style="border: 1px solid #f44336; padding: 10px; margin: 5px 0; border-radius: 3px; background: #ffebee;">`;
        debugOutput += `<strong>❌ currentCV 不存在</strong>`;
        debugOutput += `</div>`;
      }
      
      // 3. 檢查cvList
      if (storageData.cvList && storageData.cvList.length > 0) {
        debugOutput += '<div style="margin: 15px 0;"><strong>CV列表 (cvList):</strong></div>';
        storageData.cvList.forEach((cv, index) => {
          const isCurrentCV = storageData.currentCV && cv.id === storageData.currentCV.id;
          debugOutput += `<div style="border: 1px solid ${isCurrentCV ? '#2196f3' : '#ddd'}; padding: 8px; margin: 3px 0; border-radius: 3px; background: ${isCurrentCV ? '#e3f2fd' : '#f9f9f9'};">`;
          debugOutput += `<strong>${index + 1}. ${cv.name}</strong> ${isCurrentCV ? '(當前CV)' : ''}<br>`;
          debugOutput += `大小: ${cv.size} bytes | 有內容: ${!!cv.contentBase64 ? '✅' : '❌'}<br>`;
          if (cv.contentBase64) {
            debugOutput += `Base64長度: ${cv.contentBase64.length} | 預估: ${Math.floor(cv.contentBase64.length * 3/4)} bytes<br>`;
          }
          debugOutput += `</div>`;
        });
      } else {
        debugOutput += `<div style="border: 1px solid #ff9800; padding: 10px; margin: 5px 0; border-radius: 3px; background: #fff3e0;">`;
        debugOutput += `<strong>⚠️ cvList 為空或不存在</strong>`;
        debugOutput += `</div>`;
      }
      
      // 4. 問題診斷
      debugOutput += '<div style="margin: 15px 0;"><strong>問題診斷:</strong></div>';
      
      if (!storageData.currentCV) {
        debugOutput += `<div style="border: 1px solid #f44336; padding: 10px; margin: 5px 0; border-radius: 3px; background: #ffebee;">`;
        debugOutput += `<strong>❌ 主要問題: currentCV 不存在</strong><br>`;
        debugOutput += `建議: 重新上傳CV文件`;
        debugOutput += `</div>`;
      } else if (!storageData.currentCV.contentBase64) {
        debugOutput += `<div style="border: 1px solid #f44336; padding: 10px; margin: 5px 0; border-radius: 3px; background: #ffebee;">`;
        debugOutput += `<strong>❌ 主要問題: CV存在但缺少文件內容</strong><br>`;
        debugOutput += `建議: 重新上傳CV文件`;
        debugOutput += `</div>`;
      } else {
        debugOutput += `<div style="border: 1px solid #4caf50; padding: 10px; margin: 5px 0; border-radius: 3px; background: #e8f5e9;">`;
        debugOutput += `<strong>✅ CV狀態正常</strong><br>`;
        debugOutput += `當前CV有效且包含完整內容`;
        debugOutput += `</div>`;
      }
      
      document.getElementById('debug-output').innerHTML = debugOutput;
      document.getElementById('debug-output').style.display = 'block';
      
      this.showMessage('CV狀態診斷完成', 'info');
      logger.info('Current CV status debug completed successfully');
      
    } catch (error) {
      logger.error('Failed to debug current CV status', error);
      document.getElementById('debug-output').innerHTML = 
        `<div style="color: red; padding: 10px; background: #ffe6e6; border-radius: 4px;">
          <strong>❌ CV狀態調試失敗:</strong> ${error.message}
        </div>`;
      document.getElementById('debug-output').style.display = 'block';
    }
  }

  /**
   * Quick fix for missing CV content
   */
  async quickFixCVContent() {
    try {
      if (!confirm('這將清除當前有問題的CV並提示重新上傳。確定繼續？')) {
        return;
      }

      logger.info('Starting quick fix for CV content');
      
      // 清除所有CV數據
      await chrome.storage.local.remove(['cvList', 'currentCV']);
      
      // 重新載入數據
      this.currentCVList = [];
      this.currentCV = null;
      this.cvStats = {};
      
      // 更新UI
      this.updateCVSection();
      this.updateStatistics();
      
      // 提示重新上傳
      this.showMessage('已清除問題CV，請重新上傳您的PDF文件', 'success');
      
      // 自動觸發文件選擇
      setTimeout(() => {
        this.triggerFileUpload();
      }, 1000);
      
    } catch (error) {
      logger.error('Failed to quick fix CV content', error);
      this.showError('快速修復失敗：' + error.message);
    }
  }

  /**
   * Debug job extraction and API data preparation
   */
  async debugJobExtraction() {
    try {
      logger.info('Starting job extraction debug...');
      
      let debugOutput = '<h4>🔍 職位信息提取調試</h4>';
      
      // 1. 檢查當前頁面
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        debugOutput += `<div style="color: red; padding: 10px; background: #ffe6e6; border-radius: 4px;">
          <strong>❌ 無法取得當前分頁</strong>
        </div>`;
        document.getElementById('debug-output').innerHTML = debugOutput;
        document.getElementById('debug-output').style.display = 'block';
        return;
      }
      
      debugOutput += `<div style="margin: 10px 0;"><strong>當前頁面：</strong></div>`;
      debugOutput += `<div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 3px; background: #f9f9f9;">`;
      debugOutput += `URL: ${tab.url}<br>`;
      debugOutput += `標題: ${tab.title}`;
      debugOutput += `</div>`;
      
      // 2. 檢查頁面是否符合content script匹配規則
      const isJobsDBPage = tab.url.includes('jobsdb.com/job/');
      debugOutput += '<div style="margin: 10px 0;"><strong>Content Script 檢查：</strong></div>';
      debugOutput += `<div style="border: 1px solid ${isJobsDBPage ? '#4caf50' : '#ff9800'}; padding: 10px; margin: 5px 0; border-radius: 3px; background: ${isJobsDBPage ? '#e8f5e9' : '#fff3e0'};">`;
      debugOutput += `JobsDB職位頁面: ${isJobsDBPage ? '✅ 是' : '❌ 否'}<br>`;
      debugOutput += `Content Script應該已自動載入: ${isJobsDBPage ? '✅ 是' : '❌ 否'}`;
      debugOutput += `</div>`;
      
      // 3. 直接嘗試與content script通信（不再動態注入）
      try {
        debugOutput += '<div style="margin: 10px 0;"><strong>與Content Script通信：</strong></div>';
        
        // 等待片刻確保content script已初始化
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 先測試連接
        debugOutput += '<div style="margin: 5px 0;"><em>正在測試連接...</em></div>';
        try {
          const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
          
          if (pingResponse && pingResponse.success) {
            debugOutput += `<div style="border: 1px solid #4caf50; padding: 10px; margin: 5px 0; border-radius: 3px; background: #e8f5e9;">`;
            debugOutput += `<strong>✅ Content Script連接成功</strong><br>`;
            debugOutput += `版本: ${pingResponse.version || 'N/A'}<br>`;
            debugOutput += `載入狀態: ${pingResponse.loaded ? '✅ 已載入' : '❌ 未載入'}<br>`;
            debugOutput += `URL: ${pingResponse.url || 'N/A'}<br>`;
            debugOutput += `是職位頁面: ${pingResponse.isJobPage ? '✅ 是' : '❌ 否'}<br>`;
            debugOutput += `</div>`;
          } else {
            debugOutput += `<div style="border: 1px solid #ff9800; padding: 10px; margin: 5px 0; border-radius: 3px; background: #fff3e0;">`;
            debugOutput += `<strong>⚠️ Content Script回應異常</strong><br>`;
            debugOutput += `回應: ${JSON.stringify(pingResponse)}`;
            debugOutput += `</div>`;
          }
        } catch (pingError) {
          debugOutput += `<div style="border: 1px solid #f44336; padding: 10px; margin: 5px 0; border-radius: 3px; background: #ffebee;">`;
          debugOutput += `<strong>❌ Content Script連接失敗</strong><br>`;
          debugOutput += `錯誤: ${pingError.message}`;
          debugOutput += `</div>`;
          throw pingError; // 如果ping失敗，就不要繼續嘗試extraction
        }
        
        // 再嘗試提取職位信息
        debugOutput += '<div style="margin: 5px 0;"><em>正在提取職位信息...</em></div>';
        const jobData = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' });
        
        if (jobData && jobData.success) {
          debugOutput += `<div style="border: 1px solid #4caf50; padding: 10px; margin: 5px 0; border-radius: 3px; background: #e8f5e9;">`;
          debugOutput += `<strong>✅ 職位信息提取成功</strong><br>`;
          debugOutput += `職位標題: ${jobData.data?.title || 'N/A'}<br>`;
          debugOutput += `公司名稱: ${jobData.data?.company || 'N/A'}<br>`;
          debugOutput += `職責數量: ${jobData.data?.responsibilities?.length || 0}<br>`;
          debugOutput += `要求數量: ${jobData.data?.requirements?.length || 0}<br>`;
          debugOutput += `詳細資訊: ${!!jobData.data?.details ? '✅' : '❌'}<br>`;
          debugOutput += `</div>`;
          
          // 顯示提取的職責和要求示例
          if (jobData.data?.responsibilities?.length > 0) {
            debugOutput += '<div style="margin: 10px 0;"><strong>職責示例 (前3項)：</strong></div>';
            debugOutput += `<div style="border: 1px solid #2196f3; padding: 10px; margin: 5px 0; border-radius: 3px; background: #e3f2fd;">`;
            jobData.data.responsibilities.slice(0, 3).forEach((resp, index) => {
              debugOutput += `${index + 1}. ${resp}<br>`;
            });
            debugOutput += `</div>`;
          }
          
          if (jobData.data?.requirements?.length > 0) {
            debugOutput += '<div style="margin: 10px 0;"><strong>要求示例 (前3項)：</strong></div>';
            debugOutput += `<div style="border: 1px solid #9c27b0; padding: 10px; margin: 5px 0; border-radius: 3px; background: #f3e5f5;">`;
            jobData.data.requirements.slice(0, 3).forEach((req, index) => {
              debugOutput += `${index + 1}. ${req}<br>`;
            });
            debugOutput += `</div>`;
          }
          
          // 3. 準備發送到API的數據（模擬serviceWorker的處理）
          const enrichedJobData = {
            title: jobData.data.title || 'Unknown Position',
            company: jobData.data.company || 'Unknown Company',
            responsibilities: jobData.data.responsibilities || [],
            requirements: jobData.data.requirements || [],
            details: jobData.data.details || {
              url: tab.url,
              extractedAt: new Date().toISOString()
            },
            metadata: {
              extractedAt: new Date().toISOString(),
              source: 'jobsdb-extension',
              version: '1.0.0'
            }
          };
          
          debugOutput += '<div style="margin: 15px 0;"><strong>準備發送到N8n的Job數據：</strong></div>';
          debugOutput += `<div style="border: 1px solid #2196f3; padding: 10px; margin: 5px 0; border-radius: 3px; background: #e3f2fd;">`;
          debugOutput += `<pre style="margin: 0; font-size: 11px; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">${JSON.stringify(enrichedJobData, null, 2)}</pre>`;
          debugOutput += `</div>`;
          
          // 4. 檢查JSON序列化
          const jobDetailsString = JSON.stringify(enrichedJobData);
          debugOutput += '<div style="margin: 15px 0;"><strong>JSON序列化驗證：</strong></div>';
          debugOutput += `<div style="border: 1px solid #ff9800; padding: 10px; margin: 5px 0; border-radius: 3px; background: #fff3e0;">`;
          debugOutput += `JSON字符串長度: ${jobDetailsString.length}<br>`;
          debugOutput += `JSON有效性: ${(() => {
            try {
              JSON.parse(jobDetailsString);
              return '✅ 有效';
            } catch (e) {
              return '❌ 無效: ' + e.message;
            }
          })()}<br>`;
          debugOutput += `JSON預覽: ${jobDetailsString.substring(0, 200)}...`;
          debugOutput += `</div>`;
          
        } else {
          debugOutput += `<div style="border: 1px solid #f44336; padding: 10px; margin: 5px 0; border-radius: 3px; background: #ffebee;">`;
          debugOutput += `<strong>❌ 職位信息提取失敗</strong><br>`;
          debugOutput += `錯誤: ${jobData?.error || '未知錯誤'}<br>`;
          if (!isJobsDBPage) {
            debugOutput += `可能原因: 不是JobsDB職位頁面，Content Script未載入`;
          }
          debugOutput += `</div>`;
        }
        
      } catch (communicationError) {
        debugOutput += `<div style="border: 1px solid #f44336; padding: 10px; margin: 5px 0; border-radius: 3px; background: #ffebee;">`;
        debugOutput += `<strong>❌ 與Content Script通信失敗</strong><br>`;
        debugOutput += `錯誤: ${communicationError.message}<br>`;
        if (communicationError.message.includes('Could not establish connection')) {
          debugOutput += `<strong>可能原因：</strong><br>`;
          debugOutput += `1. 不是JobsDB職位頁面，Content Script未自動載入<br>`;
          debugOutput += `2. 頁面尚未完全載入<br>`;
          debugOutput += `3. Content Script初始化失敗<br>`;
          debugOutput += `<br><strong>解決方案：</strong><br>`;
          debugOutput += `1. 確保當前頁面是 https://hk.jobsdb.com/job/* 格式<br>`;
          debugOutput += `2. 刷新頁面後重試<br>`;
          debugOutput += `3. 檢查擴展是否正確載入`;
        }
        debugOutput += `</div>`;
      }
      
      // 5. N8n接收建議
      debugOutput += '<div style="margin: 15px 0;"><strong>N8n接收建議：</strong></div>';
      debugOutput += `<div style="border: 1px solid #607d8b; padding: 10px; margin: 5px 0; border-radius: 3px; background: #eceff1;">`;
      debugOutput += `請在N8n工作流程中：<br>`;
      debugOutput += `1. 使用 "Webhook" 節點接收POST請求<br>`;
      debugOutput += `2. 解析 "jobDetails" 字段為JSON<br>`;
      debugOutput += `3. 確保可以接收 "cvFile" 文件<br>`;
      debugOutput += `4. 檢查webhook URL是否正確配置<br>`;
      debugOutput += `5. 驗證所有字段都被正確接收`;
      debugOutput += `</div>`;
      
      document.getElementById('debug-output').innerHTML = debugOutput;
      document.getElementById('debug-output').style.display = 'block';
      
      this.showMessage('職位信息提取調試完成', 'info');
      logger.info('Job extraction debug completed');
      
    } catch (error) {
      logger.error('Failed to debug job extraction', error);
      document.getElementById('debug-output').innerHTML = 
        `<div style="color: red; padding: 10px; background: #ffe6e6; border-radius: 4px;">
          <strong>❌ 職位信息調試失敗:</strong> ${error.message}
        </div>`;
      document.getElementById('debug-output').style.display = 'block';
    }
  }

  /**
   * Refreshes all data and UI
   */
  async refreshData() {
    try {
      logger.info('Refreshing popup data');
      this.showMessage('正在刷新...', 'info');

      // Reload initial data
      await this.loadInitialData();

      // Update UI
      this.updateUI();

      this.showMessage('刷新完成', 'success');
      logger.info('Popup data refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh data', error);
      this.showError('刷新失敗：' + error.message);
    }
  }

  /**
   * 智能解析consideration文本，提取結構化信息
   */
  parseConsiderationText(text) {
    const result = {
      strengths: [],
      improvements: [],
      recommendations: [],
      formattedText: text
    };

    try {
      // 移除過多的換行符
      let cleanText = text.replace(/\n{3,}/g, '\n\n');
      
      // 提取優勢部分
      const strengthsMatch = cleanText.match(/\*\*優勢[：:]\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
      if (strengthsMatch) {
        const strengthsText = strengthsMatch[1];
        // 提取項目符號列表
        const strengthItems = strengthsText.match(/[*•]\s*\*\*([^*]+)\*\*[：:]?\s*([^\n*•]+)/g);
        if (strengthItems) {
          result.strengths = strengthItems.map(item => {
            const match = item.match(/[*•]\s*\*\*([^*]+)\*\*[：:]?\s*([^\n*•]+)/);
            return match ? `${match[1]}: ${match[2].trim()}` : item.replace(/[*•]\s*/, '');
          });
        }
      }

      // 提取考慮點/改進建議
      const improvementsMatch = cleanText.match(/\*\*潛在的考慮點[^*]*\*\*\s*([\s\S]*?)(?=綜合來看|$)/i);
      if (improvementsMatch) {
        const improvementsText = improvementsMatch[1];
        const improvementItems = improvementsText.match(/[*•]\s*\*\*([^*]+)\*\*[：:]?\s*([^\n*•]+)/g);
        if (improvementItems) {
          result.improvements = improvementItems.map(item => {
            const match = item.match(/[*•]\s*\*\*([^*]+)\*\*[：:]?\s*([^\n*•]+)/);
            return match ? `${match[1]}: ${match[2].trim()}` : item.replace(/[*•]\s*/, '');
          });
        }
      }

      // 格式化文本 - 改善可讀性
      let formatted = cleanText
        // 標題格式化
        .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #a54858;">$1</strong>')
        // 項目符號
        .replace(/([*•])\s*/g, '• ')
        // 段落分隔
        .replace(/\n\n/g, '</p><p>')
        // 包裝在段落標籤中
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');

      result.formattedText = formatted;

      logger.debug('Parsed consideration text', {
        strengthsCount: result.strengths.length,
        improvementsCount: result.improvements.length,
        hasFormattedText: !!result.formattedText
      });

    } catch (error) {
      logger.warn('Failed to parse consideration text', error);
      // 如果解析失敗，至少做基本格式化
      result.formattedText = text
        .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #a54858;">$1</strong>')
        .replace(/\n/g, '<br>');
    }

    return result;
  }

  /**
   * Extracts job information from current page
   */
  async extractJobInfo() {
    try {
      logger.info('Extracting job information from current page');
      
      const extractBtn = document.getElementById('extract-job-btn');
      const originalText = extractBtn.innerHTML;
      
      // Show loading state (移除旋轉動畫)
      extractBtn.innerHTML = '<span class="icon">📄</span>載入中...';
      extractBtn.disabled = true;

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        throw new Error('無法取得當前分頁');
      }

      // Check if this is a supported website
      const isJobsDBPage = tab.url.includes('jobsdb.com/job/');
      const isSupportedSite = this._isSupportedJobSite(tab.url);
      
      logger.debug('Site detection', {
        url: tab.url,
        isJobsDBPage,
        isSupportedSite
      });

      // First try to communicate with content script
      let response = null;
      let needsScriptInjection = false;

      try {
        // Test if content script is already available
        response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        logger.debug('Content script ping response', response);
      } catch (pingError) {
        logger.warn('Content script not available, will inject if possible', pingError);
        needsScriptInjection = true;
      }

      // If content script is not available, try to inject for supported sites
      if (needsScriptInjection) {
        try {
          if (isSupportedSite || !isJobsDBPage) {
            logger.info('Injecting content scripts for site:', tab.url);
            
            // Inject the necessary scripts
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/services/LoggerService.js', 'src/extractors/GenericJobExtractor.js']
            });

            // Inject dynamic content script
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                // Dynamic content script injection
                try {
                  console.log('🔧 Setting up dynamic job extractor...');
                  
                  window.JOBSDB_CONTENT_SCRIPT_LOADED = true;
                  window.JOBSDB_CONTENT_SCRIPT_VERSION = '1.0.0-dynamic';
                  
                  // Initialize logger
                  if (!window.logger && window.LoggerService) {
                    window.logger = new window.LoggerService('DynamicExtractor');
                  }
                  
                  // Initialize generic extractor
                  if (window.GenericJobExtractor && !window.genericExtractor) {
                    window.genericExtractor = new window.GenericJobExtractor(window.logger);
                    console.log('✅ Dynamic generic extractor initialized');
                  }
                  
                  // Set up message listener
                  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                    console.log('📨 Dynamic extractor received message:', request);
                    
                    if (request.action === 'ping') {
                      sendResponse({
                        success: true,
                        message: 'Dynamic content script responding',
                        loaded: true,
                        version: '1.0.0-dynamic',
                        url: window.location.href,
                        isJobPage: true,
                        extractor: 'dynamic'
                      });
                      return true;
                    }
                    
                    if (request.action === 'extractJobInfo') {
                      (async () => {
                        try {
                          if (window.genericExtractor) {
                            const jobInfo = await window.genericExtractor.extractJobInfo();
                            console.log('✅ Dynamic extraction successful:', jobInfo);
                            sendResponse({
                              success: true,
                              data: jobInfo
                            });
                          } else {
                            throw new Error('Dynamic extractor not available');
                          }
                        } catch (error) {
                          console.error('❌ Dynamic extraction failed:', error);
                          sendResponse({
                            success: false,
                            error: error.message
                          });
                        }
                      })();
                      return true;
                    }
                    
                    return false;
                  });
                  
                  console.log('✅ Dynamic extractor setup complete');
                  
                } catch (error) {
                  console.error('❌ Failed to setup dynamic extractor:', error);
                }
              }
            });

            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            this.showMessage('已載入提取器，正在分析頁面...', 'info');
            
          } else {
            throw new Error('unsupported_site');
          }
          
        } catch (injectionError) {
          if (injectionError.message === 'unsupported_site') {
            throw new Error(`此網站暫不支援自動提取\n\n✅ 支援的網站：\n• JobsDB (hk.jobsdb.com)\n• 政府職位網 (jobs.gov.hk)\n• 香港青年協會 (hkfyg.org.hk)\n• Indeed (indeed.com.hk)\n• LinkedIn Jobs\n• CPJobs\n\n💡 建議：請前往 JobsDB 搜索相關職位`);
          } else {
            logger.error('Failed to inject content scripts', injectionError);
            throw new Error(`無法在此網站載入提取器：${injectionError.message}`);
          }
        }
      }

      // Now try to extract job info
      try {
        response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' });
        
        if (response && response.success) {
          // Update job info display
          this.updateJobInfoDisplay(response.data);
          
          // Show appropriate success message
          if (isJobsDBPage) {
            this.showMessage('JobsDB 職位信息提取成功', 'success');
          } else {
            this.showMessage(`職位信息提取成功 (通用提取器)`, 'success');
          }
          
          // Enable analysis button if CV is available
          if (this.currentCV) {
            document.getElementById('analyze-btn').disabled = false;
          }
        } else {
          throw new Error(response?.error || '提取失敗');
        }

      } catch (extractionError) {
        logger.error('Job extraction failed', extractionError);
        
        // Provide specific error messages
        if (extractionError.message.includes('Could not establish connection')) {
          if (isJobsDBPage) {
            throw new Error('JobsDB 頁面載入中，請稍後重試或刷新頁面');
          } else {
            throw new Error(`此網站暫不支援自動提取\n\n建議：\n1. 前往 JobsDB 搜索相關職位\n2. 手動輸入職位信息\n3. 等待後續版本支援更多網站`);
          }
        } else {
          throw extractionError;
        }
      }

    } catch (error) {
      logger.error('Failed to extract job info', error);
      this.showError('職位信息提取失敗：\n' + error.message);
    } finally {
      // Restore button
      const extractBtn = document.getElementById('extract-job-btn');
      extractBtn.innerHTML = '<span class="icon">🔍</span>提取資訊';
      extractBtn.disabled = false;
    }
  }

  /**
   * Check if the URL is from a supported job site
   * @private
   */
  _isSupportedJobSite(url) {
    const supportedSites = [
      'jobsdb.com',
      'jobs.gov.hk',
      'hkfyg.org.hk',
      'cpjobs.com',
      'indeed.com',
      'linkedin.com',
      'recruiter.com.hk'
    ];
    
    return supportedSites.some(site => url.includes(site));
  }

  /**
   * Updates job info display with extracted data
   */
  updateJobInfoDisplay(jobData) {
    try {
      document.getElementById('job-title').textContent = jobData.title || '未知職位';
      document.getElementById('job-responsibilities').textContent = `${jobData.responsibilities?.length || 0} 項`;
      document.getElementById('job-requirements').textContent = `${jobData.requirements?.length || 0} 項`;
      
      // 處理公司信息 - 如果是空或"未知"就隱藏整行
      const companyElement = document.getElementById('job-company');
      const companyRow = companyElement.closest('.job-info-item');
      
      if (jobData.company && jobData.company.trim() && jobData.company !== '未知') {
        companyElement.textContent = jobData.company;
        companyRow.style.display = 'flex';
      } else {
        companyRow.style.display = 'none';
      }
      
      // Store job data for analysis
      this.currentJobData = jobData;
      
      logger.debug('Job info display updated', {
        title: jobData.title,
        company: jobData.company,
        companyDisplayed: !!(jobData.company && jobData.company.trim() && jobData.company !== '未知'),
        responsibilitiesCount: jobData.responsibilities?.length || 0,
        requirementsCount: jobData.requirements?.length || 0
      });
    } catch (error) {
      logger.error('Failed to update job info display', error);
    }
  }
}

// Initialize the popup app when DOM is ready
let app;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

/**
 * Initializes the popup application
 */
async function initializePopup() {
  try {
    app = new PopupApp();
    await app.init();
  } catch (error) {
    logger.error('Failed to initialize popup', error);
  }
}

// Make app globally available for inline event handlers
window.app = app; 