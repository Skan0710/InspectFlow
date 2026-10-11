import type { ClusteringEngine } from './types.js';

// Common English stopwords to ignore in semantic vectorization
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'arent', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
  'by', 'can', 'cant', 'cannot', 'could', 'couldnt', 'did', 'didn', 'didnt', 'do', 'does', 'doesn',
  'doesnt', 'doing', 'don', 'dont', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
  'hadn', 'hadnt', 'has', 'hasn', 'hasnt', 'have', 'haven', 'havent', 'having', 'he', 'her', 'here',
  'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'isnt',
  'it', 'its', 'itself', 'just', 'll', 'm', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not',
  'now', 'o', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out',
  'over', 'own', 're', 's', 'same', 'she', 'should', 'shouldnt', 'so', 'some', 'such', 't', 'than',
  'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 've', 'very', 'was', 'wasn', 'wasnt', 'we',
  'were', 'weren', 'werent', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will',
  'with', 'won', 'wont', 'would', 'wouldnt', 'y', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Standard English stemmer to reduce plurals and past/continuous tenses
 * (e.g. "settings" & "setting" -> "sett", "crashes" & "crash" -> "crash")
 */
export function stemWord(word: string): string {
  let w = word.toLowerCase().trim();
  if (w.length <= 3) return w;

  // 1. Plural stripping
  if (w.endsWith('ies') && w.length > 4) {
    w = w.slice(0, -3) + 'y';
  } else if (w.endsWith('es') && w.length > 4) {
    w = w.slice(0, -2);
  } else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) {
    w = w.slice(0, -1);
  }

  // 2. Tense stripping
  if (w.endsWith('ing') && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith('ed') && w.length > 4) {
    w = w.slice(0, -2);
  }

  return w;
}

export interface DocumentTokens {
  unigrams: string[];
  bigrams: string[];
}

/**
 * Tokenizes and normalizes text into unigrams and bigrams, filtering stopwords.
 */
export function extractTerms(text: string): DocumentTokens {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return { unigrams: [], bigrams: [] };

  const rawTokens = cleaned.split(' ').filter((t) => t.length > 1);
  const filteredTokens = rawTokens.filter((t) => !STOPWORDS.has(t));

  const unigrams: string[] = [];
  const bigrams: string[] = [];

  // Add stemmed informative unigrams
  for (const token of filteredTokens) {
    if (token.length >= 3) {
      unigrams.push(stemWord(token));
    }
  }

  // Add content bigrams from adjacent filtered tokens
  for (let i = 0; i < filteredTokens.length - 1; i++) {
    const t1 = stemWord(filteredTokens[i]);
    const t2 = stemWord(filteredTokens[i + 1]);
    if (t1.length >= 3 && t2.length >= 3) {
      bigrams.push(`${t1}_${t2}`);
    }
  }

  return { unigrams, bigrams };
}

/**
 * High-performance TF-IDF + Cosine Similarity Vector Engine
 */
export class TfidfVectorEngine implements ClusteringEngine {
  public readonly name = 'tfidf_ngram_vector_engine';

