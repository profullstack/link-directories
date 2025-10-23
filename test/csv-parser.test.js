import { expect } from 'chai';
import { writeFile, unlink } from 'fs/promises';
import {
  parseDirectoriesCSV,
  filterByStatus,
  getUnsubmittedDirectories,
} from '../src/utils/csv-parser.js';

describe('CSV Parser', () => {
  const testCsvPath = './test-directories.csv';

  // Sample CSV content for testing
  const sampleCSV = `AI Tool Directory,https://example.com/ai,submitted
Another Directory,https://example.com/another,
Third Directory,https://example.com/third,submitted
Fourth Directory,https://example.com/fourth,`;

  before(async () => {
    // Create a test CSV file
    await writeFile(testCsvPath, sampleCSV);
  });

  after(async () => {
    // Clean up test CSV file
    try {
      await unlink(testCsvPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('parseDirectoriesCSV', () => {
    it('should parse CSV file and return array of directory objects', async () => {
      const directories = await parseDirectoriesCSV(testCsvPath);

      expect(directories).to.be.an('array');
      expect(directories).to.have.lengthOf(4);
    });

    it('should correctly parse directory name, url, and status', async () => {
      const directories = await parseDirectoriesCSV(testCsvPath);
      const firstDir = directories[0];

      expect(firstDir).to.have.property('name', 'AI Tool Directory');
      expect(firstDir).to.have.property('url', 'https://example.com/ai');
      expect(firstDir).to.have.property('status', 'submitted');
    });

    it('should handle empty status field', async () => {
      const directories = await parseDirectoriesCSV(testCsvPath);
      const secondDir = directories[1];

      expect(secondDir.status).to.equal('');
    });

    it('should throw error for non-existent file', async () => {
      try {
        await parseDirectoriesCSV('./non-existent.csv');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to parse CSV file');
      }
    });

    it('should throw error for invalid CSV format', async () => {
      const invalidCsvPath = './test-invalid.csv';
      await writeFile(invalidCsvPath, 'InvalidLine');

      try {
        await parseDirectoriesCSV(invalidCsvPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid CSV format');
      } finally {
        await unlink(invalidCsvPath);
      }
    });
  });

  describe('filterByStatus', () => {
    let directories;

    before(async () => {
      directories = await parseDirectoriesCSV(testCsvPath);
    });

    it('should filter directories by submitted status', () => {
      const submitted = filterByStatus(directories, 'submitted');

      expect(submitted).to.be.an('array');
      expect(submitted).to.have.lengthOf(2);
      expect(submitted.every((dir) => dir.status === 'submitted')).to.be.true;
    });

    it('should filter directories by empty status', () => {
      const unsubmitted = filterByStatus(directories, '');

      expect(unsubmitted).to.be.an('array');
      expect(unsubmitted).to.have.lengthOf(2);
      expect(unsubmitted.every((dir) => dir.status === '')).to.be.true;
    });

    it('should return empty array for non-matching status', () => {
      const result = filterByStatus(directories, 'nonexistent');

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });

  describe('getUnsubmittedDirectories', () => {
    let directories;

    before(async () => {
      directories = await parseDirectoriesCSV(testCsvPath);
    });

    it('should return only unsubmitted directories', () => {
      const unsubmitted = getUnsubmittedDirectories(directories);

      expect(unsubmitted).to.be.an('array');
      expect(unsubmitted).to.have.lengthOf(2);
      expect(unsubmitted.every((dir) => dir.status === '')).to.be.true;
    });

    it('should return correct directory names', () => {
      const unsubmitted = getUnsubmittedDirectories(directories);
      const names = unsubmitted.map((dir) => dir.name);

      expect(names).to.include('Another Directory');
      expect(names).to.include('Fourth Directory');
    });
  });
});