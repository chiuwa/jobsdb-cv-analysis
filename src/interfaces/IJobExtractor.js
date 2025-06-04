/**
 * Interface for job information extraction
 * Follows Open-Closed Principle - open for extension, closed for modification
 * 
 * @interface IJobExtractor
 */
class IJobExtractor {
  /**
   * Extracts job information from current page
   * 
   * @returns {Promise<Object>} Job information object
   * @throws {Error} When extraction fails
   * @abstract
   */
  async extractJobInfo() {
    throw new Error('extractJobInfo method must be implemented');
  }

  /**
   * Validates if current page is a valid job posting
   * 
   * @returns {boolean} True if valid job page
   * @abstract
   */
  isValidJobPage() {
    throw new Error('isValidJobPage method must be implemented');
  }

  /**
   * Gets the job title from the page
   * 
   * @returns {string|null} Job title or null if not found
   * @abstract
   */
  getJobTitle() {
    throw new Error('getJobTitle method must be implemented');
  }

  /**
   * Gets the company name from the page
   * 
   * @returns {string|null} Company name or null if not found
   * @abstract
   */
  getCompanyName() {
    throw new Error('getCompanyName method must be implemented');
  }

  /**
   * Gets the job responsibilities from the page
   * 
   * @returns {Array<string>} Array of responsibilities
   * @abstract
   */
  getResponsibilities() {
    throw new Error('getResponsibilities method must be implemented');
  }

  /**
   * Gets the job requirements from the page
   * 
   * @returns {Array<string>} Array of requirements
   * @abstract
   */
  getRequirements() {
    throw new Error('getRequirements method must be implemented');
  }

  /**
   * Gets additional job details
   * 
   * @returns {Object} Additional job details
   * @abstract
   */
  getJobDetails() {
    throw new Error('getJobDetails method must be implemented');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IJobExtractor;
} 