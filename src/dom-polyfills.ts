/**
 * DOM polyfills for Node.js environment
 * Required for transformers.js and other browser-dependent libraries
 */

import { JSDOM } from 'jsdom';

// Only set up polyfills if we're in Node.js (not browser)
if (typeof window === 'undefined') {
  console.log('Setting up DOM polyfills for Node.js environment...');
  // Create a minimal DOM environment
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    pretendToBeVisual: true,
    resources: 'usable'
  });

  // Set up global objects that transformers.js expects
  if (typeof (globalThis as any).self === 'undefined') {
    (globalThis as any).self = globalThis;
  }
  
  // Also set on global for older Node.js versions
  if (typeof (global as any).self === 'undefined') {
    (global as any).self = global;
  }
  
  console.log('DOM polyfills set up successfully. self is now:', typeof self !== 'undefined' ? 'defined' : 'undefined');

  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = dom.window;
  }

  if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = dom.window.document;
  }

  // Additional polyfills that might be needed
  if (typeof (globalThis as any).navigator === 'undefined') {
    (globalThis as any).navigator = dom.window.navigator;
  }

  // Polyfill createImageBitmap if needed (for image processing)
  if (typeof (globalThis as any).createImageBitmap === 'undefined') {
    (globalThis as any).createImageBitmap = dom.window.createImageBitmap || (() => {
      throw new Error('createImageBitmap not available in Node.js environment');
    });
  }
}

export {}; // Make this a module