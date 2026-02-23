import express from 'express';
import path from 'path';
import { findBestMatch, compareTwoStrings } from 'string-similarity';

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Helper to get a normalized name for comparison
const normalize = (name: string) => {
  return name
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/[\d_\-]+/g, ' ') // replace numbers, underscores, hyphens with space
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim()
    .toLowerCase();
};

import fs from 'fs';

// --- API ROUTES ---

// API endpoint to process files from a server path
app.post('/api/process-path', (req, res) => {
  const { dirPath } = req.body;

  if (!dirPath) {
    return res.status(400).json({ error: 'Directory path is required.' });
  }

  const fullPath = path.join(__dirname, dirPath);

  // Check if path exists and is a directory
  fs.stat(fullPath, (statErr, stats) => {
    if (statErr) {
      console.error('Stat Error for path:', fullPath, statErr);
      return res.status(404).json({ error: `Path not found or inaccessible: ${dirPath}` });
    }
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: `The provided path is not a directory: ${dirPath}` });
    }

    // If it's a directory, proceed with readdir
    fs.readdir(fullPath, (readErr, files) => {
      if (readErr) {
        console.error('Error reading directory:', readErr);
        return res.status(500).json({ error: 'Failed to read directory contents.' });
      }

      const fileData = files.map(fileName => ({
        name: fileName,
        path: path.join(dirPath, fileName),
        type: '', // MIME type detection can be added later
      }));

      // --- REUSE EXISTING GROUPING AND AUTHENTICITY LOGIC ---
      const groups = new Map<string, any[]>();
      for (const file of fileData) {
        const normalizedName = normalize(file.name);
        if (groups.size === 0) {
          groups.set(file.name, [file]);
          continue;
        }
        const groupKeys = Array.from(groups.keys());
        const normalizedGroupKeys = groupKeys.map(normalize);
        const { bestMatch, bestMatchIndex } = findBestMatch(normalizedName, normalizedGroupKeys);
        if (bestMatch.rating > 0.6) {
          const bestGroupKey = groupKeys[bestMatchIndex];
          groups.get(bestGroupKey)?.push(file);
        } else {
          groups.set(file.name, [file]);
        }
      }

      const authenticityScores = new Map<string, number>();
      for (const [groupName, filesInGroup] of groups.entries()) {
        if (filesInGroup.length <= 1) {
          authenticityScores.set(groupName, 100);
          continue;
        }
        const ratings = filesInGroup.map(file => 
          compareTwoStrings(normalize(groupName), normalize(file.name))
        );
        const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        authenticityScores.set(groupName, Math.round(averageRating * 100));
      }

      const groupedFilesObj = Object.fromEntries(groups);
      const authenticityScoresObj = Object.fromEntries(authenticityScores);

      res.json({ files: fileData, groupedFiles: groupedFilesObj, authenticityScores: authenticityScoresObj });
    });
  });
});

// API endpoint to process uploaded files
app.post('/api/process-files', (req, res) => {
  const { files } = req.body;

  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'Invalid file list provided.' });
  }

  const groups = new Map<string, any[]>();
  if (files.length === 0) {
    return res.json({ groupedFiles: {}, authenticityScores: {} });
  }

  // Grouping logic
  for (const file of files) {
    const normalizedName = normalize(file.name);
    if (groups.size === 0) {
      groups.set(file.name, [file]);
      continue;
    }

    const groupKeys = Array.from(groups.keys());
    const normalizedGroupKeys = groupKeys.map(normalize);
    
    const { bestMatch, bestMatchIndex } = findBestMatch(normalizedName, normalizedGroupKeys);

    if (bestMatch.rating > 0.6) { // Similarity threshold
      const bestGroupKey = groupKeys[bestMatchIndex];
      groups.get(bestGroupKey)?.push(file);
    } else {
      groups.set(file.name, [file]);
    }
  }

  // Calculate authenticity
  const authenticityScores = new Map<string, number>();
  for (const [groupName, filesInGroup] of groups.entries()) {
    if (filesInGroup.length <= 1) {
      authenticityScores.set(groupName, 100);
      continue;
    }
    const ratings = filesInGroup.map(file => 
      compareTwoStrings(normalize(groupName), normalize(file.name))
    );
    const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    authenticityScores.set(groupName, Math.round(averageRating * 100));
  }

  // Convert Maps to objects for JSON response
  const groupedFilesObj = Object.fromEntries(groups);
  const authenticityScoresObj = Object.fromEntries(authenticityScores);

  res.json({ groupedFiles: groupedFilesObj, authenticityScores: authenticityScoresObj });
});

// --- STATIC FILE SERVING ---
// This should come after all API routes
app.use(express.static(path.join(__dirname)));

app.listen(PORT, '0.0.0.0', () => {
  const { files } = req.body;

  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'Invalid file list provided.' });
  }

  const groups = new Map<string, any[]>();
  if (files.length === 0) {
    return res.json({ groupedFiles: {}, authenticityScores: {} });
  }

  // Grouping logic
  for (const file of files) {
    const normalizedName = normalize(file.name);
    if (groups.size === 0) {
      groups.set(file.name, [file]);
      continue;
    }

    const groupKeys = Array.from(groups.keys());
    const normalizedGroupKeys = groupKeys.map(normalize);
    
    const { bestMatch, bestMatchIndex } = findBestMatch(normalizedName, normalizedGroupKeys);

    if (bestMatch.rating > 0.6) { // Similarity threshold
      const bestGroupKey = groupKeys[bestMatchIndex];
      groups.get(bestGroupKey)?.push(file);
    } else {
      groups.set(file.name, [file]);
    }
  }

  // Calculate authenticity
  const authenticityScores = new Map<string, number>();
  for (const [groupName, filesInGroup] of groups.entries()) {
    if (filesInGroup.length <= 1) {
      authenticityScores.set(groupName, 100);
      continue;
    }
    const ratings = filesInGroup.map(file => 
      compareTwoStrings(normalize(groupName), normalize(file.name))
    );
    const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    authenticityScores.set(groupName, Math.round(averageRating * 100));
  }

  // Convert Maps to objects for JSON response
  const groupedFilesObj = Object.fromEntries(groups);
  const authenticityScoresObj = Object.fromEntries(authenticityScores);

  res.json({ groupedFiles: groupedFilesObj, authenticityScores: authenticityScoresObj });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