  /**
   * Computes an N x N cosine similarity matrix for the provided text items.
   */
  public async computeSimilarities(items: { id: string; text: string }[]): Promise<number[][]> {
    const n = items.length;
    if (n === 0) return [];
    if (n === 1) return [[1.0]];

    // 1. Extract terms for each document
    const docTokensList = items.map((item) => extractTerms(item.text));

    // 2. Build vocabulary and Document Frequency (DF) for unigrams
    const docFreq: Map<string, number> = new Map();
    for (const { unigrams } of docTokensList) {
      const uniqueInDoc = new Set(unigrams);
      for (const term of uniqueInDoc) {
        docFreq.set(term, (docFreq.get(term) || 0) + 1);
      }
    }

    const vocabulary: string[] = Array.from(docFreq.keys());
    const vocabIndex: Map<string, number> = new Map();
    vocabulary.forEach((term, idx) => vocabIndex.set(term, idx));

    const numDocs = n;
    // Smoothed IDF
    const idfValues: number[] = vocabulary.map((term) => {
      const df = docFreq.get(term) || 1;
      return Math.log((numDocs + 1) / (df + 0.5)) + 1.0;
    });

    // 3. Compute TF-IDF unigram sparse vectors
    const vectors: Map<number, number>[] = [];
    const norms: number[] = [];

    for (let i = 0; i < n; i++) {
      const { unigrams } = docTokensList[i];
      const tfMap: Map<number, number> = new Map();

      for (const term of unigrams) {
        const vIdx = vocabIndex.get(term);
        if (vIdx !== undefined) {
          tfMap.set(vIdx, (tfMap.get(vIdx) || 0) + 1);
        }
      }

      const vector: Map<number, number> = new Map();
      let sumSq = 0;

      for (const [vIdx, count] of tfMap.entries()) {
        const tf = Math.log(count + 1.0);
        const weight = tf * idfValues[vIdx];
        vector.set(vIdx, weight);
        sumSq += weight * weight;
      }

      const norm = Math.sqrt(sumSq);
      norms.push(norm);

      if (norm > 0) {
        for (const [vIdx, weight] of vector.entries()) {
          vector.set(vIdx, weight / norm);
        }
      }

      vectors.push(vector);
    }

    // 4. Compute symmetric similarity matrix combining unigram cosine with bigram phrase boost
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      const vecA = vectors[i];
      const bigramsA = new Set(docTokensList[i].bigrams);

      for (let j = i + 1; j < n; j++) {
        const vecB = vectors[j];
        if (norms[i] === 0 || norms[j] === 0) {
          matrix[i][j] = 0.0;
          matrix[j][i] = 0.0;
          continue;
        }

        // Dot product between normalized unigram vectors
        let dot = 0.0;
        const [smaller, larger] = vecA.size <= vecB.size ? [vecA, vecB] : [vecB, vecA];
        for (const [k, valA] of smaller.entries()) {
          const valB = larger.get(k);
          if (valB !== undefined) {
            dot += valA * valB;
          }
        }

        // Bigram phrase overlap bonus
        let matchingBigrams = 0;
        for (const bg of docTokensList[j].bigrams) {
          if (bigramsA.has(bg)) {
            matchingBigrams++;
          }
        }
        const phraseBonus = matchingBigrams > 0 ? Math.min(0.25, matchingBigrams * 0.15) : 0;

        // Combined similarity
        const combined = Math.max(0.0, Math.min(1.0, dot + phraseBonus));
        matrix[i][j] = combined;
        matrix[j][i] = combined;
      }
    }

    return matrix;
  }
}

/**
 * Extracts salient key phrases and titles from a collection of cluster texts.
 */
export function extractClusterSalientPhrases(texts: string[], maxPhrases = 3): string[] {
  if (texts.length === 0) return ['General Feedback'];

  const phraseScores: Map<string, number> = new Map();

  for (const text of texts) {
    const { unigrams, bigrams } = extractTerms(text);
    for (const bg of bigrams) {
      const readable = bg.replace(/_/g, ' ');
      phraseScores.set(readable, (phraseScores.get(readable) || 0) + 3.0);
    }
    for (const uni of unigrams) {
      if (uni.length >= 4) {
        phraseScores.set(uni, (phraseScores.get(uni) || 0) + 1.0);
      }
    }
  }

  const sorted = Array.from(phraseScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPhrases)
    .map(([phrase]) => phrase);

  return sorted.length > 0 ? sorted : ['Feedback Topic'];
}

/**
 * Generates a concise human-readable title for a cluster of reviews.
 */
export function formatClusterTitle(
  category: string,
  keyPhrases: string[],
  primaryTopics?: string[]
): string {
  // If primary topics exist from AI analysis, use the most frequent concise topic
  if (primaryTopics && primaryTopics.length > 0) {
    const topicCounts: Map<string, number> = new Map();
    for (const t of primaryTopics) {
      if (t && t.trim()) {
        const clean = t.trim();
        topicCounts.set(clean, (topicCounts.get(clean) || 0) + 1);
      }
    }
    const sorted = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0]) {
      return capitalizeWords(sorted[0][0]);
    }
  }

  // Otherwise, construct title from salient key phrases
  if (keyPhrases.length > 0) {
    const top = keyPhrases[0];
    const second = keyPhrases[1];
    if (second && !second.includes(top) && !top.includes(second)) {
      return capitalizeWords(`${top} & ${second}`);
    }
    return capitalizeWords(top);
  }

  return `${category} Issue`;
}

function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}
