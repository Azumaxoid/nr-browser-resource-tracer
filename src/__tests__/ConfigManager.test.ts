import { ConfigManager } from '../ConfigManager';

describe('ConfigManager', () => {
  describe('constructor', () => {
    it('should use default values when no config is provided', () => {
      const manager = new ConfigManager();
      
      expect(manager.getLCPThreshold()).toBe(2500);
      expect(manager.getSamplingRate()).toBe(1.0);
      expect(manager.isDebugEnabled()).toBe(false);
      expect(manager.isEnabled()).toBe(true);
    });

    it('should use provided config values', () => {
      const config = {
        lcpThreshold: 3000,
        samplingRate: 0.5,
        debug: true,
        enabled: false
      };
      
      const manager = new ConfigManager(config);
      
      expect(manager.getLCPThreshold()).toBe(3000);
      expect(manager.getSamplingRate()).toBe(0.5);
      expect(manager.isDebugEnabled()).toBe(true);
      expect(manager.isEnabled()).toBe(false);
    });

    it('should handle partial config', () => {
      const config = {
        lcpThreshold: 1500,
        debug: true
      };
      
      const manager = new ConfigManager(config);
      
      expect(manager.getLCPThreshold()).toBe(1500);
      expect(manager.getSamplingRate()).toBe(1.0);
      expect(manager.isDebugEnabled()).toBe(true);
      expect(manager.isEnabled()).toBe(true);
    });

    it('should throw error for negative LCP threshold', () => {
      const config = {
        lcpThreshold: -100
      };
      
      expect(() => new ConfigManager(config)).toThrow('Invalid LCP threshold');
    });

    it('should use default sampling rate for invalid values', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const manager1 = new ConfigManager({ samplingRate: -0.5 });
      expect(manager1.getSamplingRate()).toBe(1.0);
      
      const manager2 = new ConfigManager({ samplingRate: 1.5 });
      expect(manager2.getSamplingRate()).toBe(1.0);
      
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });
  });

  describe('shouldSample', () => {
    it('should return false when disabled', () => {
      const manager = new ConfigManager({ enabled: false });
      expect(manager.shouldSample()).toBe(false);
    });

    it('should return true when sampling rate is 1.0', () => {
      const manager = new ConfigManager({ samplingRate: 1.0 });
      expect(manager.shouldSample()).toBe(true);
    });

    it('should return false when sampling rate is 0', () => {
      const manager = new ConfigManager({ samplingRate: 0 });
      expect(manager.shouldSample()).toBe(false);
    });

    it('should sample based on probability', () => {
      const manager = new ConfigManager({ samplingRate: 0.5 });
      
      const mathRandomSpy = jest.spyOn(Math, 'random');
      
      mathRandomSpy.mockReturnValue(0.3);
      expect(manager.shouldSample()).toBe(true);
      
      mathRandomSpy.mockReturnValue(0.7);
      expect(manager.shouldSample()).toBe(false);
      
      mathRandomSpy.mockRestore();
    });
  });

  describe('getConfig', () => {
    it('should return frozen config object', () => {
      const manager = new ConfigManager();
      const config = manager.getConfig();
      
      expect(Object.isFrozen(config)).toBe(true);
      expect(config).toEqual({
        lcpThreshold: 2500,
        samplingRate: 1.0,
        debug: false,
        enabled: true,
        maxResources: 10
      });
    });

    it('should return a copy of config', () => {
      const manager = new ConfigManager();
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});