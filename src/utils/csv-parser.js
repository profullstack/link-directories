import { readFile } from 'fs/promises';

/**
 * Parse a CSV file and return an array of directory objects
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array<{name: string, url: string, status: string}>>}
 */
export async function parseDirectoriesCSV(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    // Skip header line
    const dataLines = lines.slice(1);

    return dataLines.map((line, index) => {
      // Handle CSV with quoted fields (for HTML in submit_button)
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current); // Add last part

      if (parts.length < 2) {
        throw new Error(
          `Invalid CSV format at line ${index + 2}: expected at least 2 columns`
        );
      }

      return {
        name: parts[0]?.trim() || '',
        url: parts[1]?.trim() || '',
        submit_url: parts[2]?.trim() || '',
        submit_button: parts[3]?.trim() || '',
        status: parts[4]?.trim() || '',
      };
    });
  } catch (error) {
    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
}

/**
 * Filter directories by submission status
 * @param {Array<{name: string, url: string, status: string}>} directories
 * @param {string} status - Status to filter by (e.g., 'submitted', '')
 * @returns {Array<{name: string, url: string, status: string}>}
 */
export function filterByStatus(directories, status = '') {
  return directories.filter((dir) => dir.status === status);
}

/**
 * Get unsubmitted directories (those without a status)
 * @param {Array<{name: string, url: string, status: string}>} directories
 * @returns {Array<{name: string, url: string, status: string}>}
 */
export function getUnsubmittedDirectories(directories) {
  return filterByStatus(directories, '');
}