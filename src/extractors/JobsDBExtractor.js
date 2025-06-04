/**
 * JobsDB specific job information extractor
 * Implements IJobExtractor interface
 * Follows Single Responsibility Principle - handles only JobsDB extraction
 * 
 * @class JobsDBExtractor
 * @extends IJobExtractor
 */
if (typeof JobsDBExtractor === 'undefined') {
  // Define JobsDBExtractor class
  class JobsDBExtractor {
    /**
     * Creates an instance of JobsDBExtractor
     * 
     * @param {LoggerService} logger - Logger service instance
     */
    constructor(logger) {
      this.logger = logger;
      this.selectors = {
        jobTitle: 'h1[data-automation="job-detail-title"]',
        companyName: '[data-automation="job-detail-company-name"]',
        jobDescription: '[data-automation="job-detail-description"]',
        jobDetails: '[data-automation="job-detail-info"]'
      };
    }

    /**
     * Validates if current page is a valid JobsDB job posting
     * 
     * @returns {boolean} True if valid job page
     */
    isValidJobPage() {
      try {
        const url = window.location.href;
        const isJobsDB = url.includes('jobsdb.com');
        const isJobPage = url.includes('/job/');
        const hasJobTitle = document.querySelector(this.selectors.jobTitle) !== null;
        
        this.logger.debug('Page validation', { url, isJobsDB, isJobPage, hasJobTitle });
        
        return isJobsDB && isJobPage && hasJobTitle;
      } catch (error) {
        this.logger.error('Error validating job page', error);
        return false;
      }
    }

    /**
     * Gets the job title from the page
     * 
     * @returns {string|null} Job title or null if not found
     */
    getJobTitle() {
      try {
        const titleElement = document.querySelector(this.selectors.jobTitle);
        const title = titleElement ? titleElement.textContent.trim() : null;
        this.logger.debug('Extracted job title', { title });
        return title;
      } catch (error) {
        this.logger.error('Error extracting job title', error);
        return null;
      }
    }

    /**
     * Gets the company name from the page
     * 
     * @returns {string|null} Company name or null if not found
     */
    getCompanyName() {
      try {
        console.log('🏢 JobsDBExtractor: Starting simplified company extraction...');
        
        // Simplified approach - just try the primary selector
        let company = null;
        const companyElement = document.querySelector(this.selectors.companyName);
        
        if (companyElement) {
          company = companyElement.textContent.trim();
          // Basic cleanup only
          company = company.replace(/\s*(?:View all jobs|Show all|See more|Quick apply|Save).*$/i, '');
          company = company.trim();
          
          // If it looks reasonable, use it; otherwise skip
          if (company.length > 3 && company.length < 100 && !company.includes('jobsdb')) {
            console.log('✅ Found reasonable company name:', company);
            return company;
          }
        }
        
        // If no good company found, just return null
        console.log('ℹ️ No reliable company name found, skipping');
        return null;
        
      } catch (error) {
        console.error('❌ Company extraction error:', error);
        return null;
      }
    }

    /**
     * Gets the job responsibilities from the page
     * 
     * @returns {Array<string>} Array of responsibilities
     */
    getResponsibilities() {
      try {
        console.log('📋 JobsDBExtractor: Starting responsibilities extraction...');
        
        // Enhanced strategy: Try multiple extraction approaches
        const strategies = [
          this._extractFromStructuredLists.bind(this),
          this._extractFromJobDescriptionSections.bind(this),
          this._extractFromAllElements.bind(this)
        ];
        
        for (const [index, strategy] of strategies.entries()) {
          console.log(`📋 Trying strategy ${index + 1}...`);
          const result = strategy();
          
          if (result && result.length > 0) {
            console.log(`✅ Strategy ${index + 1} succeeded with ${result.length} responsibilities`);
            console.log('📋 Responsibilities preview:', result.slice(0, 3).map((item, idx) => `${idx + 1}. ${item.substring(0, 80)}...`));
            return result;
          }
          
          console.log(`❌ Strategy ${index + 1} found 0 results`);
        }
        
        console.warn('⚠️ All extraction strategies failed - no responsibilities found');
        return [];
        
      } catch (error) {
        console.error('❌ Responsibilities extraction error:', error);
        return [];
      }
    }

    /**
     * Strategy 1: Extract from structured lists (ul, ol)
     * @private
     */
    _extractFromStructuredLists() {
      console.log('📋 Strategy 1: Extracting from structured lists...');
      
      const listElements = document.querySelectorAll('ul li, ol li');
      console.log(`📝 Found ${listElements.length} list items`);
      
      const responsibilities = [];
      
      for (const li of listElements) {
        const text = li.textContent?.trim() || '';
        if (this._isValidResponsibilityText(text)) {
          responsibilities.push(text);
        }
      }
      
      console.log(`📋 Found ${responsibilities.length} responsibilities in lists`);
      return responsibilities.slice(0, 15);
    }

    /**
     * Strategy 2: Extract from job description sections  
     * @private
     */
    _extractFromJobDescriptionSections() {
      console.log('📋 Strategy 2: Extracting from job description sections...');
      
      // Look for common job description section patterns
      const sectionSelectors = [
        '[class*="job-description"]',
        '[class*="description"]', 
        '[id*="job-description"]',
        '[id*="description"]',
        '.job-details',
        '.position-details',
        '.role-details'
      ];
      
      for (const selector of sectionSelectors) {
        try {
          const sections = document.querySelectorAll(selector);
          console.log(`🔍 Checking selector "${selector}": found ${sections.length} sections`);
          
          for (const section of sections) {
            const responsibilities = this._extractResponsibilitiesFromSection(section);
            if (responsibilities.length > 0) {
              console.log(`✅ Found ${responsibilities.length} responsibilities in section with selector "${selector}"`);
              return responsibilities;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error with selector "${selector}":`, error.message);
        }
      }
      
      console.log('❌ No responsibilities found in description sections');
      return [];
    }

    /**
     * Strategy 3: Extract from all elements (fallback)
     * @private
     */
    _extractFromAllElements() {
      console.log('📋 Strategy 3: Fallback - searching all elements...');
      
      const allElements = document.querySelectorAll('p, div, li, span, td');
      console.log(`📝 Found ${allElements.length} text elements to analyze`);
      
      const potentialItems = [];
      for (const element of allElements) {
        const text = element.textContent?.trim() || '';
        if (text.length > 15 && text.length < 500) {
          potentialItems.push(text);
        }
      }
      
      console.log(`🎯 Found ${potentialItems.length} potential text items`);
      
      // Enhanced filtering with better patterns
      const responsibilities = potentialItems.filter(item => this._isValidResponsibilityText(item));
      
      // Remove duplicates and return 
      const uniqueResponsibilities = [...new Set(responsibilities)];
      console.log(`✅ Filtered to ${uniqueResponsibilities.length} unique responsibilities`);
      
      return uniqueResponsibilities.slice(0, 15);
    }

    /**
     * Extract responsibilities from a specific section
     * @private
     */
    _extractResponsibilitiesFromSection(section) {
      const responsibilities = [];
      
      // First try lists within the section
      const lists = section.querySelectorAll('ul, ol');
      for (const list of lists) {
        const items = list.querySelectorAll('li');
        for (const item of items) {
          const text = item.textContent?.trim() || '';
          if (this._isValidResponsibilityText(text)) {
            responsibilities.push(text);
          }
        }
      }
      
      // If no lists, try paragraphs and divs
      if (responsibilities.length === 0) {
        const textElements = section.querySelectorAll('p, div');
        for (const element of textElements) {
          const text = element.textContent?.trim() || '';
          if (this._isValidResponsibilityText(text)) {
            responsibilities.push(text);
          }
        }
      }
      
      return responsibilities.slice(0, 15);
    }

    /**
     * Enhanced validation for responsibility text
     * @private
     */
    _isValidResponsibilityText(text) {
      if (!text || text.length < 10 || text.length > 500) {
        return false;
      }
      
      // Enhanced patterns for responsibilities (English)
      const englishActionWords = /^(oversee|analyze|troubleshoot|develop|understand|maintain|lead|manage|create|build|implement|conduct|provide|mentor|support|prepare|coordinate|design|ensure|establish|execute|deliver|collaborate|work|assist|help|handle|process|perform|review|monitor|supervise|organize|plan|research|investigate|test|evaluate|assess|document|report|communicate|participate|contribute|facilitate|optimize|enhance|improve|streamline)/i;
      
      // Enhanced patterns for responsibilities (Chinese)
      const chineseActionWords = /(負責|管理|開發|維護|設計|創建|實施|執行|協調|領導|支援|協助|處理|進行|完成|制定|規劃|監督|評估|分析|審查|改善|優化|建立|確保|提供|參與|配合|溝通|文檔|報告)/;
      
      // Action word at the beginning
      const hasActionWord = englishActionWords.test(text) || chineseActionWords.test(text);
      
      // Not a requirement (avoid misclassification)
      const notRequirement = !/bachelor|master|degree|years?\s+of\s+experience|proficient|knowledge|familiar|at\s+least|minimum|學位|學士|碩士|年經驗|熟練|了解|至少|最少/i.test(text);
      
      // Not UI elements or navigation
      const notUIElement = !/quick apply|jobsdb|how you match|skills and credentials|show all|view all|apply now|save job|share|print|職位|申請|分享|打印|收藏/i.test(text);
      
      // Valid job content (basic check)
      const isValidContent = this._isValidJobContent(text);
      
      // Additional Chinese responsibility indicators
      const hasChineseResponsibilityContext = /工作內容|職責範圍|主要職責|工作職責|負責事項|工作任務|具體職責/i.test(text);
      
      return (hasActionWord || hasChineseResponsibilityContext) && notRequirement && notUIElement && isValidContent;
    }

    /**
     * Gets the job requirements from the page
     * 
     * @returns {Array<string>} Array of requirements
     */
    getRequirements() {
      try {
        console.log('📋 JobsDBExtractor: Starting requirements extraction...');
        
        // First try to find structured lists (ul, ol elements)
        const listElements = document.querySelectorAll('ul li, ol li');
        const listRequirements = [];
        
        for (const li of listElements) {
          const text = li.textContent?.trim() || '';
          if (text.length > 15 && text.length < 400) {
            // Check if it looks like a requirement
            const hasQualification = /bachelor|master|degree|years?\s+of\s+experience|proficient|knowledge|familiar|at\s+least|minimum|strong|good|proven|solid/i.test(text);
            const hasTech = /cobol|csc|smart\/400|as\/400|sql|mysql|aws|gcp|azure|docker|git|agile|scrum|programming|development|system|application|security/i.test(text);
            const isNotAction = !/^(oversee|analyze|troubleshoot|develop|understand|maintain|lead|manage|create|build|implement|conduct|provide|mentor|support|prepare)/i.test(text);
            
            if ((hasQualification || hasTech) && isNotAction) {
              listRequirements.push(text);
            }
          }
        }
        
        console.log('📋 Found requirements in lists:', listRequirements.length);
        
        // If we found good results in lists, use those
        if (listRequirements.length >= 2) {
          console.log('✅ Using list-based requirements:', listRequirements.length);
          console.log('📋 Requirements found:', listRequirements.map((item, idx) => `${idx + 1}. ${item.substring(0, 60)}...`));
          return listRequirements.slice(0, 15); // Get up to 15 requirements
        }
        
        // Fallback: Find all elements with substantial text
        console.log('🔍 Fallback: searching all elements for requirements...');
        const allElements = document.querySelectorAll('p, div, li, span');
        const potentialItems = [];
        
        for (const element of allElements) {
          const text = element.textContent?.trim() || '';
          if (text.length > 15 && text.length < 400) {
            potentialItems.push(text);
          }
        }
        
        console.log('🎯 Potential items for requirements:', potentialItems.length);
        
        // Filter for requirement-like items with enhanced filtering
        const requirements = potentialItems.filter(item => {
          // Must contain qualification or tech keywords
          const hasQualification = /bachelor|master|degree|years?\s+of\s+experience|proficient|knowledge|familiar|at\s+least|minimum|strong|good|proven|solid/i.test(item);
          const hasTech = /cobol|csc|smart\/400|as\/400|sql|mysql|aws|gcp|azure|docker|git|agile|scrum|programming|development|system|application|security|interpersonal|problem\s+solving|written|spoken|english|cantonese/i.test(item);
          
          // Must not start with action words (responsibilities)
          const isAction = /^(oversee|analyze|troubleshoot|develop|understand|maintain|lead|manage|create|build|implement|conduct|provide|mentor|support|prepare)/i.test(item);
          
          // Filter out UI garbage
          const isUIGarbage = /how you match|skills and credentials|show all|view all|quick apply|jobsdb/i.test(item) ||
                            item.length < 20 ||
                            !this._isValidJobContent(item);
          
          return (hasQualification || hasTech) && !isAction && !isUIGarbage;
        });
        
        // Remove duplicates and return all found
        const uniqueRequirements = [...new Set(requirements)];
        
        console.log('✅ Filtered requirements:', uniqueRequirements.length);
        console.log('📋 Requirements found:', uniqueRequirements.map((item, idx) => `${idx + 1}. ${item.substring(0, 60)}...`));
        
        return uniqueRequirements.slice(0, 15); // Return up to 15 items
      } catch (error) {
        console.error('❌ Requirements extraction error:', error);
        return [];
      }
    }

    /**
     * Gets additional job details
     * 
     * @returns {Object} Additional job details
     */
    getJobDetails() {
      try {
        const details = {
          url: window.location.href,
          extractedAt: new Date().toISOString(),
          salary: null,
          location: null,
          jobType: null
        };

        // Extract salary information
        const salaryElement = document.querySelector('[data-automation="job-detail-salary"]');
        if (salaryElement) {
          details.salary = salaryElement.textContent.trim();
        }

        // Extract location
        const locationElement = document.querySelector('[data-automation="job-detail-location"]');
        if (locationElement) {
          details.location = locationElement.textContent.trim();
        }

        // Extract job type
        const jobTypeElement = document.querySelector('[data-automation="job-detail-work-type"]');
        if (jobTypeElement) {
          details.jobType = jobTypeElement.textContent.trim();
        }

        this.logger.debug('Extracted job details', details);
        return details;
      } catch (error) {
        this.logger.error('Error extracting job details', error);
        return {
          url: window.location.href,
          extractedAt: new Date().toISOString(),
          salary: null,
          location: null,
          jobType: null
        };
      }
    }

    /**
     * Extracts complete job information from current page
     * 
     * @returns {Promise<Object>} Job information object
     * @throws {Error} When extraction fails
     */
    async extractJobInfo() {
      try {
        console.log('🔍 JobsDBExtractor: Starting extraction process...');
        
        if (!this.isValidJobPage()) {
          throw new Error('Not a valid JobsDB job page');
        }

        console.log('✅ JobsDBExtractor: Valid page confirmed');

        const jobInfo = {
          title: this.getJobTitle(),
          company: this.getCompanyName(),
          responsibilities: this.getResponsibilities(),
          requirements: this.getRequirements(),
          details: this.getJobDetails()
        };

        console.log('📊 JobsDBExtractor: Extraction results:', {
          title: jobInfo.title,
          company: jobInfo.company || 'N/A (skipped)',
          responsibilitiesCount: jobInfo.responsibilities.length,
          requirementsCount: jobInfo.requirements.length,
          responsibilitiesSample: jobInfo.responsibilities.slice(0, 2),
          requirementsSample: jobInfo.requirements.slice(0, 2)
        });

        this.logger.info('Successfully extracted job information', { 
          title: jobInfo.title,
          company: jobInfo.company || 'N/A (skipped)',
          responsibilitiesCount: jobInfo.responsibilities.length,
          requirementsCount: jobInfo.requirements.length
        });

        return jobInfo;
      } catch (error) {
        console.error('❌ JobsDBExtractor: Extraction failed:', error);
        this.logger.error('Failed to extract job information', error);
        throw error;
      }
    }

    /**
     * Checks if text is valid job content (not navigation or UI elements)
     * 
     * @param {string} text - Text to check
     * @returns {boolean} True if valid job content
     * @private
     */
    _isValidJobContent(text) {
      // Much more lenient filtering - only filter obvious UI elements
      const invalidPatterns = [
        /^(jobsdb|menu|profile|career advice|explore companies|sign out)/i,
        /^(quick apply|save|view all jobs|show all)$/i,
        /^(report this job|be careful|don't provide)/i,
        /^(download|google play|app store)/i,
        /^(terms|conditions|privacy|copyright)$/i,
        /^(chiu wa|employer site)$/i,
        /^×$|^✕$/,
        /^\d+d ago$/,
        /^[A-Z]{2,}$/,
        /^(cancel|select|please)$/i
      ];
      
      // Basic length check
      if (text.length < 10 || text.length > 500) return false;
      
      const isValid = !invalidPatterns.some(pattern => pattern.test(text.trim()));
      
      return isValid;
    }
  }

  // Make JobsDBExtractor available globally in both environments
  if (typeof window !== 'undefined') {
    window.JobsDBExtractor = JobsDBExtractor;
  }
  
  // Make it available for importScripts in service worker
  if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
    self.JobsDBExtractor = JobsDBExtractor;
  }
  
  // Make it the global JobsDBExtractor
  globalThis.JobsDBExtractor = JobsDBExtractor;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JobsDBExtractor;
} 