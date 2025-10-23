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

    return lines.map((line, index) => {
      const parts = line.split(',');

      if (parts.length < 2) {
        throw new Error(
          `Invalid CSV format at line ${index + 1}: expected at least 2 columns`
        );
      }

      return {
        name: parts[0]?.trim() || '',
        url: parts[1]?.trim() || '',
        status: parts[2]?.trim() || '',
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