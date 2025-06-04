/**
 * Content script for JobsDB job extraction
 * Follows Dependency Inversion Principle - depends on abstractions
 */

// Add debug logging for content script loading
console.log('🔧 JobsDB Content Script: Starting to load...');

// Add a global flag to indicate content script is loaded
window.JOBSDB_CONTENT_SCRIPT_LOADED = true;
window.JOBSDB_CONTENT_SCRIPT_VERSION = '1.0.0';

// Initialize services (with guards to prevent duplicate declarations)
if (!window.logger) {
  window.logger = new (globalThis.LoggerService || window.LoggerService)('ContentScript');
}
if (!window.jobsDBExtractor) {
  window.jobsDBExtractor = new (globalThis.JobsDBExtractor || window.JobsDBExtractor)(window.logger);
}
if (!window.genericExtractor) {
  window.genericExtractor = new (globalThis.GenericJobExtractor || window.GenericJobExtractor)(window.logger);
}

// Use window properties for consistent access
const logger = window.logger;
const jobsDBExtractor = window.jobsDBExtractor;
const genericExtractor = window.genericExtractor;

console.log('🔧 JobsDB Content Script: Services initialized', {
  hasLogger: !!logger,
  hasJobsDBExtractor: !!jobsDBExtractor,
  hasGenericExtractor: !!genericExtractor,
  contentScriptLoaded: window.JOBSDB_CONTENT_SCRIPT_LOADED,
  version: window.JOBSDB_CONTENT_SCRIPT_VERSION
});

// Set up message listener immediately (before any async operations)
console.log('🔧 JobsDB Content Script: Setting up message listener...');

// Add immediate message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🔧 JobsDB Content Script: Received message', request);
  
  // Handle test/ping requests
  if (request.action === 'ping' || request.action === 'test') {
    console.log('🔧 JobsDB Content Script: Responding to ping/test');
    
    // Check if smartExtractor is initialized
    const smartExtractorReady = window.smartExtractor || globalThis.smartExtractor;
    let isJobPage = false;
    
    try {
      if (smartExtractorReady) {
        isJobPage = smartExtractorReady.isValidJobPage();
      }
    } catch (error) {
      console.warn('🔧 JobsDB Content Script: Error checking if valid job page', error);
    }
    
    sendResponse({
      success: true,
      message: 'Content script is loaded and responding',
      loaded: window.JOBSDB_CONTENT_SCRIPT_LOADED,
      version: window.JOBSDB_CONTENT_SCRIPT_VERSION,
      url: window.location.href,
      isJobPage: isJobPage,
      smartExtractorReady: !!smartExtractorReady
    });
    return true;
  }
  
  // Handle job extraction requests
  if (request.action === 'extractJobInfo') {
    console.log('🔧 JobsDB Content Script: Handling extractJobInfo request');
    
    // Use async function with sendResponse
    (async () => {
      try {
        const result = await window.extractJobInfoForPopup();
        console.log('🔧 JobsDB Content Script: Job extraction successful', result);
        sendResponse(result);
      } catch (error) {
        console.error('🔧 JobsDB Content Script: Job extraction failed', error);
        sendResponse({
          success: false,
          error: error.message || 'Unknown error occurred'
        });
      }
    })();
    
    return true; // Keep message channel open for async response
  }
  
  console.log('🔧 JobsDB Content Script: Unknown action', request.action);
  return false;
});

console.log('🔧 JobsDB Content Script: Message listener registered');

/**
 * Smart job extractor that tries multiple extraction strategies
 * Follows Open-Closed Principle - open for extension with new extractors
 */
