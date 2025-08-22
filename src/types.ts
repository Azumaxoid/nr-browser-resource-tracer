export interface LCPTracerConfig {
  lcpThreshold?: number;
  samplingRate?: number;
  debug?: boolean;
  enabled?: boolean;
  maxResources?: number;
}

export interface LCPEntry {
  value: number;
  element: Element | null;
  url: string;
  timestamp: number;
}

export interface ResourceTimingData {
  name: string;
  startTime: number;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  initiatorType: string;
}

export interface NavigationTimingData {
  domContentLoaded: number;
  loadComplete: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
}

export interface TraceData {
  lcp: LCPEntry;
  resources: ResourceTimingData[];
  navigation: NavigationTimingData;
  userAgent: string;
  url: string;
  timestamp: number;
}

export interface LCPTraceEvent {
  eventType: 'LCPPerformanceTrace';
  lcpValue: number;
  lcpElement: string;
  lcpUrl: string;
  domContentLoaded: number;
  loadComplete: number;
  firstContentfulPaint: number;
  criticalResources: Array<{
    name: string;
    duration: number;
    transferSize: number;
    initiatorType: string;
  }>;
  userAgent: string;
  url: string;
  timestamp: number;
  samplingRate: number;
}

export interface ErrorLog {
  level: 'warn' | 'error';
  message: string;
  error?: Error;
  context?: Record<string, unknown>;
}

export interface NewRelicGlobal {
  recordCustomEvent: (eventType: string, attributes: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    newrelic?: NewRelicGlobal;
  }
}