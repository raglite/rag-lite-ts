/**
 * Registry for managing preprocessors and content type detection
 */
export class PreprocessorRegistry {
    preprocessors = new Map();
    /**
     * Register a preprocessor with a given name
     */
    register(name, preprocessor) {
        this.preprocessors.set(name, preprocessor);
    }
    /**
     * Get a specific preprocessor by name
     */
    get(name) {
        return this.preprocessors.get(name);
    }
    /**
     * Get all preprocessors that apply to the given language/content type
     */
    getApplicable(language) {
        const applicable = [];
        for (const preprocessor of this.preprocessors.values()) {
            if (preprocessor.appliesTo(language)) {
                applicable.push(preprocessor);
            }
        }
        return applicable;
    }
    /**
     * Get all registered preprocessor names
     */
    getRegisteredNames() {
        return Array.from(this.preprocessors.keys());
    }
    /**
     * Validate that all required preprocessors are available
     */
    validatePreprocessors(requiredNames) {
        const missing = requiredNames.filter(name => !this.preprocessors.has(name));
        return {
            valid: missing.length === 0,
            missing
        };
    }
}
/**
 * Content type detection utilities
 */
export class ContentTypeDetector {
    /**
     * Detect content type from file extension
     */
    static detectFromExtension(filePath) {
        const extension = filePath.toLowerCase().split('.').pop();
        switch (extension) {
            case 'mdx':
                return 'mdx';
            case 'md':
                return 'markdown';
            case 'js':
            case 'jsx':
                return 'javascript';
            case 'ts':
            case 'tsx':
                return 'typescript';
            case 'py':
                return 'python';
            case 'java':
                return 'java';
            case 'cpp':
            case 'cc':
            case 'cxx':
                return 'cpp';
            case 'c':
                return 'c';
            case 'cs':
                return 'csharp';
            case 'php':
                return 'php';
            case 'rb':
                return 'ruby';
            case 'go':
                return 'go';
            case 'rs':
                return 'rust';
            case 'swift':
                return 'swift';
            case 'kt':
                return 'kotlin';
            case 'scala':
                return 'scala';
            case 'sh':
            case 'bash':
                return 'bash';
            case 'ps1':
                return 'powershell';
            case 'sql':
                return 'sql';
            case 'html':
                return 'html';
            case 'css':
                return 'css';
            case 'json':
                return 'json';
            case 'xml':
                return 'xml';
            case 'yaml':
            case 'yml':
                return 'yaml';
            default:
                return null;
        }
    }
    /**
     * Detect content type from code fence language identifier
     */
    static detectFromCodeFence(language) {
        // Normalize language identifier
        const normalized = language.toLowerCase().trim();
        // Handle common aliases
        switch (normalized) {
            case 'js':
                return 'javascript';
            case 'ts':
                return 'typescript';
            case 'py':
                return 'python';
            case 'sh':
            case 'shell':
                return 'bash';
            case 'yml':
                return 'yaml';
            default:
                return normalized;
        }
    }
    /**
     * Detect JSX content in text
     */
    static hasJsxContent(content) {
        // Look for JSX patterns: <Component>, <div className=, etc.
        const jsxPatterns = [
            /<[A-Z][a-zA-Z0-9]*(?:\s[^>]*)?\/?>/, // Component tags
            /<[a-z]+\s+className=/, // className attribute
            /\{[^}]*\}/, // JSX expressions
            /import\s+.*\s+from\s+['"][^'"]*['"]/, // ES6 imports
            /export\s+(default\s+)?/ // ES6 exports
        ];
        return jsxPatterns.some(pattern => pattern.test(content));
    }
    /**
     * Detect Mermaid diagram content
     */
    static hasMermaidContent(content) {
        // Look for mermaid code blocks or mermaid keywords
        const mermaidPatterns = [
            /```mermaid/i,
            /graph\s+(TD|TB|BT|RL|LR)/i,
            /flowchart\s+(TD|TB|BT|RL|LR)/i,
            /sequenceDiagram/i,
            /classDiagram/i,
            /stateDiagram/i,
            /erDiagram/i,
            /journey/i,
            /gantt/i,
            /pie\s+title/i
        ];
        return mermaidPatterns.some(pattern => pattern.test(content));
    }
    /**
     * Extract code fence language from a code block
     */
    static extractCodeFenceLanguage(codeBlock) {
        const match = codeBlock.match(/^```(\w+)/);
        return match ? this.detectFromCodeFence(match[1]) : null;
    }
}
