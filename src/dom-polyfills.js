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
    if (typeof globalThis.self === 'undefined') {
        globalThis.self = globalThis;
    }
    // Also set on global for older Node.js versions
    if (typeof global.self === 'undefined') {
        global.self = global;
    }
    console.log('DOM polyfills set up successfully. self is now:', typeof self !== 'undefined' ? 'defined' : 'undefined');
    if (typeof globalThis.window === 'undefined') {
        globalThis.window = dom.window;
    }
    if (typeof globalThis.document === 'undefined') {
        globalThis.document = dom.window.document;
    }
    // Additional polyfills that might be needed
    if (typeof globalThis.navigator === 'undefined') {
        globalThis.navigator = dom.window.navigator;
    }
    // Note: Do NOT polyfill createImageBitmap with a fake implementation
    // RawImage.fromURL() will handle image loading correctly without it
    // Setting a fake createImageBitmap that throws errors breaks image loading
}
