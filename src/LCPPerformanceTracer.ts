import { LCPTracerConfig, LCPEntry, TraceData } from './types';
import { ConfigManager } from './ConfigManager';
import { LCPMonitor } from './LCPMonitor';
import { ResourceCollector } from './ResourceCollector';
import { NewRelicReporter } from './NewRelicReporter';

export class LCPPerformanceTracer {
  private configManager: ConfigManager;
  private lcpMonitor: LCPMonitor | null = null;
  private resourceCollector: ResourceCollector;
  private newRelicReporter: NewRelicReporter;
  private isRunning = false;

  constructor(config?: LCPTracerConfig) {
    this.configManager = new ConfigManager(config);
    this.resourceCollector = new ResourceCollector(this.configManager.getMaxResources());
    this.newRelicReporter = new NewRelicReporter(this.configManager.isDebugEnabled());
    
    if (this.configManager.isDebugEnabled()) {
      console.log('LCPPerformanceTracer initialized with config:', this.configManager.getConfig());
    }
  }

  public start(): void {
    if (this.isRunning) {
      if (this.configManager.isDebugEnabled()) {
        console.log('LCPPerformanceTracer is already running');
      }
      return;
    }

    if (!this.configManager.isEnabled()) {
      if (this.configManager.isDebugEnabled()) {
        console.log('LCPPerformanceTracer is disabled');
      }
      return;
    }

    if (!this.configManager.shouldSample()) {
      if (this.configManager.isDebugEnabled()) {
        console.log('LCPPerformanceTracer skipped due to sampling');
      }
      return;
    }

    this.isRunning = true;
    
    if (this.configManager.isDebugEnabled()) {
      console.log('Starting LCPPerformanceTracer');
    }

    this.lcpMonitor = new LCPMonitor(
      this.configManager.getLCPThreshold(),
      (lcpEntry) => this.handleLCPDetected(lcpEntry)
    );

    this.lcpMonitor.start();
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.configManager.isDebugEnabled()) {
      console.log('Stopping LCPPerformanceTracer');
    }

    if (this.lcpMonitor) {
      this.lcpMonitor.stop();
      this.lcpMonitor = null;
    }

    this.isRunning = false;
  }

  public isTracerRunning(): boolean {
    return this.isRunning;
  }

  public getConfig(): Readonly<Required<LCPTracerConfig>> {
    return this.configManager.getConfig();
  }

  private async handleLCPDetected(lcpEntry: LCPEntry): Promise<void> {
    try {
      if (this.configManager.isDebugEnabled()) {
        console.log('LCP threshold exceeded:', lcpEntry);
      }

      const navigationTiming = this.resourceCollector.collectNavigationTiming();
      const criticalResources = this.resourceCollector.collectCriticalResources(lcpEntry.element);

      const traceData: TraceData = {
        lcp: lcpEntry,
        resources: criticalResources,
        navigation: navigationTiming,
        userAgent: navigator.userAgent || '',
        url: window.location.href,
        timestamp: Date.now()
      };

      if (this.configManager.isDebugEnabled()) {
        console.log('Collected trace data:', traceData);
      }

      await this.newRelicReporter.sendTrace(traceData);

      if (this.configManager.isDebugEnabled()) {
        console.log('LCP trace sent successfully');
      }
    } catch (error) {
      console.error('Error handling LCP detection:', error);
    }
  }

  public static create(config?: LCPTracerConfig): LCPPerformanceTracer {
    return new LCPPerformanceTracer(config);
  }

  public static autoStart(config?: LCPTracerConfig): LCPPerformanceTracer {
    const tracer = new LCPPerformanceTracer(config);
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => tracer.start());
    } else {
      tracer.start();
    }

    return tracer;
  }
}