/**
 * API service for communication with N8n workflows
 * Follows Single Responsibility Principle - handles only API communication
 * 
 * @class ApiService
 */
if (typeof ApiService === 'undefined') {
  class ApiService {
    /**
     * Creates an instance of ApiService
     * 
     * @param {LoggerService} logger - Logger service instance
     */
    constructor(logger) {
      this.logger = logger;
      this.baseUrl = null;
      this.apiKey = null;
      this.timeout = 120000; // 2 minutes - AI分析需要更多時間
      this.retryAttempts = 3;
      this.retryDelay = 1000;
      this.lastConnectionOk = false; // NEW: Store last connection test result
    }

    /**
     * Initializes the API service with configuration
     * 
     * @param {Object} config - API configuration
     * @param {string} config.baseUrl - N8n webhook URL
     * @param {string} config.apiKey - API key for authentication (optional)
     */
    async initialize(config) {
      try {
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey; // apiKey can be empty or null
        
        this.logger.info('API service initializing with new config...', { 
          baseUrl: this.baseUrl ? 'configured' : 'not configured',
          apiKey: this.apiKey ? 'configured' : 'not configured (optional)'
        });
        
        // Test connection and store the result
        if (this.baseUrl) {
          this.lastConnectionOk = await this.testConnection();
        } else {
          this.lastConnectionOk = false; // Not configured, so connection is not ok
        }
        this.logger.info('API service initialization complete. Connection status:', this.lastConnectionOk);

      } catch (error) {
        this.logger.error('Failed to initialize API service during config update', error);
        this.lastConnectionOk = false; // Ensure status is false on error
        // We might not want to re-throw here if initialization is part of a configure step
        // as the configuration itself might have been saved successfully.
        // The error here mainly pertains to the immediate connection test.
      }
    }

    /**
     * Tests the API connection
     * 
     * @returns {Promise<boolean>} True if connection is successful
     */
    async testConnection() {
      if (!this.baseUrl) {
        this.logger.warn('Cannot test connection, API base URL not configured');
        this.lastConnectionOk = false;
        return false;
      }

      this.logger.info('Testing connection to', this.baseUrl, 'using GET method.');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 增加到30秒

        const response = await fetch(this.baseUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            // Optional: Add any headers your N8N might expect even for a simple GET, if any.
            // 'Accept': '*/*' // Example
          }
        });
        clearTimeout(timeoutId);

        this.logger.info('API connection test (GET) received response', { status: response.status, url: response.url });
        this.lastConnectionOk = true;
        return true;

      } catch (error) {
        this.logger.warn('API connection test (GET) failed with error:', error);
        this.lastConnectionOk = false;
        return false;
      }
    }

    /**
     * Analyzes job data along with CV file content.
     * Sends job details (JSON) and CV file (FormData) to the N8n webhook.
     *
     * @param {Object} jobData - Job information.
     * @param {ArrayBuffer} cvFileContent - The content of the CV file as an ArrayBuffer.
     * @param {string} cvFileName - The name of the CV file.
     * @param {string} cvFileType - The MIME type of the CV file.
     * @returns {Promise<Object>} Analysis result from the N8n workflow.
     */
    async analyzeJobAndCV(jobData, cvFileContent, cvFileName, cvFileType) {
      try {
        this.logger.info('Starting job and CV analysis submission with FormData upload', { 
          hasJobData: !!jobData,
          jobTitle: jobData?.title,
          jobCompany: jobData?.company,
          responsibilitiesCount: jobData?.responsibilities?.length || 0,
          requirementsCount: jobData?.requirements?.length || 0,
          cvFileName,
          cvFileType,
          cvFileSize: cvFileContent ? cvFileContent.byteLength : 0
        });

        if (!this.baseUrl) {
          throw new Error('API base URL not configured. Cannot analyze job and CV.');
        }

        // 驗證輸入數據
        if (!jobData) {
          throw new Error('Job data is required');
        }

        if (!cvFileContent || !(cvFileContent instanceof ArrayBuffer)) {
          throw new Error('Valid CV file content (ArrayBuffer) is required');
        }

        if (!cvFileName) {
          throw new Error('CV file name is required');
        }

        // 創建 FormData
        const formData = new FormData();
        
        // 準備 job details 字符串
        const jobDetailsString = JSON.stringify(jobData);
        this.logger.debug('Prepared job details for FormData sending', {
          jobDetailsLength: jobDetailsString.length,
          jobDetailsPreview: jobDetailsString.substring(0, 200) + '...',
          jobDataKeys: Object.keys(jobData),
          fullJobDetails: jobData // 記錄完整的job數據
        });
        
        // Append job data as a JSON string
        formData.append('jobDetails', jobDetailsString);
        
        // 創建 CV blob 並添加到表單
        const cvBlob = new Blob([cvFileContent], { type: cvFileType });
        
        this.logger.debug('Created CV Blob for FormData', {
          arrayBufferSize: cvFileContent.byteLength,
          blobSize: cvBlob.size,
          blobType: cvBlob.type,
          fileName: cvFileName,
          sizesMatch: cvFileContent.byteLength === cvBlob.size
        });
        
        formData.append('cvFile', cvBlob, cvFileName);
        
        // 添加額外的元數據
        formData.append('timestamp', new Date().toISOString());
        formData.append('source', 'jobsdb-extension');

        // 記錄表單數據內容 - 增強版
        this.logger.info('FormData prepared for submission to N8n', {
          jobDetailsSize: jobDetailsString.length,
          cvFileSize: cvBlob.size,
          cvFileName: cvFileName,
          cvFileType: cvFileType,
          hasJobTitle: !!jobData.title,
          hasJobCompany: !!jobData.company,
          hasJobResponsibilities: !!(jobData.responsibilities && jobData.responsibilities.length > 0),
          hasJobRequirements: !!(jobData.requirements && jobData.requirements.length > 0),
          jobDetailsForN8n: {
            title: jobData.title,
            company: jobData.company,
            responsibilitiesCount: jobData.responsibilities?.length || 0,
            requirementsCount: jobData.requirements?.length || 0,
            hasDetails: !!jobData.details,
            hasMetadata: !!jobData.metadata
          }
        });

        // 驗證 FormData 內容 - 增強版
        const formDataEntries = [];
        for (let pair of formData.entries()) {
          const [key, value] = pair;
          if (value instanceof File || value instanceof Blob) {
            formDataEntries.push(`${key}: ${value.constructor.name} (${value.size} bytes, type: ${value.type})`);
          } else {
            const valueStr = typeof value === 'string' ? value : String(value);
            formDataEntries.push(`${key}: ${typeof value} (${valueStr.length} chars) - "${valueStr.substring(0, 100)}${valueStr.length > 100 ? '...' : ''}"`);
          }
        }
        
        this.logger.info('Complete FormData entries for N8n webhook', {
          entries: formDataEntries,
          totalEntries: formDataEntries.length,
          formDataKeys: Array.from(formData.keys()),
          expectedFieldsPresent: {
            jobDetails: formData.has('jobDetails'),
            cvFile: formData.has('cvFile'),
            timestamp: formData.has('timestamp'),
            source: formData.has('source')
          }
        });

        // Determine the full URL for the request
        let requestUrl;
        
        if (this.baseUrl.includes('/webhook/') || this.baseUrl.includes('webhook')) {
          // baseUrl is already a full webhook URL, use it directly
          requestUrl = this.baseUrl;
          this.logger.debug('Using baseUrl as full webhook URL', { requestUrl });
        } else {
          // baseUrl is base URL, append webhook endpoint
          const endpoint = '/webhook/jobsdb-cv-matcher/analyze-job-with-cv';
          requestUrl = `${this.baseUrl.replace(/\/$/, '')}${endpoint}`;
          this.logger.debug('Constructed webhook URL from base URL', { requestUrl });
        }
        
        this.logger.info('Submitting to N8n webhook with FormData', { 
          requestUrl,
          method: 'POST',
          hasApiKey: !!this.apiKey,
          dataSize: cvFileContent.byteLength
        });
        
        const response = await this._makeDirectFormDataRequest('POST', requestUrl, formData);
        
        this.logger.info('Job and CV analysis API call completed with FormData upload', { 
          success: !!response,
          responseType: typeof response,
          responseKeys: response ? Object.keys(response) : []
        });
        
        return response;
      } catch (error) {
        this.logger.error('Failed to submit job and CV for analysis with FormData upload', {
          error: error.message,
          stack: error.stack,
          hasJobData: !!jobData,
          hasCvContent: !!cvFileContent
        });
        throw error;
      }
    }

    /**
     * Gets analysis history for the user
     * 
     * @param {number} limit - Number of records to retrieve
     * @returns {Promise<Array>} Array of analysis history
     */
    async getAnalysisHistory(limit = 10) {
      try {
        this.logger.debug('Retrieving analysis history', { limit });
        
        const response = await this._makeRequest('GET', `/analysis-history?limit=${limit}`);
        
        this.logger.info('Analysis history retrieved', { count: response.length });
        
        return response;
      } catch (error) {
        this.logger.error('Failed to retrieve analysis history', error);
        throw error;
      }
    }

    /**
     * Makes HTTP request to the API
     * 
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @param {boolean} requireAuth - Whether authentication is required
     * @returns {Promise<Object>} Response data
     * @private
     */
    async _makeRequest(method, endpoint, data = null, requireAuth = true) {
      try {
        if (!this.baseUrl) {
          throw new Error('API base URL not configured');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
          'Content-Type': 'application/json'
        };

        if (requireAuth && this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const config = {
          method,
          headers,
          body: data ? JSON.stringify(data) : null
        };

        this.logger.debug('Making API request', { method, endpoint, hasData: !!data });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        this.logger.debug('API request successful', { status: response.status });
        
        return result;
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('AI分析超時 - 請稍候再試，AI分析需要較長時間處理');
        }
        throw error;
      }
    }

    /**
     * Makes FormData request to the API
     * 
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {FormData} formData - Form data
     * @returns {Promise<Object>} Response data
     * @private
     */
    async _makeFormDataRequest(method, endpoint, formData) {
      try {
        if (!this.baseUrl) {
          throw new Error('API base URL not configured');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const headers = {};

        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const config = {
          method,
          headers,
          body: formData
        };

        this.logger.debug('Making FormData API request', { method, endpoint });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        this.logger.debug('FormData API request successful', { status: response.status });
        
        return result;
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('API request timeout');
        }
        throw error;
      }
    }

    /**
     * Makes FormData request to a direct URL (not endpoint)
     * 
     * @param {string} method - HTTP method
     * @param {string} url - Full URL to request
     * @param {FormData} formData - Form data
     * @returns {Promise<Object>} Response data
     * @private
     */
    async _makeDirectFormDataRequest(method, url, formData) {
      try {
        const headers = {};

        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const config = {
          method,
          headers,
          body: formData
        };

        this.logger.debug('Making direct FormData API request', { method, url });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        this.logger.debug('Direct FormData API request successful', { status: response.status });
        
        return result;
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('AI分析超時 - 請稍候再試，AI分析需要較長時間處理');
        }
        throw error;
      }
    }

    /**
     * Gets current API configuration status AND connection status
     * 
     * @returns {Object} Configuration and connection status
     */
    getApiStatus() { // Renamed from getConfigurationStatus for clarity
      return {
        isConfigured: !!this.baseUrl,
        hasApiKey: !!this.apiKey,
        connectionOk: this.lastConnectionOk // Return the stored connection status
      };
    }
  }

  // Make ApiService available globally in both environments
  if (typeof window !== 'undefined') {
    window.ApiService = ApiService;
  }
  
  // Make it available for importScripts in service worker
  if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
    self.ApiService = ApiService;
  }
  
  // Make it the global ApiService
  globalThis.ApiService = ApiService;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiService;
} 