if (typeof SmartJobExtractor === 'undefined') {
  window.SmartJobExtractor = class SmartJobExtractor {
    constructor(logger) {
      this.logger = logger;
      this.extractors = [
        { name: 'JobsDB', extractor: jobsDBExtractor },
        { name: 'Generic', extractor: genericExtractor }
      ];
    }

    /**
     * Determines if any extractor considers this a valid job page
     */
    isValidJobPage() {
      for (const { name, extractor } of this.extractors) {
        try {
          if (extractor.isValidJobPage()) {
            this.logger.debug(`${name} extractor validated the page`);
            return true;
          }
        } catch (error) {
          this.logger.debug(`${name} extractor failed validation`, error);
        }
      }
      return false;
    }

    /**
     * Attempts to extract job info using the best available extractor
     */
    async extractJobInfo() {
      let lastError = null;
      
      for (const { name, extractor } of this.extractors) {
        try {
          this.logger.debug(`Trying ${name} extractor`);
          
          if (extractor.isValidJobPage()) {
            const jobInfo = await extractor.extractJobInfo();
            
            // Validate that we got meaningful data
            if (this._isValidJobInfo(jobInfo)) {
              this.logger.info(`Successfully extracted job info using ${name} extractor`);
              return jobInfo;
            } else {
              this.logger.warn(`${name} extractor returned insufficient data`);
            }
          } else {
            this.logger.debug(`${name} extractor considers page invalid`);
          }
        } catch (error) {
          this.logger.warn(`${name} extractor failed`, error);
          lastError = error;
        }
      }
      
      // If no extractor succeeded, throw the last error or a generic one
      throw lastError || new Error('No extractor could process this page');
    }

    /**
     * Validates that job info contains meaningful data
     * @private
     */
    _isValidJobInfo(jobInfo) {
      if (!jobInfo) return false;
      
      // At least one of these should be present
      const hasTitle = jobInfo.title && jobInfo.title.trim().length > 0;
      const hasCompany = jobInfo.company && jobInfo.company.trim().length > 0;
      const hasResponsibilities = jobInfo.responsibilities && jobInfo.responsibilities.length > 0;
      const hasRequirements = jobInfo.requirements && jobInfo.requirements.length > 0;
      
      return hasTitle || hasCompany || hasResponsibilities || hasRequirements;
    }
  }
}

// Ensure SmartJobExtractor is available globally
if (typeof window !== 'undefined' && !window.SmartJobExtractor) {
  window.SmartJobExtractor = SmartJobExtractor;
}

// Initialize smart extractor
if (!window.smartExtractor) {
  window.smartExtractor = new (globalThis.SmartJobExtractor || window.SmartJobExtractor)(logger);
}
const smartExtractor = window.smartExtractor;

console.log('🔧 JobsDB Content Script: Smart extractor initialized', {
  hasSmartExtractor: !!smartExtractor,
  smartExtractorType: smartExtractor?.constructor?.name
});

/**
 * Main application controller
 * Follows Single Responsibility Principle - orchestrates the job extraction workflow
 */
