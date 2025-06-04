/**
 * Generic job information extractor for various job sites
 * Implements fallback extraction when specific extractors aren't available
 * Follows Open-Closed Principle - extensible for new job sites
 * 
 * @class GenericJobExtractor
 * @extends IJobExtractor
 */
if (typeof GenericJobExtractor === 'undefined') {
  // Define GenericJobExtractor class
  class GenericJobExtractor {
    /**
     * Creates an instance of GenericJobExtractor
     * 
     * @param {LoggerService} logger - Logger service instance
     */
    constructor(logger) {
      this.logger = logger;
      this.titleSelectors = [
        'h1[data-automation="job-detail-title"]', // JobsDB
        'h1.job-title',
        'h1[class*="title"]',
        'h1[class*="job"]',
        '.job-title h1',
        '.position-title h1',
        'h1:first-of-type',
        'h1'
      ];
      
      this.companySelectors = [
        '[data-automation="job-detail-company-name"]', // JobsDB
        '.company-name',
        '.employer-name',
        '[class*="company"]',
        '[class*="employer"]',
        'h2:first-of-type',
        'h2'
      ];
      
      this.descriptionSelectors = [
        '[data-automation="job-detail-description"]', // JobsDB
        '.job-description',
        '.job-details',
        '.position-description',
        '[class*="description"]',
        '[class*="detail"]',
        'main',
        '.content',
        'article'
      ];
      
      this.responsibilityKeywords = [
        'responsibilities', 'job responsibilities', '職責', '工作職責',
        'duties', 'key responsibilities', '主要職責',
        'what you will do', '你將要做', '工作內容'
      ];
      
      this.requirementKeywords = [
        'requirements', 'job requirements', '要求', '職位要求', 
        'qualifications', '資格', 'skills', '技能',
        'experience', '經驗', 'education', '學歷',
        'what we are looking for', '我們尋找', '申請條件'
      ];
    }

    /**
     * Validates if current page could be a job posting
     * More flexible than JobsDB-specific validation
     * 
     * @returns {boolean} True if likely a job page
     */
    isValidJobPage() {
      try {
        const url = window.location.href;
        
        // Check for job-related keywords in URL
        const jobUrlKeywords = [
          'job', 'jobs', 'career', 'careers', 'position', 'vacancy', 
          'employment', 'hire', 'hiring', '職位', '工作', '招聘'
        ];
        
        const hasJobKeywordInUrl = jobUrlKeywords.some(keyword => 
          url.toLowerCase().includes(keyword)
        );
        
        // Try to find a job title
        const hasJobTitle = this._findElementBySelectors(this.titleSelectors) !== null;
        
        // Check for job-related content in page
        const hasJobContent = this._hasJobRelatedContent();
        
        this.logger.debug('Generic page validation', { 
          url, 
          hasJobKeywordInUrl, 
          hasJobTitle, 
          hasJobContent 
        });
        
        // Page is valid if it has job keywords in URL OR has job title OR has job content
        return hasJobKeywordInUrl || hasJobTitle || hasJobContent;
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
        const titleElement = this._findElementBySelectors(this.titleSelectors);
        const title = titleElement ? titleElement.textContent.trim() : null;
        
        // If no title found by selectors, try to find by content
        if (!title) {
          const alternativeTitle = this._findJobTitleByContent();
          if (alternativeTitle) {
            this.logger.debug('Found job title by content analysis', { title: alternativeTitle });
            return alternativeTitle;
          }
        }
        
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
        const companyElement = this._findElementBySelectors(this.companySelectors);
        const company = companyElement ? companyElement.textContent.trim() : null;
        
        // If no company found by selectors, try to extract from page title or meta tags
        if (!company) {
          const alternativeCompany = this._findCompanyByContent();
          if (alternativeCompany) {
            this.logger.debug('Found company by content analysis', { company: alternativeCompany });
            return alternativeCompany;
          }
        }
        
        this.logger.debug('Extracted company name', { company });
        return company;
      } catch (error) {
        this.logger.error('Error extracting company name', error);
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
        this.logger.debug('Starting responsibilities extraction with GenericJobExtractor');
        console.log('📋 GenericJobExtractor: Starting responsibilities extraction...');
        
        const responsibilities = [];
        const descriptionElement = this._findElementBySelectors(this.descriptionSelectors);
        
        if (!descriptionElement) {
          console.log('⚠️ Job description element not found');
          this.logger.warn('Job description element not found');
          
          // Fallback: try to find any element with job-related content
          return this._extractFromEntirePage();
        }

        console.log('✅ Found job description element');

        // Strategy 1: Look for responsibilities section with keywords
        const responsibilitiesSection = this._findSectionByKeywords(
          descriptionElement,
          this.responsibilityKeywords
        );

        if (responsibilitiesSection) {
          console.log('✅ Found dedicated responsibilities section');
          const items = this._extractListItems(responsibilitiesSection);
          const validItems = items.filter(item => this._isLikelyResponsibility(item));
          responsibilities.push(...validItems);
          console.log(`📋 Extracted ${validItems.length} responsibilities from dedicated section`);
        }

        // Strategy 2: If no specific section found, try to extract from entire description
        if (responsibilities.length === 0) {
          console.log('🔍 No dedicated section found, searching entire description...');
          const allItems = this._extractListItems(descriptionElement);
          const filteredItems = allItems.filter(item => this._isLikelyResponsibility(item));
          responsibilities.push(...filteredItems);
          console.log(`📋 Extracted ${filteredItems.length} responsibilities from entire description`);
        }

        // Strategy 3: Enhanced text analysis
        if (responsibilities.length === 0) {
          console.log('🔍 No list items found, trying text analysis...');
          const textResponsibilities = this._extractResponsibilitiesFromText(descriptionElement);
          responsibilities.push(...textResponsibilities);
          console.log(`📋 Extracted ${textResponsibilities.length} responsibilities from text analysis`);
        }

        // Remove duplicates and limit results
        const uniqueResponsibilities = [...new Set(responsibilities)].slice(0, 15);
        
        console.log(`✅ GenericJobExtractor final result: ${uniqueResponsibilities.length} responsibilities`);
        if (uniqueResponsibilities.length > 0) {
          console.log('📋 Responsibilities preview:', uniqueResponsibilities.slice(0, 3).map((item, idx) => `${idx + 1}. ${item.substring(0, 80)}...`));
        }

        this.logger.debug('Extracted responsibilities', { count: uniqueResponsibilities.length });
        return uniqueResponsibilities;
      } catch (error) {
        console.error('❌ GenericJobExtractor responsibilities extraction error:', error);
        this.logger.error('Error extracting responsibilities', error);
        return [];
      }
    }

    /**
     * Extract responsibilities from entire page (fallback)
     * @private
     */
    _extractFromEntirePage() {
      console.log('🔍 Fallback: extracting from entire page...');
      
      const allElements = document.querySelectorAll('p, div, li, span, td');
      console.log(`📝 Found ${allElements.length} elements to analyze`);
      
      const responsibilities = [];
      
      for (const element of allElements) {
        const text = element.textContent?.trim() || '';
        if (text.length > 10 && text.length < 500 && this._isLikelyResponsibility(text)) {
          responsibilities.push(text);
        }
      }
      
      const uniqueResponsibilities = [...new Set(responsibilities)].slice(0, 15);
      console.log(`📋 Extracted ${uniqueResponsibilities.length} responsibilities from entire page`);
      
      return uniqueResponsibilities;
    }

    /**
     * Extract responsibilities from text content
     * @private
     */
    _extractResponsibilitiesFromText(container) {
      const responsibilities = [];
      
      // Get all text content
      const fullText = container.textContent || '';
      
      // Split by common delimiters
      const lines = fullText.split(/[\n\r•·\*\-]/);
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 10 && trimmed.length < 500 && this._isLikelyResponsibility(trimmed)) {
          responsibilities.push(trimmed);
        }
      }
      
      return responsibilities;
    }

    /**
     * Gets the job requirements from the page
     * 
     * @returns {Array<string>} Array of requirements
     */
    getRequirements() {
      try {
        const requirements = [];
        const descriptionElement = this._findElementBySelectors(this.descriptionSelectors);
        
        if (!descriptionElement) {
          this.logger.warn('Job description element not found');
          return requirements;
        }

        // Look for requirements section
        const requirementsSection = this._findSectionByKeywords(
          descriptionElement,
          this.requirementKeywords
        );

        if (requirementsSection) {
          const items = this._extractListItems(requirementsSection);
          requirements.push(...items);
        }

        // If no specific section found, try to extract from entire description
        if (requirements.length === 0) {
          const allItems = this._extractListItems(descriptionElement);
          // Filter items that might be requirements
          const filteredItems = allItems.filter(item => 
            this._isLikelyRequirement(item)
          );
          requirements.push(...filteredItems);
        }

        this.logger.debug('Extracted requirements', { count: requirements.length });
        return requirements;
      } catch (error) {
        this.logger.error('Error extracting requirements', error);
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
          jobType: null,
          pageTitle: document.title
        };

        // Extract salary information
        details.salary = this._extractSalaryInfo();
        
        // Extract location
        details.location = this._extractLocationInfo();
        
        // Extract job type
        details.jobType = this._extractJobTypeInfo();

        this.logger.debug('Extracted job details', details);
        return details;
      } catch (error) {
        this.logger.error('Error extracting job details', error);
        return {
          url: window.location.href,
          extractedAt: new Date().toISOString(),
          salary: null,
          location: null,
          jobType: null,
          pageTitle: document.title
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
        if (!this.isValidJobPage()) {
          throw new Error('Page does not appear to contain job information');
        }

        const jobInfo = {
          title: this.getJobTitle(),
          company: this.getCompanyName(),
          responsibilities: this.getResponsibilities(),
          requirements: this.getRequirements(),
          details: this.getJobDetails()
        };

        // Ensure we have at least basic information
        if (!jobInfo.title && !jobInfo.company && 
            jobInfo.responsibilities.length === 0 && 
            jobInfo.requirements.length === 0) {
          throw new Error('Unable to extract meaningful job information from this page');
        }

        this.logger.info('Successfully extracted job information', { 
          title: jobInfo.title,
          company: jobInfo.company,
          responsibilitiesCount: jobInfo.responsibilities.length,
          requirementsCount: jobInfo.requirements.length
        });

        return jobInfo;
      } catch (error) {
        this.logger.error('Failed to extract job information', error);
        throw error;
      }
    }

    // Private helper methods

    /**
     * Finds element by trying multiple selectors
     * @private
     */
    _findElementBySelectors(selectors) {
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            return element;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      return null;
    }

    /**
     * Checks if page has job-related content
     * @private
     */
    _hasJobRelatedContent() {
      const bodyText = document.body.textContent.toLowerCase();
      const jobKeywords = [
        'responsibilities', 'requirements', 'qualifications', 
        'experience', 'skills', 'salary', 'benefits',
        '職責', '要求', '資格', '經驗', '技能', '薪資', '福利'
      ];
      
      return jobKeywords.some(keyword => bodyText.includes(keyword));
    }

    /**
     * Finds job title by content analysis
     * @private
     */
    _findJobTitleByContent() {
      // Try page title first
      const pageTitle = document.title;
      if (pageTitle && pageTitle.length > 0 && pageTitle.length < 100) {
        return pageTitle;
      }
      
      // Try largest heading
      const headings = document.querySelectorAll('h1, h2, h3');
      for (const heading of headings) {
        const text = heading.textContent.trim();
        if (text && text.length > 5 && text.length < 100) {
          return text;
        }
      }
      
      return null;
    }

    /**
     * Finds company name by content analysis
     * @private
     */
    _findCompanyByContent() {
      // Try meta tags
      const metaTags = document.querySelectorAll('meta[property*="site_name"], meta[name*="author"]');
      for (const meta of metaTags) {
        const content = meta.getAttribute('content');
        if (content && content.length > 0 && content.length < 50) {
          return content;
        }
      }
      
      return null;
    }

    /**
     * Finds section by keywords in the text content
     * @private
     */
    _findSectionByKeywords(container, keywords) {
      const elements = container.querySelectorAll('*');
      
      for (const element of elements) {
        const text = element.textContent.toLowerCase();
        for (const keyword of keywords) {
          if (text.includes(keyword.toLowerCase())) {
            return element.parentElement || element;
          }
        }
      }
      
      return null;
    }

    /**
     * Extracts list items from a section
     * @private
     */
    _extractListItems(section) {
      const items = [];
      
      // Try to find ul/ol lists first
      const lists = section.querySelectorAll('ul, ol');
      for (const list of lists) {
        const listItems = list.querySelectorAll('li');
        for (const item of listItems) {
          const text = item.textContent.trim();
          if (text && text.length > 5) {
            items.push(text);
          }
        }
      }
      
      // If no lists found, try paragraphs and divs
      if (items.length === 0) {
        const paragraphs = section.querySelectorAll('p, div');
        for (const p of paragraphs) {
          const text = p.textContent.trim();
          if (text && text.length > 10) {
            // Split by common bullet points or line breaks
            const splitText = text.split(/[•·\n\r]/);
            for (const line of splitText) {
              const trimmed = line.trim();
              if (trimmed && trimmed.length > 5) {
                items.push(trimmed);
              }
            }
          }
        }
      }
      
      return items.slice(0, 20); // Limit to 20 items
    }

    /**
     * Checks if text is likely a job responsibility
     * @private
     */
    _isLikelyResponsibility(text) {
      if (!text || text.length < 8 || text.length > 500) {
        return false;
      }
      
      // Enhanced English responsibility indicators
      const englishResponsibilityIndicators = [
        'develop', 'manage', 'lead', 'coordinate', 'implement', 'maintain',
        'design', 'create', 'analyze', 'review', 'support', 'assist',
        'execute', 'deliver', 'collaborate', 'work', 'handle', 'process',
        'perform', 'monitor', 'supervise', 'organize', 'plan', 'research',
        'investigate', 'test', 'evaluate', 'assess', 'document', 'report',
        'communicate', 'participate', 'contribute', 'facilitate', 'optimize',
        'enhance', 'improve', 'streamline', 'ensure', 'establish', 'build',
        'oversee', 'troubleshoot', 'understand', 'conduct', 'provide',
        'mentor', 'prepare', 'responsible for', 'accountable for'
      ];
      
      // Enhanced Chinese responsibility indicators
      const chineseResponsibilityIndicators = [
        '開發', '管理', '領導', '協調', '實施', '維護', '設計', '創建', '分析', '審查', '支援', '協助',
        '負責', '執行', '處理', '進行', '完成', '制定', '規劃', '監督', '評估', '改善', '優化',
        '建立', '確保', '提供', '參與', '配合', '溝通', '文檔', '報告', '研究', '測試', '評測',
        '組織', '計劃', '準備', '培訓', '指導', '協作', '合作', '推動', '落實', '執行'
      ];
      
      // Check for Chinese responsibility context keywords
      const chineseResponsibilityContext = [
        '工作內容', '職責範圍', '主要職責', '工作職責', '負責事項', '工作任務', '具體職責',
        '職位要求', '崗位職責', '工作要求', '主要工作', '日常工作', '核心職責'
      ];
      
      const lowerText = text.toLowerCase();
      
      // Check for English indicators
      const hasEnglishIndicator = englishResponsibilityIndicators.some(indicator => 
        lowerText.includes(indicator.toLowerCase())
      );
      
      // Check for Chinese indicators
      const hasChineseIndicator = chineseResponsibilityIndicators.some(indicator => 
        text.includes(indicator)
      );
      
      // Check for Chinese context
      const hasChineseContext = chineseResponsibilityContext.some(context => 
        text.includes(context)
      );
      
      // Enhanced action word patterns
      const englishActionPattern = /^(develop|manage|lead|coordinate|implement|maintain|design|create|analyze|review|support|assist|execute|deliver|collaborate|work|handle|process|perform|monitor|supervise|organize|plan|research|investigate|test|evaluate|assess|document|report|communicate|participate|contribute|facilitate|optimize|enhance|improve|streamline|ensure|establish|build|oversee|troubleshoot|understand|conduct|provide|mentor|prepare|responsible|accountable)/i;
      
      const chineseActionPattern = /(^負責|^管理|^開發|^維護|^設計|^創建|^實施|^執行|^協調|^領導|^支援|^協助|^處理|^進行|^完成|^制定|^規劃|^監督|^評估|^分析|^審查|^改善|^優化|^建立|^確保|^提供|^參與|^配合|^溝通|^文檔|^報告)/;
      
      const hasActionPattern = englishActionPattern.test(text) || chineseActionPattern.test(text);
      
      // Exclude requirements/qualifications
      const notRequirement = !/bachelor|master|degree|years?\s+of\s+experience|proficient|knowledge|familiar|at\s+least|minimum|學位|學士|碩士|年經驗|熟練|了解|至少|最少|require|必須|需要|具備|擁有/i.test(text);
      
      // Exclude UI elements and non-job content
      const notUIElement = !/quick apply|jobsdb|how you match|skills and credentials|show all|view all|apply now|save job|share|print|職位|申請|分享|打印|收藏|登錄|註冊|搜索|查看|關於我們/i.test(text);
      
      return (hasEnglishIndicator || hasChineseIndicator || hasChineseContext || hasActionPattern) && notRequirement && notUIElement;
    }

    /**
     * Checks if text is likely a job requirement
     * @private
     */
    _isLikelyRequirement(text) {
      const requirementIndicators = [
        'degree', 'experience', 'years', 'knowledge', 'skill', 'proficient',
        'bachelor', 'master', 'certification', 'required', 'preferred',
        '學位', '經驗', '年', '知識', '技能', '熟練', '學士', '碩士', '認證', '必須', '優先'
      ];
      
      const lowerText = text.toLowerCase();
      return requirementIndicators.some(indicator => lowerText.includes(indicator));
    }

    /**
     * Extracts salary information
     * @private
     */
    _extractSalaryInfo() {
      const salarySelectors = [
        '[data-automation="job-detail-salary"]',
        '.salary', '.compensation', '.pay-range',
        '[class*="salary"]', '[class*="compensation"]'
      ];
      
      const salaryElement = this._findElementBySelectors(salarySelectors);
      return salaryElement ? salaryElement.textContent.trim() : null;
    }

    /**
     * Extracts location information
     * @private
     */
    _extractLocationInfo() {
      const locationSelectors = [
        '[data-automation="job-detail-location"]',
        '.location', '.job-location', '.address',
        '[class*="location"]', '[class*="address"]'
      ];
      
      const locationElement = this._findElementBySelectors(locationSelectors);
      return locationElement ? locationElement.textContent.trim() : null;
    }

    /**
     * Extracts job type information
     * @private
     */
    _extractJobTypeInfo() {
      const jobTypeSelectors = [
        '[data-automation="job-detail-work-type"]',
        '.job-type', '.employment-type', '.work-type',
        '[class*="job-type"]', '[class*="employment"]'
      ];
      
      const jobTypeElement = this._findElementBySelectors(jobTypeSelectors);
      return jobTypeElement ? jobTypeElement.textContent.trim() : null;
    }
  }

  // Make GenericJobExtractor available globally in both environments
  if (typeof window !== 'undefined') {
    window.GenericJobExtractor = GenericJobExtractor;
  }
  
  // Make it available for importScripts in service worker
  if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
    self.GenericJobExtractor = GenericJobExtractor;
  }
  
  // Make it the global GenericJobExtractor
  globalThis.GenericJobExtractor = GenericJobExtractor;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenericJobExtractor;
} 