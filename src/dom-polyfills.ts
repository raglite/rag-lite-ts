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

  // Note: Do NOT polyfill createImageBitmap with a fake implementation
  // RawImage.fromURL() will handle image loading correctly without it
  // Setting a fake createImageBitmap that throws errors breaks image loading
}

export {}; // Make this a module