if (typeof JobExtractorApp === 'undefined') {
  window.JobExtractorApp = class JobExtractorApp {
    constructor() {
      this.isInitialized = false;
      this.ui = null;
      this.currentJobData = null;
    }

    /**
     * Initializes the application
     */
    async init() {
      try {
        logger.info('Initializing JobsDB extractor');

        // Check if we're on a valid job page
        if (!smartExtractor.isValidJobPage()) {
          logger.debug('Not a valid job page, skipping initialization');
          return;
        }

        // Create and inject UI
        this.createUI();
        
        // Extract job data
        await this.extractJobData();
        
        this.isInitialized = true;
        logger.info('JobsDB extractor initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize JobsDB extractor', error);
      }
    }

    /**
     * Creates and injects the UI into the page
     */
    createUI() {
      try {
        // Remove existing UI if any
        const existingUI = document.getElementById('jobsdb-cv-matcher');
        if (existingUI) {
          existingUI.remove();
        }

        // Create UI container
        const container = document.createElement('div');
        container.id = 'jobsdb-cv-matcher';
        container.className = 'jobsdb-cv-matcher-container';
        
        container.innerHTML = `
          <div class="jcm-panel">
            <div class="jcm-header">
              <div class="jcm-title">
                <span class="jcm-icon">🎯</span>
                <span>CV匹配分析</span>
              </div>
              <button class="jcm-toggle" id="jcm-toggle">
                <span class="jcm-arrow">▼</span>
              </button>
            </div>
            <div class="jcm-content" id="jcm-content">
              <div class="jcm-loading" id="jcm-loading">
                <div class="jcm-spinner"></div>
                <span>正在提取職位信息...</span>
              </div>
              <div class="jcm-main" id="jcm-main" style="display: none;">
                <div class="jcm-job-info">
                  <h4>職位信息</h4>
                  <div class="jcm-job-details" id="jcm-job-details">
                    <!-- Job details will be populated here -->
                  </div>
                </div>
                <div class="jcm-cv-section">
                  <h4>CV管理</h4>
                  <div class="jcm-cv-upload">
                    <input type="file" id="jcm-cv-file" accept=".pdf,.doc,.docx,.txt" style="display: none;">
                    <button class="jcm-button jcm-button-secondary" id="jcm-upload-btn">
                      <span class="jcm-upload-icon">📁</span>
                      上傳CV
                    </button>
                    <div class="jcm-current-cv" id="jcm-current-cv" style="display: none;">
                      <span class="jcm-cv-name" id="jcm-cv-name"></span>
                      <button class="jcm-button-small" id="jcm-change-cv">更換</button>
                    </div>
                  </div>
                </div>
                <div class="jcm-analysis">
                  <button class="jcm-button jcm-button-primary" id="jcm-analyze-btn" disabled>
                    <span class="jcm-analyze-icon">🔍</span>
                    開始分析匹配度
                  </button>
                </div>
                <div class="jcm-results" id="jcm-results" style="display: none;">
                  <!-- Analysis results will be populated here -->
                </div>
              </div>
              <div class="jcm-error" id="jcm-error" style="display: none;">
                <div class="jcm-error-message" id="jcm-error-message"></div>
                <button class="jcm-button jcm-button-secondary" id="jcm-retry-btn">重試</button>
              </div>
            </div>
          </div>
        `;

        // Inject into page
        document.body.appendChild(container);

        // Add event listeners
        this.attachEventListeners();

        logger.info('UI created and injected');
      } catch (error) {
        logger.error('Failed to create UI', error);
      }
    }

    /**
     * Attaches event listeners to UI elements
     */
    attachEventListeners() {
      try {
        // Toggle panel
        document.getElementById('jcm-toggle').addEventListener('click', this.togglePanel.bind(this));

        // CV upload
        document.getElementById('jcm-upload-btn').addEventListener('click', () => {
          document.getElementById('jcm-cv-file').click();
        });

        document.getElementById('jcm-cv-file').addEventListener('change', this.handleFileUpload.bind(this));

        // Change CV
        document.getElementById('jcm-change-cv').addEventListener('click', () => {
          document.getElementById('jcm-cv-file').click();
        });

        // Analyze button
        document.getElementById('jcm-analyze-btn').addEventListener('click', this.analyzeMatch.bind(this));

        // Retry button
        document.getElementById('jcm-retry-btn').addEventListener('click', this.retryExtraction.bind(this));

        logger.debug('Event listeners attached');
      } catch (error) {
        logger.error('Failed to attach event listeners', error);
      }
    }

    /**
     * Toggles the panel visibility
     */
    togglePanel() {
      try {
        const content = document.getElementById('jcm-content');
        const arrow = document.querySelector('.jcm-arrow');
        
        if (content.style.display === 'none') {
          content.style.display = 'block';
          arrow.textContent = '▼';
        } else {
          content.style.display = 'none';
          arrow.textContent = '▶';
        }
      } catch (error) {
        logger.error('Failed to toggle panel', error);
      }
    }

    /**
     * Extracts job data from the page
     */
    async extractJobData() {
      try {
        logger.info('Starting job data extraction');

        // Show loading state
        this.showLoading(true);

        // Extract job information
        this.currentJobData = await smartExtractor.extractJobInfo();

        // Update UI with job data
        this.displayJobInfo(this.currentJobData);

        // Check for existing CV
        await this.loadCurrentCV();

        // Show main content
        this.showMainContent();

        logger.info('Job data extraction completed');
      } catch (error) {
        logger.error('Job data extraction failed', error);
        this.showError('無法提取職位信息：' + error.message);
      }
    }

    /**
     * Displays job information in the UI
     */
    displayJobInfo(jobData) {
      try {
        const container = document.getElementById('jcm-job-details');
        
        // 構建職位信息HTML，但只在有效時顯示公司信息
        let jobInfoHTML = `
          <div class="jcm-info-item">
            <strong>職位：</strong>${jobData.title || '未知'}
          </div>
        `;
        
        // 只有當公司信息有效時才添加公司行
        if (jobData.company && jobData.company.trim() && jobData.company !== '未知') {
          jobInfoHTML += `
            <div class="jcm-info-item">
              <strong>公司：</strong>${jobData.company}
            </div>
          `;
        }
        
        jobInfoHTML += `
          <div class="jcm-info-item">
            <strong>職責：</strong>${jobData.responsibilities.length} 項
          </div>
          <div class="jcm-info-item">
            <strong>要求：</strong>${jobData.requirements.length} 項
          </div>
        `;
        
        container.innerHTML = jobInfoHTML;

        logger.debug('Job information displayed in content script', {
          title: jobData.title,
          company: jobData.company,
          companyDisplayed: !!(jobData.company && jobData.company.trim() && jobData.company !== '未知'),
          responsibilitiesCount: jobData.responsibilities.length,
          requirementsCount: jobData.requirements.length
        });
      } catch (error) {
        logger.error('Failed to display job information', error);
      }
    }

    /**
     * Loads current CV information
     */
    async loadCurrentCV() {
      try {
        // Send message to background script to get current CV
        const response = await chrome.runtime.sendMessage({
          action: 'getCurrentCV'
        });

        if (response && response.success && response.cv) {
          this.displayCurrentCV(response.cv);
          this.enableAnalysis();
        }
      } catch (error) {
        logger.error('Failed to load current CV', error);
      }
    }

    /**
     * Displays current CV information
     */
    displayCurrentCV(cv) {
      try {
        const currentCVDiv = document.getElementById('jcm-current-cv');
        const cvNameSpan = document.getElementById('jcm-cv-name');
        
        cvNameSpan.textContent = cv.name;
        currentCVDiv.style.display = 'flex';
        
        logger.debug('Current CV displayed', { cvName: cv.name });
      } catch (error) {
        logger.error('Failed to display current CV', error);
      }
    }

    /**
     * Handles file upload
     */
    async handleFileUpload(event) {
      try {
        const file = event.target.files[0];
        if (!file) return;

        logger.info('CV file selected', { fileName: file.name, fileSize: file.size });

        // Show uploading state
        this.showUploading();

        // Send file to background script for processing
        const response = await chrome.runtime.sendMessage({
          action: 'uploadCV',
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          }
        });

        if (response && response.success) {
          this.displayCurrentCV(response.cv);
          this.enableAnalysis();
          this.showSuccess('CV上傳成功！');
        } else {
          throw new Error(response.error || 'CV上傳失敗');
        }

      } catch (error) {
        logger.error('CV upload failed', error);
        this.showError('CV上傳失敗：' + error.message);
      }
    }

    /**
     * Performs job-CV match analysis
     */
    async analyzeMatch() {
      const analyzeBtn = document.getElementById('jcm-analyze-btn');
      const resultsDiv = document.getElementById('jcm-results');
      
      try {
        if (!this.currentJobData) {
          throw new Error('沒有職位數據');
        }

        logger.info('Starting job-CV match analysis');

        // 改善UX - 顯示載入狀態
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span> 分析中...';
        analyzeBtn.style.opacity = '0.7';
        
        // 清除之前的結果
        resultsDiv.innerHTML = '';
        resultsDiv.style.display = 'none';
        
        // 顯示進度信息
        this.showAnalysisProgress('🔍 正在準備分析...');

        // Send analysis request to background script
        const response = await chrome.runtime.sendMessage({
          action: 'analyzeMatch',
          jobData: this.currentJobData
        });

        // 詳細的響應檢查和日誌記錄
        logger.info('Analysis API response received in content script', {
          hasResponse: !!response,
          responseType: typeof response,
          success: response?.success,
          hasAnalysis: !!response?.analysis,
          analysisType: typeof response?.analysis,
          error: response?.error
        });
        
        // 添加控制台調試信息 - 查看實際數據
        console.log('🔍 CONTENT DEBUG: 完整的API響應', response);
        console.log('🔍 CONTENT DEBUG: response.analysis', response?.analysis);
        if (Array.isArray(response?.analysis) && response.analysis.length > 0) {
          console.log('🔍 CONTENT DEBUG: response.analysis[0]', response.analysis[0]);
          if (response.analysis[0].output) {
            console.log('🔍 CONTENT DEBUG: response.analysis[0].output', response.analysis[0].output);
            console.log('🔍 CONTENT DEBUG: vote值原始', response.analysis[0].output.vote);
            console.log('🔍 CONTENT DEBUG: vote值類型', typeof response.analysis[0].output.vote);
          }
        }

        if (response && response.success && response.analysis) {
          this.displayAnalysisResults(response.analysis);
          this.showSuccess('✅ AI分析完成！');
        } else {
          const errorMsg = response?.error || '分析失敗';
          logger.error('Analysis failed in content script', { response, errorMsg });
          
          // 顯示錯誤結果
          resultsDiv.innerHTML = `
            <div style="background: rgba(244, 68, 54, 0.1); border: 1px solid #f44336; border-radius: 8px; padding: 16px; color: #d32f2f;">
              <h5 style="color: #d32f2f; margin-bottom: 8px;">❌ 分析失敗</h5>
              <p style="margin: 0; color: #d32f2f;">${errorMsg}</p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">請檢查網路連接和API配置，然後重試。</p>
            </div>
          `;
          resultsDiv.style.display = 'block';
          
          throw new Error(errorMsg);
        }

      } catch (error) {
        logger.error('Match analysis failed', error);
        
        // 顯示錯誤狀態
        resultsDiv.innerHTML = `
          <div style="background: rgba(244, 68, 54, 0.1); border: 1px solid #f44336; border-radius: 8px; padding: 16px; color: #d32f2f;">
            <h5 style="color: #d32f2f; margin-bottom: 8px;">❌ 分析過程出錯</h5>
            <p style="margin: 0; color: #d32f2f;">${error.message}</p>
            <div style="margin-top: 12px;">
              <button onclick="location.reload()" style="background: #a54858; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                🔄 重新載入頁面
              </button>
            </div>
          </div>
        `;
        resultsDiv.style.display = 'block';
        
        this.showError('分析失敗：' + error.message);
      } finally {
        // 恢復按鈕狀態
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span class="jcm-analyze-icon">🔍</span>開始分析匹配度';
        analyzeBtn.style.opacity = '1';
      }
    }

    /**
     * Shows analysis progress message
     */
    showAnalysisProgress(message) {
      // 創建或更新進度消息
      let progressDiv = document.getElementById('jcm-analysis-progress');
      if (!progressDiv) {
        progressDiv = document.createElement('div');
        progressDiv.id = 'jcm-analysis-progress';
        progressDiv.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(244, 202, 193, 0.95);
          color: #a54858;
          padding: 16px 24px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(165, 72, 88, 0.3);
          z-index: 10002;
          font-weight: 500;
          border: 2px solid #a54858;
          backdrop-filter: blur(10px);
        `;
        document.body.appendChild(progressDiv);
      }
      
      progressDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span>
          <span>${message}</span>
        </div>
      `;
      
      // 3秒後自動移除（如果還存在的話）
      setTimeout(() => {
        if (progressDiv && progressDiv.parentNode) {
          progressDiv.remove();
        }
      }, 3000);
    }

    /**
     * Displays analysis results
     */
    displayAnalysisResults(analysis) {
      try {
        const resultsDiv = document.getElementById('jcm-results');
        
        // 移除進度消息
        const progressDiv = document.getElementById('jcm-analysis-progress');
        if (progressDiv) {
          progressDiv.remove();
        }
        
        // Handle N8n response - handle both array and object formats
        let analysisData = analysis;
        
        // Handle both formats: array format [{"output": {...}}] OR direct object format {"output": {...}}
        let output = null;
        if (Array.isArray(analysis) && analysis.length > 0 && analysis[0].output) {
          // Array format: [{"output": {"vote": "9", "consideration": "..."}}]
          output = analysis[0].output;
          console.log('🔍 CONTENT DEBUG: 使用數組格式', output);
        } else if (analysis.output) {
          // Direct object format: {"output": {"vote": "95%", "consideration": "..."}}
          output = analysis.output;
          console.log('🔍 CONTENT DEBUG: 使用直接對象格式', output);
        }
        
        if (output) {
          logger.debug('Processing N8n output format in content script', { 
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
          console.log('🔍 CONTENT DEBUG: Vote 解析過程');
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
          
          logger.debug('Vote parsing details in content script', {
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
          console.log('🔍 CONTENT DEBUG: 最終 analysisData');
          console.log('  analysisData.vote:', analysisData.vote);
          console.log('  analysisData.voteNumber:', analysisData.voteNumber);
          console.log('  analysisData.matchScore:', analysisData.matchScore);
          
          logger.info('Final analysisData after N8n processing in content script', {
            vote: analysisData.vote,
            voteNumber: analysisData.voteNumber,
            matchScore: analysisData.matchScore,
            hasConsideration: !!analysisData.consideration
          });
        } else {
          logger.warn('No valid output found in analysis data in content script', { 
            analysisData: analysis,
            isArray: Array.isArray(analysis),
            hasOutput: !!analysis.output,
            hasArrayOutput: Array.isArray(analysis) && analysis.length > 0 && analysis[0].output
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
        
        // 準備顯示值和調試
        const displayValue = analysisData.vote || analysisData.voteNumber || (analysisData.matchScore ? analysisData.matchScore + '%' : '0');
        console.log('🔍 CONTENT DEBUG: HTML顯示值');
        console.log('  analysisData.vote:', analysisData.vote);
        console.log('  analysisData.voteNumber:', analysisData.voteNumber); 
        console.log('  analysisData.matchScore:', analysisData.matchScore);
        console.log('  最終顯示值:', displayValue);
        
        resultsDiv.innerHTML = `
          <h4>🎯 AI分析結果</h4>
          <div class="jcm-match-score">
            <div class="jcm-score-circle">
              <span class="jcm-score-value">${displayValue}</span>
            </div>
            <div class="jcm-score-label">${analysisData.vote && analysisData.vote !== '0' ? '專家評分 (0%-100%)' : '匹配度'}</div>
          </div>
          
          ${analysisData.consideration ? `
            <div class="jcm-consideration" style="margin-bottom: 20px;">
              <h5 style="color: #a54858; margin-bottom: 8px;">💡 詳細分析</h5>
              <div style="background: rgba(255, 255, 255, 0.8); padding: 12px; border-radius: 6px; border-left: 4px solid #a54858; line-height: 1.6; font-size: 13px; white-space: pre-wrap; color: #141414 !important;">${analysisData.formattedConsideration}</div>
            </div>
          ` : ''}
          
          ${analysisData.recommendations && analysisData.recommendations.length > 0 ? `
            <div class="jcm-recommendations">
              <h5>📋 建議</h5>
              <ul>
                ${analysisData.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${analysisData.strengths && analysisData.strengths.length > 0 ? `
            <div class="jcm-strengths">
              <h5>✅ 優勢</h5>
              <ul>
                ${analysisData.strengths.map(strength => `<li>${strength}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${analysisData.improvements && analysisData.improvements.length > 0 ? `
            <div class="jcm-improvements">
              <h5>⚠️ 改進建議</h5>
              <ul>
                ${analysisData.improvements.map(improvement => `<li>${improvement}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div style="margin-top: 15px; padding-top: 12px; border-top: 1px solid rgba(165, 72, 88, 0.2); font-size: 11px; color: #888; text-align: center;">
            分析時間: ${new Date().toLocaleString()}
          </div>
        `;

        resultsDiv.style.display = 'block';
        
        // 滾動到結果區域
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        logger.info('Analysis results displayed in content script', { 
          vote: analysisData.vote,
          voteNumber: analysisData.voteNumber,
          matchScore: analysisData.matchScore,
          hasConsideration: !!analysisData.consideration
        });
      } catch (error) {
        logger.error('Failed to display analysis results', error);
      }
    }

    /**
     * Shows loading state
     */
    showLoading(show) {
      const loading = document.getElementById('jcm-loading');
      const main = document.getElementById('jcm-main');
      const error = document.getElementById('jcm-error');

      if (show) {
        loading.style.display = 'flex';
        main.style.display = 'none';
        error.style.display = 'none';
      } else {
        loading.style.display = 'none';
      }
    }

    /**
     * Shows main content
     */
    showMainContent() {
      const loading = document.getElementById('jcm-loading');
      const main = document.getElementById('jcm-main');
      const error = document.getElementById('jcm-error');

      loading.style.display = 'none';
      main.style.display = 'block';
      error.style.display = 'none';
    }

    /**
     * Shows error state
     */
    showError(message) {
      const loading = document.getElementById('jcm-loading');
      const main = document.getElementById('jcm-main');
      const error = document.getElementById('jcm-error');
      const errorMessage = document.getElementById('jcm-error-message');

      loading.style.display = 'none';
      main.style.display = 'none';
      error.style.display = 'block';
      errorMessage.textContent = message;
    }

    /**
     * Shows uploading state
     */
    showUploading() {
      const uploadBtn = document.getElementById('jcm-upload-btn');
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span class="jcm-spinner-small"></span>上傳中...';
    }

    /**
     * Shows analyzing state
     */
    showAnalyzing() {
      const analyzeBtn = document.getElementById('jcm-analyze-btn');
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '<span class="jcm-spinner-small"></span>分析中...';
    }

    /**
     * Resets analyze button
     */
    resetAnalyzeButton() {
      const analyzeBtn = document.getElementById('jcm-analyze-btn');
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '<span class="jcm-analyze-icon">🔍</span>開始分析匹配度';
    }

    /**
     * Enables analysis functionality
     */
    enableAnalysis() {
      const analyzeBtn = document.getElementById('jcm-analyze-btn');
      analyzeBtn.disabled = false;
    }

    /**
     * Shows success message
     */
    showSuccess(message) {
      // Create and show temporary success message
      const successDiv = document.createElement('div');
      successDiv.className = 'jcm-success-message';
      successDiv.textContent = message;
      
      document.getElementById('jcm-content').appendChild(successDiv);
      
      setTimeout(() => {
        successDiv.remove();
      }, 3000);
    }

    /**
     * Retries job extraction
     */
    async retryExtraction() {
      await this.extractJobData();
    }

    /**
     * Parses consideration text and extracts structured information
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

        logger.debug('Parsed consideration text in content script', {
          strengthsCount: result.strengths.length,
          improvementsCount: result.improvements.length,
          hasFormattedText: !!result.formattedText
        });

      } catch (error) {
        logger.warn('Failed to parse consideration text in content script', error);
        // 如果解析失敗，至少做基本格式化
        result.formattedText = text
          .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #a54858;">$1</strong>')
          .replace(/\n/g, '<br>');
      }

      return result;
    }
  }
}

// Ensure JobExtractorApp is available globally
if (typeof window !== 'undefined' && !window.JobExtractorApp) {
  window.JobExtractorApp = JobExtractorApp;
}

console.log('🔧 JobsDB Content Script: JobExtractorApp available', {
  hasJobExtractorApp: !!window.JobExtractorApp,
  hasGlobalJobExtractorApp: !!globalThis.JobExtractorApp,
  jobExtractorAppType: window.JobExtractorApp?.name
});

console.log('🔧 JobsDB Content Script: Message listener set up');

/**
 * Extracts job information for popup requests
 */
if (typeof extractJobInfoForPopup === 'undefined') {
  window.extractJobInfoForPopup = async function extractJobInfoForPopup() {
    try {
      console.log('🔧 JobsDB Content Script: Starting job extraction for popup');
      logger.info('Extracting job info for popup request');
      
      // Check if we're on a valid job page
      if (!smartExtractor.isValidJobPage()) {
        throw new Error('當前頁面不是有效的職位頁面');
      }
      
      // Extract job information
      const jobData = await smartExtractor.extractJobInfo();
      
      if (!jobData) {
        throw new Error('無法提取職位資訊');
      }
      
      console.log('🔧 JobsDB Content Script: Job extraction completed', {
        title: jobData.title,
        company: jobData.company,
        responsibilitiesCount: jobData.responsibilities?.length || 0,
        requirementsCount: jobData.requirements?.length || 0
      });
      
      logger.info('Job info extracted successfully for popup', { 
        title: jobData.title,
        company: jobData.company 
      });
      
      return {
        success: true,
        data: jobData
      };
    } catch (error) {
      console.error('🔧 JobsDB Content Script: Job extraction failed', error);
      logger.error('Failed to extract job info for popup', error);
      throw error;
    }
  }
}

/**
 * Initializes the application
 */
if (typeof initializeApp === 'undefined') {
  window.initializeApp = async function initializeApp() {
    try {
      console.log('🔧 JobsDB Content Script: Initializing app...');
      
      // Verify dependencies
      if (!window.JobExtractorApp && !globalThis.JobExtractorApp) {
        console.error('🔧 JobsDB Content Script: JobExtractorApp not available');
        return;
      }
      
      if (!smartExtractor) {
        console.error('🔧 JobsDB Content Script: smartExtractor not available');
        return;
      }
      
      // Wait a bit for the page to fully load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('🔧 JobsDB Content Script: Creating JobExtractorApp instance...');
      const JobExtractorAppClass = globalThis.JobExtractorApp || window.JobExtractorApp;
      const app = new JobExtractorAppClass();
      
      console.log('🔧 JobsDB Content Script: Calling app.init()...');
      await app.init();
      console.log('🔧 JobsDB Content Script: App initialized successfully');
    } catch (error) {
      console.error('🔧 JobsDB Content Script: App initialization failed', error);
      logger.error('Failed to initialize application', error);
    }
  }
  
  console.log('🔧 JobsDB Content Script: initializeApp function defined');
}

// Final initialization
console.log('🔧 JobsDB Content Script: All functions defined, starting initialization...');

// Verify all dependencies are properly set up
console.log('🔧 JobsDB Content Script: Dependency check', {
  hasLogger: !!logger,
  hasJobsDBExtractor: !!jobsDBExtractor,
  hasGenericExtractor: !!genericExtractor,
  hasSmartExtractor: !!smartExtractor,
  hasJobExtractorApp: !!(window.JobExtractorApp || globalThis.JobExtractorApp),
  hasInitializeApp: typeof window.initializeApp === 'function',
  hasExtractJobInfoForPopup: typeof window.extractJobInfoForPopup === 'function'
});

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
  console.log('🔧 JobsDB Content Script: DOM still loading, waiting...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 JobsDB Content Script: DOM loaded, calling initializeApp');
    if (typeof window.initializeApp === 'function') {
      window.initializeApp();
    } else {
      console.error('🔧 JobsDB Content Script: initializeApp is not a function!');
    }
  });
} else {
  console.log('🔧 JobsDB Content Script: DOM ready, initializing immediately');
  if (typeof window.initializeApp === 'function') {
    window.initializeApp();
  } else {
    console.error('🔧 JobsDB Content Script: initializeApp is not a function!');
  }
}

console.log('🔧 JobsDB Content Script: Fully loaded and ready ✅'); 