import { LCPTracerConfig } from './types';

export class ConfigManager {
  private readonly config: Required<LCPTracerConfig>;
  private static readonly DEFAULT_LCP_THRESHOLD = 2500;
  private static readonly DEFAULT_SAMPLING_RATE = 1.0;
  private static readonly DEFAULT_DEBUG = false;
  private static readonly DEFAULT_ENABLED = true;
  private static readonly DEFAULT_MAX_RESOURCES = 10;

  constructor(config?: LCPTracerConfig) {
    this.config = {
      lcpThreshold: config?.lcpThreshold ?? ConfigManager.DEFAULT_LCP_THRESHOLD,
      samplingRate: this.validateSamplingRate(config?.samplingRate),
      debug: config?.debug ?? ConfigManager.DEFAULT_DEBUG,
      enabled: config?.enabled ?? ConfigManager.DEFAULT_ENABLED,
      maxResources: this.validateMaxResources(config?.maxResources)
    };

    this.validateConfig();
  }

  private validateSamplingRate(rate?: number): number {
    if (rate === undefined) {
      return ConfigManager.DEFAULT_SAMPLING_RATE;
    }
    if (rate < 0 || rate > 1) {
      console.warn(`Invalid sampling rate: ${rate}. Must be between 0 and 1. Using default: ${ConfigManager.DEFAULT_SAMPLING_RATE}`);
      return ConfigManager.DEFAULT_SAMPLING_RATE;
    }
    return rate;
  }

  private validateMaxResources(maxResources?: number): number {
    if (maxResources === undefined) {
      return ConfigManager.DEFAULT_MAX_RESOURCES;
    }
    if (maxResources < 1 || maxResources > 100) {
      console.warn(`Invalid maxResources: ${maxResources}. Must be between 1 and 100. Using default: ${ConfigManager.DEFAULT_MAX_RESOURCES}`);
      return ConfigManager.DEFAULT_MAX_RESOURCES;
    }
    return maxResources;
  }

  private validateConfig(): void {
    if (this.config.lcpThreshold < 0) {
      throw new Error(`Invalid LCP threshold: ${this.config.lcpThreshold}. Must be non-negative.`);
    }
  }

  public getLCPThreshold(): number {
    return this.config.lcpThreshold;
  }

  public getSamplingRate(): number {
    return this.config.samplingRate;
  }

  public isDebugEnabled(): boolean {
    return this.config.debug;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public shouldSample(): boolean {
    if (!this.isEnabled()) {
      return false;
    }
    return Math.random() < this.config.samplingRate;
  }

  public getMaxResources(): number {
    return this.config.maxResources;
  }

  public getConfig(): Readonly<Required<LCPTracerConfig>> {
    return Object.freeze({ ...this.config });
  }
}