/**
 * Performance Tracker Module
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 *
 * Handles performance tracking and timing for NetSuite operations
 */

define([], function () {
  /**
   * Performance tracker class
   */
  class PerformanceTracker {
    constructor(enabled) {
      this.enabled = enabled;
      this.startTime = enabled ? Date.now() : null;
      this.marks = {};
    }

    mark(name) {
      if (this.enabled) {
        this.marks[name] = Date.now() - this.startTime;
      }
    }

    getReport() {
      if (!this.enabled) return null;
      return {
        totalTime: Date.now() - this.startTime,
        marks: this.marks,
      };
    }
  }

  return {
    PerformanceTracker: PerformanceTracker,
  };
});
