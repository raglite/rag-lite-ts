import { ContentTypeDetector } from './registry.js';
/**
 * MDX preprocessor for handling JSX content in Markdown files
 * Ports the existing cleanMdxContent logic with mode-aware behavior
 */
export class MdxPreprocessor {
    /**
     * Check if this preprocessor applies to the given language/content type
     * Applies to .mdx files and content with JSX syntax
     */
    appliesTo(language) {
        return language === 'mdx';
    }
    /**
     * Process MDX content based on the specified mode
     */
    process(content, options) {
        // Only process if content actually contains JSX
        if (!ContentTypeDetector.hasJsxContent(content)) {
            return content;
        }
        switch (options.mode) {
            case 'strip':
                return this.stripJsx(content);
            case 'keep':
                return content; // Keep JSX as-is
            case 'placeholder':
                return this.replaceWithPlaceholders(content);
            default:
                console.log(`Unknown MDX processing mode: ${options.mode}, using placeholder`);
                return this.replaceWithPlaceholders(content);
        }
    }
    /**
     * Strip JSX content entirely - ported from cleanMdxContent logic
     */
    stripJsx(content) {
        let cleaned = content;
        // Remove JSX import statements (requirement 11.1)
        // Matches: import ... from '...' or import ... from "..."
        cleaned = cleaned.replace(/^import\s+.*?from\s+['"][^'"]*['"];?\s*$/gm, '');
        // Remove JSX export statements (requirement 11.2)  
        // Handle both single-line and multi-line exports
        // Multi-line function exports: export default function() { ... }
        cleaned = cleaned.replace(/^export\s+default\s+function[^{]*\{[\s\S]*?\n\}\s*$/gm, '');
        // Object exports: export const metadata = { ... }
        cleaned = cleaned.replace(/^export\s+const\s+[^=]*=\s*\{[\s\S]*?\}\s*;?\s*$/gm, '');
        // Single line exports: export const x = ...; or export default ...
        cleaned = cleaned.replace(/^export\s+(?:default\s+)?(?:const|let|var|function|class)\s+[^;{]*;?\s*$/gm, '');
        // Simple exports: export default Component
        cleaned = cleaned.replace(/^export\s+default\s+[^;{]*;?\s*$/gm, '');
        // Remove JSX components (requirements 11.3, 11.4)
        // Self-closing tags: <Component />
        cleaned = cleaned.replace(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g, '');
        // Opening and closing tags with content: <Component>content</Component>
        // This handles nested components by replacing the outermost ones first
        let previousLength;
        do {
            previousLength = cleaned.length;
            cleaned = cleaned.replace(/<[A-Z][a-zA-Z0-9]*[^>]*>.*?<\/[A-Z][a-zA-Z0-9]*>/gs, '');
        } while (cleaned.length !== previousLength);
        // Clean up multiple consecutive newlines and trim
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
        // Ensure we never return empty content (requirement 6.4)
        if (!cleaned.trim()) {
            return '[content removed]';
        }
        return cleaned;
    }
    /**
     * Replace JSX with descriptive placeholders
     */
    replaceWithPlaceholders(content) {
        let cleaned = content;
        // Replace JSX import statements
        cleaned = cleaned.replace(/^import\s+.*?from\s+['"][^'"]*['"];?\s*$/gm, '[import removed]');
        // Replace JSX export statements  
        // Multi-line function exports: export default function() { ... }
        cleaned = cleaned.replace(/^export\s+default\s+function[^{]*\{[\s\S]*?\n\}\s*$/gm, '[export removed]');
        // Object exports: export const metadata = { ... }
        cleaned = cleaned.replace(/^export\s+const\s+[^=]*=\s*\{[\s\S]*?\}\s*;?\s*$/gm, '[export removed]');
        // Single line exports: export const x = ...; or export default ...
        cleaned = cleaned.replace(/^export\s+(?:default\s+)?(?:const|let|var|function|class)\s+[^;{]*;?\s*$/gm, '[export removed]');
        // Simple exports: export default Component
        cleaned = cleaned.replace(/^export\s+default\s+[^;{]*;?\s*$/gm, '[export removed]');
        // Replace JSX components with placeholder
        // Self-closing tags: <Component />
        cleaned = cleaned.replace(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g, '[component removed]');
        // Opening and closing tags with content: <Component>content</Component>
        // This handles nested components by replacing the outermost ones first
        let previousLength;
        do {
            previousLength = cleaned.length;
            cleaned = cleaned.replace(/<[A-Z][a-zA-Z0-9]*[^>]*>.*?<\/[A-Z][a-zA-Z0-9]*>/gs, '[component removed]');
        } while (cleaned.length !== previousLength);
        // Clean up multiple consecutive newlines and trim
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
        return cleaned;
    }
}
