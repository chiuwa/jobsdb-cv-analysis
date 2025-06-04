/**
 * Background service worker for JobsDB CV Matcher extension
 * Follows Single Responsibility Principle and Dependency Inversion
 */

// Import necessary scripts
importScripts('/src/services/LoggerService.js');
importScripts('/src/services/ApiService.js');
importScripts('/src/services/CVService.js');

// Initialize services
const logger = new LoggerService('ServiceWorker');
const apiService = new ApiService(logger);
const cvService = new CVService(logger);

/**
 * Background service manager
 * Orchestrates communication between content script and external services
 */
class BackgroundService {
  constructor() {
    this.isInitialized = false;
    this.currentFiles = new Map(); // Store file references temporarily
  }

  /**
   * Initializes the background service
   */
  async init() {
    try {
      logger.info('Initializing background service');

      // Load API configuration
      await this.loadApiConfiguration();

      // Set up message listeners
      this.setupMessageListeners();

      // Set up context menu (optional)
      this.setupContextMenu();

      this.isInitialized = true;
      logger.info('Background service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize background service', error);
    }
  }

  /**
   * Loads API configuration from storage
   */
  async loadApiConfiguration() {
    try {
      const result = await chrome.storage.local.get(['apiConfig']);
      const apiConfig = result.apiConfig || {};

      if (apiConfig.baseUrl) { 
        await apiService.initialize(apiConfig);
        logger.info('API service initialized from storage with config:', apiConfig);
      } else {
        logger.warn('API base URL not found in storage. API service not initialized from storage.');
      }
    } catch (error) {
      logger.error('Failed to load API configuration from storage', error);
    }
  }

