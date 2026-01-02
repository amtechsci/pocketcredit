/**
 * Name Comparison Utility
 * Compares two names and returns a similarity percentage
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Normalize name for comparison
 * - Convert to lowercase
 * - Remove extra spaces
 * - Remove special characters except spaces
 * - Sort words alphabetically (to handle different word orders)
 * @param {string} name - Name to normalize
 * @returns {string} Normalized name
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  
  // Convert to lowercase and remove extra spaces
  let normalized = name.toLowerCase().trim();
  
  // Remove special characters except spaces
  normalized = normalized.replace(/[^a-z\s]/g, '');
  
  // Replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Split into words, sort, and rejoin
  // This helps match "John Doe" with "Doe John"
  const words = normalized.split(' ').filter(w => w.length > 0);
  words.sort();
  
  return words.join(' ');
}

/**
 * Calculate name similarity percentage using multiple methods
 * @param {string} name1 - First name (e.g., from Aadhaar)
 * @param {string} name2 - Second name (e.g., from PAN)
 * @returns {Object} { percentage: number, details: Object }
 */
function compareNames(name1, name2) {
  if (!name1 || !name2) {
    return { percentage: 0, details: { error: 'One or both names are empty' } };
  }

  // Normalize both names
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  if (!norm1 || !norm2) {
    return { percentage: 0, details: { error: 'Names could not be normalized' } };
  }

  // Method 1: Exact match after normalization
  if (norm1 === norm2) {
    return {
      percentage: 100,
      details: {
        method: 'exact_match',
        normalized1: norm1,
        normalized2: norm2
      }
    };
  }

  // Method 2: Levenshtein distance similarity
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  const levenshteinSimilarity = ((maxLength - distance) / maxLength) * 100;

  // Method 3: Word-level matching (partial match)
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  
  let matchedWords = 0;
  const usedWords = new Set();
  
  for (const word1 of words1) {
    for (let i = 0; i < words2.length; i++) {
      const word2 = words2[i];
      if (usedWords.has(i)) continue;
      
      // Exact word match or very similar (allow 1 char difference for short words)
      if (word1 === word2 || 
          (word1.length > 3 && word2.length > 3 && levenshteinDistance(word1, word2) <= 1)) {
        matchedWords++;
        usedWords.add(i);
        break;
      }
    }
  }
  
  const totalWords = Math.max(words1.length, words2.length);
  const wordMatchPercentage = (matchedWords / totalWords) * 100;

  // Final similarity: weighted average of both methods
  // Give more weight to word matching as it's more reliable for names
  const finalPercentage = Math.round((levenshteinSimilarity * 0.4) + (wordMatchPercentage * 0.6));

  return {
    percentage: finalPercentage,
    details: {
      original1: name1,
      original2: name2,
      normalized1: norm1,
      normalized2: norm2,
      levenshteinSimilarity: Math.round(levenshteinSimilarity),
      wordMatchPercentage: Math.round(wordMatchPercentage),
      matchedWords: matchedWords,
      totalWords: totalWords
    }
  };
}

module.exports = {
  compareNames,
  normalizeName
};


