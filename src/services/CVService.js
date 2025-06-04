/**
 * CV management service
 * Follows Single Responsibility Principle - handles only CV-related operations
 * 
 * @class CVService
 */
if (typeof CVService === 'undefined') {
  class CVService {
    /**
     * Creates an instance of CVService
     * 
     * @param {LoggerService} logger - Logger service instance
     */
    constructor(logger) {
      this.logger = logger;
      this.allowedFileTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    /**
     * Generates a UUID
     * 
     * @returns {string} Generated UUID
     */
    _generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    /**
     * Validates CV file
     * 
     * @param {File} file - CV file to validate
     * @returns {Object} Validation result
     */
    validateFile(file) {
      const result = {
        isValid: false,
        errors: []
      };

      try {
        // Check if file exists
        if (!file) {
          result.errors.push('沒有選擇文件');
          return result;
        }

        // 只允許 PDF
        if (file.type !== 'application/pdf') {
          result.errors.push('只允許上傳 PDF 檔案');
        }

        // Check file size
        if (file.size > this.maxFileSize) {
          result.errors.push(`文件大小超過限制 (最大 ${this.maxFileSize / 1024 / 1024}MB)`);
        }

        // Check file name
        if (file.name.length > 255) {
          result.errors.push('文件名稱過長');
        }

        result.isValid = result.errors.length === 0;
        
        this.logger.debug('File validation result', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isValid: result.isValid,
          errors: result.errors
        });

        return result;
      } catch (error) {
        this.logger.error('Error validating file', error);
        result.errors.push('文件驗證時發生錯誤');
        return result;
      }
    }

    /**
     * Saves CV file information and content to storage (content as base64)
     * 
     * @param {File} file - CV file
     * @returns {Promise<Object>} Saved CV information (including contentBase64)
     */
    async saveCVInfo(file) {
      try {
        this.logger.debug('Starting CV save process', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          lastModified: file.lastModified
        });

        // 只允許 PDF
        if (file.type !== 'application/pdf') {
          throw new Error('只允許上傳 PDF 檔案');
        }

        // 讀取為 base64
        this.logger.debug('Reading file as base64...');
        const fileContentBase64 = await this.readFileAsBase64(file);
        
        this.logger.debug('File read as base64 completed', {
          base64Length: fileContentBase64 ? fileContentBase64.length : 0,
          fileSize: file.size,
          estimatedOriginalSize: fileContentBase64 ? Math.floor(fileContentBase64.length * 3 / 4) : 0
        });

        // Get existing CVs
        const result = await chrome.storage.local.get(['cvList']);
        const cvList = result.cvList || [];
        
        // 檢查重複（同名且同大小）
        const exists = cvList.some(cv => cv.name === file.name && Number(cv.size) === Number(file.size));
        if (exists) {
          throw new Error('此 CV 已經存在，請勿重複上傳');
        }
        
        const cvInfo = {
          id: this._generateUUID(),
          name: file.name,
          size: Number(file.size),
          type: file.type,
          uploadedAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          contentBase64: fileContentBase64 // 用 base64 字串存
        };

        this.logger.debug('Prepared CV info object', {
          cvId: cvInfo.id,
          cvName: cvInfo.name,
          cvSize: cvInfo.size,
          cvType: cvInfo.type,
          hasContentBase64: !!cvInfo.contentBase64,
          contentBase64Length: cvInfo.contentBase64 ? cvInfo.contentBase64.length : 0
        });

        // Add new CV to the beginning of the list
        cvList.unshift(cvInfo);

        // Keep only last 10 CVs
        if (cvList.length > 10) {
          cvList.splice(10); 
        }

        // Save updated list
        await chrome.storage.local.set({ 
          cvList,
          currentCV: cvInfo // currentCV will also have the contentBase64
        });

        this.logger.info('CV information and contentBase64 saved locally', {
          cvId: cvInfo.id,
          fileName: file.name,
          savedSize: cvInfo.size,
          originalFileSize: file.size,
          totalCVs: cvList.length,
          contentBase64Saved: !!cvInfo.contentBase64
        });

        return cvInfo;
      } catch (error) {
        this.logger.error('Failed to save CV information and contentBase64', error);
        throw error;
      }
    }

    /**
     * Gets list of saved CVs
     * 
     * @returns {Promise<Array>} List of saved CVs
     */
    async getSavedCVs() {
      try {
        const result = await chrome.storage.local.get(['cvList']);
        const cvList = result.cvList || [];
        
        this.logger.debug('Retrieved saved CVs', { count: cvList.length });
        
        return cvList;
      } catch (error) {
        this.logger.error('Failed to retrieve saved CVs', error);
        return [];
      }
    }

    /**
     * Gets currently selected CV
     * 
     * @returns {Promise<Object|null>} Current CV or null
     */
    async getCurrentCV() {
      try {
        const result = await chrome.storage.local.get(['currentCV']);
        const currentCV = result.currentCV || null;
        
        this.logger.debug('Retrieved current CV', { 
          hasCurrentCV: !!currentCV,
          cvName: currentCV?.name
        });
        
        return currentCV;
      } catch (error) {
        this.logger.error('Failed to retrieve current CV', error);
        return null;
      }
    }

    /**
     * Sets current CV
     * 
     * @param {Object} cvInfo - CV information
     * @returns {Promise<void>}
     */
    async setCurrentCV(cvInfo) {
      try {
        // Update last used timestamp
        cvInfo.lastUsed = new Date().toISOString();
        // Assuming cvInfo passed here already contains the 'content' if it's from the list

        await chrome.storage.local.set({ currentCV: cvInfo });

        // Update CV in the list
        const result = await chrome.storage.local.get(['cvList']);
        const cvList = result.cvList || [];
        
        const index = cvList.findIndex(cv => cv.id === cvInfo.id);
        if (index !== -1) {
          cvList[index] = cvInfo; // This will update the content in the list too
          await chrome.storage.local.set({ cvList });
        }

        this.logger.info('Current CV updated', {
          cvId: cvInfo.id,
          cvName: cvInfo.name
        });
      } catch (error) {
        this.logger.error('Failed to set current CV', error);
        throw error;
      }
    }

    /**
     * Removes CV from saved list
     * 
     * @param {string} cvId - CV ID to remove
     * @returns {Promise<void>}
     */
    async removeCV(cvId) {
      try {
        const result = await chrome.storage.local.get(['cvList', 'currentCV']);
        let cvList = result.cvList || [];
        const currentCV = result.currentCV;

        // Filter out the CV to remove. This also removes its content from the list.
        const filteredList = cvList.filter(cv => cv.id !== cvId);
        
        const updates = { cvList: filteredList };
        // Clear current CV if it's the one being removed
        if (currentCV && currentCV.id === cvId) {
          updates.currentCV = null;
        }

        await chrome.storage.local.set(updates);

        this.logger.info('CV removed (including its content from local storage)', {
          cvId,
          remainingCVs: filteredList.length
        });
      } catch (error) {
        this.logger.error('Failed to remove CV', error);
        throw error;
      }
    }

    /**
     * Reads file content as text (for text files)
     * 
     * @param {File} file - File to read
     * @returns {Promise<string>} File content
     */
    async readFileAsText(file) {
      return new Promise((resolve, reject) => {
        try {
          const reader = new FileReader();
          
          reader.onload = (event) => {
            this.logger.debug('File read successfully', {
              fileName: file.name,
              contentLength: event.target.result.length
            });
            resolve(event.target.result);
          };
          
          reader.onerror = (error) => {
            this.logger.error('Error reading file as text', { fileName: file.name, error });
            reject(error);
          };
          
          reader.readAsText(file);
        } catch (error) {
          this.logger.error('Exception in readFileAsText', { fileName: file.name, error });
          reject(error);
        }
      });
    }

    /**
     * Reads file content as ArrayBuffer
     * 
     * @param {File} file - File to read
     * @returns {Promise<ArrayBuffer>} File content as ArrayBuffer
     */
    async readFileAsArrayBuffer(file) {
      return new Promise((resolve, reject) => {
        try {
          const reader = new FileReader();
          
          reader.onload = (event) => {
            this.logger.debug('File read successfully as ArrayBuffer', {
              fileName: file.name,
              contentLength: event.target.result.byteLength
            });
            resolve(event.target.result);
          };
          
          reader.onerror = (error) => {
            this.logger.error('Error reading file as ArrayBuffer', { fileName: file.name, error });
            reject(error);
          };
          
          reader.readAsArrayBuffer(file);
        } catch (error) {
          this.logger.error('Exception in readFileAsArrayBuffer', { fileName: file.name, error });
          reject(error);
        }
      });
    }

    /**
     * Reads file content as base64
     * 
     * @param {File} file - File to read
     * @returns {Promise<string>} Base64 encoded content
     */
    async readFileAsBase64(file) {
      return new Promise((resolve, reject) => {
        try {
          this.logger.debug('Starting file read as base64', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          });

          const reader = new FileReader();
          
          reader.onload = (event) => {
            try {
              this.logger.debug('FileReader onload triggered', {
                hasResult: !!event.target.result,
                resultLength: event.target.result ? event.target.result.length : 0,
                resultType: typeof event.target.result
              });

              // Remove data URL prefix to get pure base64
              const base64 = event.target.result.split(',')[1];
              
              this.logger.debug('Base64 extraction completed', {
                fileName: file.name,
                originalResultLength: event.target.result.length,
                base64Length: base64.length,
                estimatedFileSize: Math.floor(base64.length * 3 / 4),
                originalFileSize: file.size,
                sizeRatio: base64.length / file.size
              });

              resolve(base64);
            } catch (error) {
              this.logger.error('Error processing FileReader result', { 
                fileName: file.name, 
                error: error.message,
                stack: error.stack
              });
              reject(error);
            }
          };
          
          reader.onerror = (error) => {
            this.logger.error('FileReader error event', { 
              fileName: file.name, 
              error: error,
              readerError: reader.error
            });
            reject(error);
          };
          
          this.logger.debug('Starting FileReader.readAsDataURL', {
            fileName: file.name,
            fileSize: file.size
          });
          
          reader.readAsDataURL(file);
        } catch (error) {
          this.logger.error('Exception in readFileAsBase64', { 
            fileName: file.name, 
            error: error.message,
            stack: error.stack
          });
          reject(error);
        }
      });
    }

    /**
     * Gets supported file types information
     * 
     * @returns {Array} Array of supported file type info
     */
    getSupportedFileTypes() {
      return [
        {
          type: 'application/pdf',
          extension: '.pdf',
          description: 'PDF文檔'
        },
        {
          type: 'application/msword',
          extension: '.doc',
          description: 'Word文檔 (舊版)'
        },
        {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extension: '.docx',
          description: 'Word文檔'
        },
        {
          type: 'text/plain',
          extension: '.txt',
          description: '文本文件'
        }
      ];
    }

    /**
     * Gets CV statistics
     * 
     * @returns {Promise<Object>} CV statistics
     */
    async getStatistics() {
      try {
        const cvList = await this.getSavedCVs();
        const currentCV = await this.getCurrentCV();
        
        const stats = {
          totalCVs: cvList.length,
          hasCurrentCV: !!currentCV,
          currentCVName: currentCV?.name || null,
          lastUploadDate: cvList.length > 0 ? cvList[0].uploadedAt : null,
          totalFileSize: cvList.reduce((sum, cv) => sum + (Number(cv.size) || 0), 0)
        };

        this.logger.debug('CV statistics calculated', stats);
        
        return stats;
      } catch (error) {
        this.logger.error('Failed to calculate CV statistics', error);
        return {
          totalCVs: 0,
          hasCurrentCV: false,
          currentCVName: null,
          lastUploadDate: null,
          totalFileSize: 0
        };
      }
    }
  }

  // Make CVService available globally in both environments
  if (typeof window !== 'undefined') {
    window.CVService = CVService;
  }
  
  // Make it available for importScripts in service worker
  if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
    self.CVService = CVService;
  }
  
  // Make it the global CVService
  globalThis.CVService = CVService;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CVService;
} 