  /**
   * Sets up message listeners for communication with content scripts
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Indicates we will send a response asynchronously
    });

    logger.debug('Message listeners set up');
  }

  /**
   * Sets up context menu for quick actions
   */
  setupContextMenu() {
    try {
      chrome.contextMenus.create({
        id: 'jobsdb-cv-matcher',
        title: 'JobsDB CV Matcher',
        contexts: ['page'],
        documentUrlPatterns: ['https://*.jobsdb.com/job/*']
      });

      chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'jobsdb-cv-matcher') {
          this.openPopup(tab);
        }
      });

      logger.debug('Context menu set up');
    } catch (error) {
      logger.error('Failed to set up context menu', error);
    }
  }

  /**
   * Handles incoming messages from content scripts and popup
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      logger.debug('Received message', { action: request.action, tabId: sender.tab?.id });

      let response;

      switch (request.action) {
        case 'getCurrentCV':
          response = await this.handleGetCurrentCV();
          break;

        case 'uploadCV':
          response = await this.handleUploadCV(request, sender);
          break;

        case 'analyzeMatch':
          response = await this.handleAnalyzeMatch(request.jobData);
          break;

        case 'configureApi':
          response = await this.handleConfigureApi(request.config);
          break;

        case 'getApiStatus':
          response = await this.handleGetApiStatus();
          break;

        case 'getCVList':
          response = await this.handleGetCVList();
          break;

        case 'setCurrentCV':
          response = await this.handleSetCurrentCV(request.cvInfo);
          break;

        case 'removeCV':
          response = await this.handleRemoveCV(request.cvId);
          break;

        default:
          response = {
            success: false,
            error: `Unknown action: ${request.action}`
          };
      }

      sendResponse(response);
    } catch (error) {
      logger.error('Error handling message', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handles getting current CV information
   */
  async handleGetCurrentCV() {
    try {
      const currentCV = await cvService.getCurrentCV();
      
      return {
        success: true,
        cv: currentCV
      };
    } catch (error) {
      logger.error('Failed to get current CV', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handles CV file upload (now receives content directly from popup)
   */
  async handleUploadCV(request, sender) { // sender might not be needed if content is direct
    try {
      const { fileInfo, fileContent } = request;

      logger.debug('Received uploadCV request', {
        hasFileInfo: !!fileInfo,
        hasFileContent: !!fileContent,
        fileInfoKeys: fileInfo ? Object.keys(fileInfo) : [],
        fileContentType: fileContent ? fileContent.constructor.name : 'null',
        fileContentLength: fileContent ? fileContent.length : 0,
        isArray: Array.isArray(fileContent)
      });

      if (!fileInfo || !fileContent) {
        logger.error('Invalid request: fileInfo or fileContent missing from uploadCV request', { 
          request: {
            hasFileInfo: !!fileInfo,
            hasFileContent: !!fileContent,
            fileInfoType: typeof fileInfo,
            fileContentType: typeof fileContent
          }
        });
        throw new Error('Invalid file upload request from popup.');
      }

      // Convert the received array back to ArrayBuffer
      let arrayBuffer;
      
      if (Array.isArray(fileContent)) {
        logger.debug('Converting received array back to ArrayBuffer', {
          arrayLength: fileContent.length,
          firstFewBytes: fileContent.slice(0, 10)
        });
        
        // Convert array back to Uint8Array then to ArrayBuffer
        const uint8Array = new Uint8Array(fileContent);
        arrayBuffer = uint8Array.buffer;
        
        logger.debug('Array to ArrayBuffer conversion completed', {
          originalArrayLength: fileContent.length,
          uint8ArrayLength: uint8Array.length,
          arrayBufferByteLength: arrayBuffer.byteLength,
          conversionSuccess: fileContent.length === arrayBuffer.byteLength
        });
        
      } else if (fileContent instanceof ArrayBuffer) {
        logger.debug('Received content is already ArrayBuffer');
        arrayBuffer = fileContent;
      } else {
        logger.error('Received fileContent is neither Array nor ArrayBuffer', {
          actualType: fileContent.constructor.name,
          hasLength: 'length' in fileContent,
          hasByteLength: 'byteLength' in fileContent
        });
        throw new Error('Invalid file content format received');
      }

      logger.info('Received file for local saving from popup', {
        fileName: fileInfo.name,
        fileType: fileInfo.type,
        declaredSize: fileInfo.size,
        receivedContentSize: arrayBuffer.byteLength,
        sizesMatch: fileInfo.size === arrayBuffer.byteLength
      });

      // 驗證接收到的 ArrayBuffer 
      if (arrayBuffer instanceof ArrayBuffer) {
        logger.debug('FileContent is ArrayBuffer', {
          byteLength: arrayBuffer.byteLength,
          isValidArrayBuffer: arrayBuffer.byteLength > 0
        });

        // 檢查前幾個字節
        if (arrayBuffer.byteLength >= 4) {
          const headerView = new Uint8Array(arrayBuffer, 0, 4);
          const header = String.fromCharCode(...headerView);
          logger.debug('ArrayBuffer content verification', {
            header: header,
            isPDF: header === '%PDF',
            firstBytes: Array.from(headerView).map(b => b.toString(16)).join(' ')
          });
          
          // 如果是PDF，驗證內容長度是否合理
          if (header === '%PDF' && arrayBuffer.byteLength < 1000) {
            logger.error('PDF file suspiciously small', {
              byteLength: arrayBuffer.byteLength,
              expectedMinimum: 1000,
              mayBeTruncated: true
            });
          }
        }
      } else {
        logger.error('Final content is not ArrayBuffer after conversion', {
          actualType: arrayBuffer.constructor.name,
          hasLength: 'length' in arrayBuffer,
          hasByteLength: 'byteLength' in arrayBuffer
        });
        throw new Error('Failed to convert content to ArrayBuffer');
      }

      // 重要：直接使用ArrayBuffer轉換為Base64，而不是重新構造File對象
      // 這樣可以避免File對象構造過程中的潛在問題
      logger.debug('Converting ArrayBuffer directly to base64...');
      
      let contentBase64;
      try {
        contentBase64 = await this.arrayBufferToBase64(arrayBuffer);
        
        logger.debug('ArrayBuffer to base64 conversion completed', {
          originalSize: arrayBuffer.byteLength,
          base64Length: contentBase64 ? contentBase64.length : 0,
          hasBase64Content: !!contentBase64,
          base64Type: typeof contentBase64,
          estimatedSizeFromBase64: contentBase64 ? Math.floor(contentBase64.length * 3 / 4) : 0,
          conversionAccurate: contentBase64 ? Math.abs(arrayBuffer.byteLength - Math.floor(contentBase64.length * 3 / 4)) <= 3 : false
        });

        if (!contentBase64) {
          logger.error('arrayBufferToBase64 returned null or empty', {
            returnedValue: contentBase64,
            returnedType: typeof contentBase64
          });
          throw new Error('Base64 conversion returned empty result');
        }

        if (contentBase64.length === 0) {
          logger.error('arrayBufferToBase64 returned empty string');
          throw new Error('Base64 conversion returned empty string');
        }

      } catch (conversionError) {
        logger.error('ArrayBuffer to base64 conversion failed', {
          error: conversionError.message,
          stack: conversionError.stack,
          originalSize: arrayBuffer.byteLength
        });
        throw new Error(`文件轉換失敗: ${conversionError.message}`);
      }

      // 驗證轉換的準確性
      if (Math.abs(arrayBuffer.byteLength - Math.floor(contentBase64.length * 3 / 4)) > 3) {
        logger.error('Base64 conversion size mismatch', {
          originalBytes: arrayBuffer.byteLength,
          base64Length: contentBase64.length,
          estimatedBytes: Math.floor(contentBase64.length * 3 / 4),
          difference: arrayBuffer.byteLength - Math.floor(contentBase64.length * 3 / 4)
        });
      }

      // 創建CV信息對象（直接使用已轉換的base64）
      logger.debug('Calling createCVInfo with converted base64', {
        fileInfoName: fileInfo.name,
        fileInfoSize: fileInfo.size,
        base64Length: contentBase64.length,
        base64Preview: contentBase64.substring(0, 50) + '...'
      });
      
      const cvInfo = await this.createCVInfo(fileInfo, contentBase64);

      logger.info('CV saved locally via service worker', { 
        cvId: cvInfo.id, 
        cvName: cvInfo.name,
        savedSize: cvInfo.size,
        originalSize: fileInfo.size,
        base64Length: cvInfo.contentBase64.length
      });

      return {
        success: true,
        cv: cvInfo
      };
    } catch (error) {
      logger.error('Failed to handle CV upload and local save in service worker', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Converts ArrayBuffer to base64 string
   */
  async arrayBufferToBase64(arrayBuffer) {
    try {
      logger.debug('arrayBufferToBase64 called', {
        hasArrayBuffer: !!arrayBuffer,
        arrayBufferType: arrayBuffer ? arrayBuffer.constructor.name : 'null',
        arrayBufferByteLength: arrayBuffer ? arrayBuffer.byteLength : 0
      });

      if (!arrayBuffer) {
        logger.error('arrayBuffer is null or undefined');
        throw new Error('ArrayBuffer is null or undefined');
      }

      if (!(arrayBuffer instanceof ArrayBuffer)) {
        logger.error('Provided parameter is not an ArrayBuffer', {
          actualType: arrayBuffer.constructor.name,
          hasLength: 'length' in arrayBuffer,
          hasByteLength: 'byteLength' in arrayBuffer
        });
        throw new Error('Parameter is not an ArrayBuffer');
      }

      if (arrayBuffer.byteLength === 0) {
        logger.error('ArrayBuffer is empty (0 bytes)');
        throw new Error('ArrayBuffer is empty');
      }

      const bytes = new Uint8Array(arrayBuffer);
      logger.debug('Created Uint8Array from ArrayBuffer', {
        uint8ArrayLength: bytes.length,
        firstFewBytes: Array.from(bytes.slice(0, 10)).map(b => b.toString(16)).join(' ')
      });

      let binary = '';
      const len = bytes.byteLength;
      
      logger.debug('Starting chunked conversion', {
        totalBytes: len,
        chunkSize: 8192
      });
      
      // 分批處理以避免stack overflow
      const chunkSize = 8192;
      for (let i = 0; i < len; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
        
        try {
          const chunkString = String.fromCharCode.apply(null, Array.from(chunk));
          binary += chunkString;
          
          if (i % (chunkSize * 10) === 0) { // Log every 10 chunks
            logger.debug('Chunk conversion progress', {
              processedBytes: i + chunk.length,
              totalBytes: len,
              progress: Math.round((i + chunk.length) / len * 100) + '%',
              currentBinaryLength: binary.length
            });
          }
        } catch (chunkError) {
          logger.error('Error converting chunk', {
            chunkStart: i,
            chunkLength: chunk.length,
            error: chunkError.message
          });
          throw new Error(`Failed to convert chunk at position ${i}: ${chunkError.message}`);
        }
      }
      
      logger.debug('Binary conversion completed', {
        originalByteLength: len,
        binaryLength: binary.length,
        lengthsMatch: binary.length === len
      });

      if (binary.length === 0) {
        logger.error('Binary string is empty after conversion');
        throw new Error('Binary conversion resulted in empty string');
      }

      // Convert to base64
      let base64Result;
      try {
        base64Result = btoa(binary);
        logger.debug('btoa conversion completed', {
          binaryLength: binary.length,
          base64Length: base64Result.length,
          estimatedOriginalSize: Math.floor(base64Result.length * 3 / 4)
        });
      } catch (btoaError) {
        logger.error('btoa conversion failed', {
          binaryLength: binary.length,
          error: btoaError.message,
          binaryPreview: binary.substring(0, 50) + '...'
        });
        throw new Error(`Base64 encoding failed: ${btoaError.message}`);
      }

      if (!base64Result || base64Result.length === 0) {
        logger.error('btoa returned empty or null result', {
          base64Result: base64Result,
          base64Type: typeof base64Result
        });
        throw new Error('Base64 encoding produced empty result');
      }

      logger.info('arrayBufferToBase64 completed successfully', {
        originalSize: arrayBuffer.byteLength,
        base64Length: base64Result.length,
        compressionRatio: (base64Result.length / arrayBuffer.byteLength).toFixed(2)
      });

      return base64Result;
    } catch (error) {
      logger.error('Failed to convert ArrayBuffer to base64', {
        error: error.message,
        stack: error.stack,
        arrayBufferSize: arrayBuffer ? arrayBuffer.byteLength : 'null'
      });
      throw error;
    }
  }

  /**
   * Creates CV info object and saves to storage
   */
  async createCVInfo(fileInfo, contentBase64) {
    try {
      logger.debug('createCVInfo called with parameters', {
        fileInfoKeys: fileInfo ? Object.keys(fileInfo) : [],
        fileName: fileInfo?.name,
        fileSize: fileInfo?.size,
        hasContentBase64: !!contentBase64,
        contentBase64Length: contentBase64 ? contentBase64.length : 0,
        contentBase64Type: typeof contentBase64,
        contentBase64Preview: contentBase64 ? contentBase64.substring(0, 50) + '...' : 'null'
      });

      if (!contentBase64) {
        logger.error('contentBase64 is empty or null in createCVInfo', {
          contentBase64Value: contentBase64,
          contentBase64Type: typeof contentBase64
        });
        throw new Error('CV content is missing - contentBase64 is empty');
      }

      // Get existing CVs
      const result = await chrome.storage.local.get(['cvList']);
      const cvList = result.cvList || [];
      
      // Check for duplicates
      const exists = cvList.some(cv => cv.name === fileInfo.name && Number(cv.size) === Number(fileInfo.size));
      if (exists) {
        throw new Error('此 CV 已經存在，請勿重複上傳');
      }
      
      const cvInfo = {
        id: this.generateUUID(),
        name: fileInfo.name,
        size: Number(fileInfo.size),
        type: fileInfo.type,
        uploadedAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        contentBase64: contentBase64
      };

      logger.debug('Created CV info object', {
        cvId: cvInfo.id,
        cvName: cvInfo.name,
        cvSize: cvInfo.size,
        hasContentBase64InObject: !!cvInfo.contentBase64,
        contentBase64LengthInObject: cvInfo.contentBase64 ? cvInfo.contentBase64.length : 0
      });

      // Add to list
      cvList.unshift(cvInfo);
      if (cvList.length > 10) {
        cvList.splice(10); 
      }

      logger.debug('Preparing to save to storage', {
        cvListLength: cvList.length,
        currentCVHasContent: !!cvInfo.contentBase64,
        aboutToSaveContentLength: cvInfo.contentBase64 ? cvInfo.contentBase64.length : 0
      });

      // Save to storage
      await chrome.storage.local.set({ 
        cvList,
        currentCV: cvInfo
      });

      logger.info('CV info saved to storage successfully', {
        cvId: cvInfo.id,
        cvName: cvInfo.name,
        savedContentLength: cvInfo.contentBase64 ? cvInfo.contentBase64.length : 0
      });

      // 驗證保存後的數據
      const verificationResult = await chrome.storage.local.get(['currentCV']);
      const savedCV = verificationResult.currentCV;
      
      logger.debug('Post-save verification', {
        savedCVExists: !!savedCV,
        savedCVName: savedCV?.name,
        savedCVHasContent: !!savedCV?.contentBase64,
        savedContentLength: savedCV?.contentBase64 ? savedCV.contentBase64.length : 0,
        contentMatches: savedCV?.contentBase64 === cvInfo.contentBase64
      });

      if (!savedCV?.contentBase64) {
        logger.error('CRITICAL: contentBase64 was lost during storage save!', {
          originalLength: contentBase64.length,
          savedLength: savedCV?.contentBase64?.length || 0,
          savedCV: savedCV
        });
      }

      return cvInfo;
    } catch (error) {
      logger.error('Failed to create and save CV info', error);
      throw error;
    }
  }

  /**
   * Generates a UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Handles job-CV match analysis
   */
  async handleAnalyzeMatch(jobData) {
    try {
      // 驗證和記錄 jobData
      logger.info('Starting match analysis with job data', { 
        hasJobData: !!jobData,
        jobDataKeys: jobData ? Object.keys(jobData) : [],
        jobTitle: jobData?.title,
        jobCompany: jobData?.company,
        responsibilitiesCount: jobData?.responsibilities?.length || 0,
        requirementsCount: jobData?.requirements?.length || 0
      });

      // 確保 jobData 包含必要資訊
      if (!jobData) {
        throw new Error('Job data is missing');
      }

      if (!jobData.title && !jobData.company && 
          (!jobData.responsibilities || jobData.responsibilities.length === 0) &&
          (!jobData.requirements || jobData.requirements.length === 0)) {
        throw new Error('Job data appears to be empty or invalid');
      }

      const apiStatus = apiService.getApiStatus();
      if (!apiStatus.isConfigured || !apiStatus.connectionOk) {
        logger.warn('API not configured or connection failed. Cannot analyze match.', { apiStatus });
        return {
          success: false,
          error: 'API not configured or connection failed. Please check API settings.',
          needsConfiguration: !apiStatus.isConfigured || !apiStatus.connectionOk
        };
      }

      const currentCV = await cvService.getCurrentCV();
      if (!currentCV || !currentCV.contentBase64) {
        logger.warn('No current CV with contentBase64 available for analysis.', { currentCV });
        return {
          success: false,
          error: 'No CV selected or CV content is missing. Please upload or select a CV.'
        };
      }

      logger.info('Converting CV from base64 to ArrayBuffer', { 
        cvName: currentCV.name,
        cvType: currentCV.type,
        cvSize: currentCV.size,
        base64Length: currentCV.contentBase64.length
      });

      // 改進的 base64 轉 ArrayBuffer 函數
      function base64ToArrayBuffer(base64) {
        try {
          logger.debug('Starting base64 to ArrayBuffer conversion', {
            base64Length: base64 ? base64.length : 0,
            base64Preview: base64 ? base64.substring(0, 50) + '...' : 'null'
          });

          // 移除可能的數據 URL 前綴 (data:application/pdf;base64,)
          const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
          
          logger.debug('Cleaned base64 string', {
            originalLength: base64.length,
            cleanLength: cleanBase64.length,
            removedPrefix: base64.length - cleanBase64.length > 0
          });
          
          // 檢查是否為有效的 base64
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
            throw new Error('Invalid base64 string format');
          }
          
          const binary = atob(cleanBase64);
          const len = binary.length;
          
          logger.debug('Base64 decoded to binary', {
            binaryLength: len,
            firstFewBytes: len > 0 ? Array.from(binary.slice(0, 10)).map(c => c.charCodeAt(0).toString(16)).join(' ') : 'empty'
          });
          
          const buffer = new Uint8Array(len);
          
          for (let i = 0; i < len; i++) {
            buffer[i] = binary.charCodeAt(i);
          }
          
          logger.debug('ArrayBuffer creation completed', {
            originalBase64Length: cleanBase64.length,
            binaryLength: binary.length,
            bufferByteLength: buffer.buffer.byteLength,
            conversionSuccessful: buffer.buffer.byteLength === binary.length
          });
          
          // 驗證 PDF header
          if (buffer.length >= 4) {
            const header = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
            logger.debug('PDF header check', {
              header: header,
              isPDF: header === '%PDF'
            });
            
            if (header !== '%PDF') {
              logger.warn('Warning: File does not appear to be a valid PDF', { header });
            }
          }
          
          return buffer.buffer;
        } catch (error) {
          logger.error('Failed to convert base64 to ArrayBuffer', {
            error: error.message,
            stack: error.stack,
            base64Length: base64 ? base64.length : 0
          });
          throw new Error(`CV file conversion failed: ${error.message}`);
        }
      }

      const arrayBuffer = base64ToArrayBuffer(currentCV.contentBase64);

      logger.info('ArrayBuffer conversion completed, preparing API call', {
        arrayBufferSize: arrayBuffer.byteLength,
        cvOriginalSize: currentCV.size,
        sizeDifference: Math.abs(arrayBuffer.byteLength - currentCV.size)
      });

      // 準備發送的 job data，確保包含所有必要欄位
      const enrichedJobData = {
        title: jobData.title || 'Unknown Position',
        company: jobData.company || 'Unknown Company',
        responsibilities: jobData.responsibilities || [],
        requirements: jobData.requirements || [],
        details: jobData.details || {
          url: 'Unknown',
          extractedAt: new Date().toISOString()
        },
        // 添加額外的元數據
        metadata: {
          extractedAt: new Date().toISOString(),
          source: 'jobsdb-extension',
          version: '1.0.0'
        }
      };

      logger.info('Sending enriched job data and CV to API', { 
        jobTitle: enrichedJobData.title,
        jobCompany: enrichedJobData.company,
        responsibilitiesCount: enrichedJobData.responsibilities.length,
        requirementsCount: enrichedJobData.requirements.length,
        cvName: currentCV.name,
        cvType: currentCV.type,
        arrayBufferSize: arrayBuffer.byteLength
      });

      // 發送到 N8n API
      const analysisResult = await apiService.analyzeJobAndCV(
        enrichedJobData, 
        arrayBuffer,
        currentCV.name, 
        currentCV.type
      );

      // Update last used timestamp for the CV
      await cvService.setCurrentCV(currentCV); 

      logger.info('Analysis completed successfully', { 
        hasResult: !!analysisResult,
        resultKeys: analysisResult ? Object.keys(analysisResult) : []
      });

      return {
        success: true,
        analysis: analysisResult
      };
    } catch (error) {
      logger.error('Failed to analyze job-CV match', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handles API configuration
   */
  async handleConfigureApi(config) {
    try {
      // Validate configuration (baseUrl is key for being configured)
      if (!config.baseUrl) {
        throw new Error('API URL是必需的');
      }

      // Initialize API service with new configuration. 
      // This will also test the connection and update internal status (lastConnectionOk) in apiService.
      await apiService.initialize(config);

      // Save configuration to storage
      await chrome.storage.local.set({ apiConfig: config });

      logger.info('API configuration updated and tested in apiService');

      // The response from handleConfigureApi primarily indicates that the config was accepted and stored.
      // The actual connection status will be fetched by a subsequent getApiStatus call from the popup.
      return {
        success: true,
        message: 'API配置已保存。請檢查狀態。' // Updated message
      };
    } catch (error) {
      logger.error('Failed to configure API', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handles getting API status
   */
  async handleGetApiStatus() {
    try {
      // Get status directly from apiService, which now holds the latest connection test result internally
      const serviceStatus = apiService.getApiStatus(); 

      // The popup expects a structure like: { isConfigured: boolean, connectionStatus: boolean (renamed from connectionOk for consistency) }
      return {
        success: true,
        status: {
          isConfigured: serviceStatus.isConfigured,
          connectionStatus: serviceStatus.connectionOk, // Map connectionOk to connectionStatus
          hasApiKey: serviceStatus.hasApiKey // Pass this along for informational purposes if needed
        }
      };
    } catch (error) {
      logger.error('Failed to get API status from apiService', error);
      // Return a default error status structure
      return {
        success: false,
        status: {
          isConfigured: false,
          connectionStatus: false,
          error: error.message
        }
      };
    }
  }

  /**
   * Handles getting CV list
   */
  async handleGetCVList() {
    try {
      const cvList = await cvService.getSavedCVs();
      const stats = await cvService.getStatistics();

      return {
        success: true,
        cvList,
        stats
      };
    } catch (error) {
      logger.error('Failed to get CV list', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handles setting current CV
   */
  async handleSetCurrentCV(cvInfo) {
    try {
      await cvService.setCurrentCV(cvInfo);

      return {
        success: true,
        message: 'CV已設置為當前使用'
      };
    } catch (error) {
      logger.error('Failed to set current CV', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handles removing CV
   */
  async handleRemoveCV(cvId) {
    try {
      await cvService.removeCV(cvId);

      return {
        success: true,
        message: 'CV已刪除'
      };
    } catch (error) {
      logger.error('Failed to remove CV', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Opens the extension popup
   */
  async openPopup(tab) {
    try {
      // For now, we can inject the content script if it's not already there
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/src/content/jobExtractor.js']
      });

      logger.info('Content script injected via context menu');
    } catch (error) {
      logger.error('Failed to inject content script', error);
    }
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Start initialization when the service worker starts
backgroundService.init().catch(error => {
  logger.error('Failed to start background service', error);
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    logger.info('Extension installed/updated', { reason: details.reason });

    if (details.reason === 'install') {
      // Set default configuration or show welcome message
      logger.info('Extension installed for the first time');
    } else if (details.reason === 'update') {
      // Handle extension update
      logger.info('Extension updated', { 
        previousVersion: details.previousVersion 
      });
    }
  } catch (error) {
    logger.error('Error handling installation', error);
  }
});

// Handle tab updates to inject content script on JobsDB pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    // Only proceed if the tab is completely loaded
    if (changeInfo.status !== 'complete') return;

    // Check if it's a JobsDB job page
    if (tab.url && tab.url.includes('jobsdb.com/job/')) {
      logger.debug('JobsDB job page detected', { tabId, url: tab.url });
      
      try {
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [
            '/src/services/LoggerService.js',
            '/src/extractors/JobsDBExtractor.js',
            '/src/content/jobExtractor.js'
          ]
        });

        // Inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['/src/styles/content.css']
        });

        logger.debug('Content script and styles injected successfully', { tabId });
      } catch (error) {
        logger.error('Failed to inject content script', error);
      }
    }
  } catch (error) {
    logger.error('Error handling tab update', error);
  }
}); 