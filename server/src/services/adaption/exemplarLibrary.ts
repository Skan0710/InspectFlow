import type { AdaptionPromptPair, AdaptionRunRecord, ExemplarLibraryMetadata } from './types.js';
import { DatasetPreparer } from './datasetPreparer.js';

export class ExemplarLibrary {
  private static instance: ExemplarLibrary | null = null;
  private preparer: DatasetPreparer;
  private exemplars: AdaptionPromptPair[] = [];
  private version: string = 'v1.0.0-uninitialized';
  private isEnabled: boolean = true;
  private lastUpdated: string = new Date().toISOString();

  public constructor() {
    this.preparer = new DatasetPreparer();
  }

  public static getInstance(): ExemplarLibrary {
    if (!ExemplarLibrary.instance) {
      ExemplarLibrary.instance = new ExemplarLibrary();
    }
    return ExemplarLibrary.instance;
  }

  /**
   * Refreshes the exemplar library from completed Adaption runs.
   * Only includes validated, high-quality prompt-completion pairs.
   */
  public syncFromRuns(runs: AdaptionRunRecord[]): number {
    const successfulRuns = runs.filter(
      (r) => r.status === 'succeeded' && Array.isArray(r.samplePairs) && r.samplePairs.length > 0
    );

    const candidates: AdaptionPromptPair[] = [];
    let latestRunVersion = 'v1.0.0-baseline';

    for (const run of successfulRuns) {
      if (run.datasetVersion) {
        latestRunVersion = run.datasetVersion;
      }
      for (const pair of run.samplePairs) {
        candidates.push(pair);
      }
    }

    // Validate candidates before allowing them into the exemplar library
    const validation = this.preparer.validateAdaptedOutput(candidates);
    const approved = validation.validatedPairs;

    // Deduplicate by category so the model gets diverse domain exemplars
    const distinctByCategory: AdaptionPromptPair[] = [];
    const seenCategories = new Set<string>();

    for (const pair of approved) {
      const cat = pair.category || 'General Feedback';
      if (!seenCategories.has(cat)) {
        distinctByCategory.push(pair);
        seenCategories.add(cat);
      }
    }

    this.exemplars = distinctByCategory;
    this.version = `exemplars-${latestRunVersion}`;
    this.lastUpdated = new Date().toISOString();

    return this.exemplars.length;
  }

  /**
   * Directly sets approved exemplars (e.g. for testing or curated sets).
   */
  public setApprovedExemplars(exemplars: AdaptionPromptPair[], version?: string): void {
    const validation = this.preparer.validateAdaptedOutput(exemplars);
    this.exemplars = validation.validatedPairs;
    this.version = version || `exemplars-v1.0.0-${new Date().toISOString().slice(0, 10)}`;
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Returns approved exemplars for prompting.
   * Returns empty array if disabled or unpopulated, which triggers baseline zero-shot fallback.
   */
  public getApprovedExemplars(categoryHint?: string): AdaptionPromptPair[] {
    if (!this.isEnabled || this.exemplars.length === 0) {
      return [];
    }

    if (categoryHint) {
      const matching = this.exemplars.filter(
        (e) => e.category.toLowerCase() === categoryHint.toLowerCase()
      );
      if (matching.length > 0) {
        return matching;
      }
    }

    return this.exemplars;
  }

  public getVersion(): string {
    return this.version;
  }

  public getMetadata(): ExemplarLibraryMetadata {
    const categories = Array.from(new Set(this.exemplars.map((e) => e.category)));
    return {
      version: this.version,
      count: this.exemplars.length,
      categories,
      lastUpdated: this.lastUpdated,
      isEnabled: this.isEnabled,
    };
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public clear(): void {
    this.exemplars = [];
    this.version = 'v1.0.0-empty';
    this.lastUpdated = new Date().toISOString();
  }
}
