/**
 * @file Defines a generic class for performing fuzzy searches on an array of objects.
 */

/**
 * Options for configuring the FuzzyHaystackSearcher.
 * @template T The type of objects in the array to be searched.
 */
export interface FuzzyHaystackSearcherOptions<T> {
  /** 
   * An array of keys (property names) within each object of type T 
   * that should be searched. The values associated with these keys must be strings.
   */
  keys: (keyof T)[];
  /**
   * A ratio (0.0 to 1.0) to determine the match sensitivity.
   * A lower value means a stricter match. The actual threshold is calculated as:
   * Levenshtein distance <= thresholdRatio * Math.max(query.length, stringValue.length).
   * Defaults to 0.4.
   */
  thresholdRatio?: number;
  /**
   * Whether the search should be case-sensitive.
   * Defaults to false.
   */
  caseSensitive?: boolean;
}

/**
 * A generic class for performing fuzzy searches on an array of objects (the "haystack")
 * using the Levenshtein distance algorithm.
 *
 * @template T The type of objects in the array to be searched. Must be an object type.
 */
export class FuzzyHaystackSearcher<T extends object> {
  private readonly items: T[];
  private readonly options: Required<FuzzyHaystackSearcherOptions<T>>;

  /**
   * Creates an instance of FuzzyHaystackSearcher.
   * @param {T[]} items The array of items (haystack) to search through.
   * @param {FuzzyHaystackSearcherOptions<T>} options Configuration options, including the 'keys' to search by.
   */
  constructor(items: T[], options: FuzzyHaystackSearcherOptions<T>) {
    this.items = items;
    this.options = {
      thresholdRatio: 0.4,
      caseSensitive: false,
      ...options,
    };
  }

  /**
   * Calculates the Levenshtein distance between two strings.
   * @param {string} s1 The first string.
   * @param {string} s2 The second string.
   * @returns {number} The Levenshtein distance.
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i: number = 0; i <= m; i++) {
      dp[i][0] = i;
    }
    for (let j: number = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    for (let i: number = 1; i <= m; i++) {
      for (let j: number = 1; j <= n; j++) {
        const cost: number = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // Deletion
          dp[i][j - 1] + 1,      // Insertion
          dp[i - 1][j - 1] + cost // Substitution or match
        );
      }
    }
    return dp[m][n];
  }

  /**
   * Searches the items for a given needle (query string).
   * @param {string} query The string to search for.
   * @returns {T[]} An array of items that match the query, sorted by relevance (best match first).
   *                Returns all items if the query is empty.
   */
  public search(query: string): T[] {
    if (!query) {
      return [...this.items]; // Return a copy of all items if query is empty
    }

    const normalizedQuery: string = this.options.caseSensitive ? query : query.toLowerCase();
    const results: { item: T; score: number }[] = [];

    for (const item of this.items) {
      let bestScoreForItem: number = Infinity;

      for (const key of this.options.keys) {
        const value: unknown = item[key];
        if (typeof value === 'string') {
          const normalizedValue: string = this.options.caseSensitive ? value : value.toLowerCase();
          if (normalizedValue.length === 0 && normalizedQuery.length === 0) {
            if (0 < bestScoreForItem) {
              bestScoreForItem = 0;
            }
            continue;
          }
          if (normalizedValue.length === 0 && normalizedQuery.length > 0) {
            // Avoid division by zero if normalizedValue is empty but query is not
            // The distance will be normalizedQuery.length. This case is handled by the general logic.
          }

          const distance: number = this.levenshteinDistance(normalizedQuery, normalizedValue);
          const maxLength: number = Math.max(normalizedQuery.length, normalizedValue.length);
          
          // If maxLength is 0, it means both query and value are empty, distance is 0.
          // This is a perfect match if thresholdRatio allows (e.g. >= 0).
          if (maxLength === 0) { 
            if (distance === 0 && 0 <= this.options.thresholdRatio) {
              if (distance < bestScoreForItem) {
                bestScoreForItem = distance;
              }
            }
            continue;
          }

          const currentRatio: number = distance / maxLength;
          if (currentRatio <= this.options.thresholdRatio) {
            if (distance < bestScoreForItem) {
              bestScoreForItem = distance;
            }
          }
        }
      }

      if (bestScoreForItem !== Infinity) {
        results.push({ item, score: bestScoreForItem });
      }
    }

    results.sort((a, b) => a.score - b.score);
    return results.map(r => r.item);
  }
}
