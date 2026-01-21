import { mergePreprocessingConfig, validatePreprocessingConfig } from './core/config.js';
import { preprocessorRegistry, ContentTypeDetector } from './preprocessors/index.js';
/**
 * Main preprocessing function that processes document content based on configuration
 * @param content - Raw document content to preprocess
 * @param filePath - Path to the file being processed (for content type detection)
 * @param config - Preprocessing configuration
 * @returns Processed content string
 */
export function preprocessDocument(content, filePath, config) {
    try {
        // Validate configuration
        validatePreprocessingConfig(config);
        // Resolve mode configuration with overrides
        const resolvedConfig = mergePreprocessingConfig(config);
        // Detect content type from file path
        const contentType = detectContentType(content, filePath);
        // Early return if no preprocessing needed
        if (!needsPreprocessing(content, contentType)) {
            return content;
        }
        // Process content based on detected type
        let processedContent = content;
        try {
            processedContent = processContentByType(content, contentType, resolvedConfig);
        }
        catch (error) {
            // Fallback handling for processing failures
            console.error(`Preprocessing failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
            processedContent = handleProcessingFailure(content, contentType);
        }
        // Ensure processed content is never empty
        if (!processedContent || processedContent.trim().length === 0) {
            console.log(`Warning: Preprocessing resulted in empty content for ${filePath}, using fallback`);
            processedContent = '[content processed but empty]';
        }
        return processedContent;
    }
    catch (error) {
        // Configuration or other critical errors - use fallback
        console.error(`Critical preprocessing error for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        return handleCriticalFailure(content);
    }
}
/**
 * Detect content type from file path and content analysis
 */
function detectContentType(content, filePath) {
    // First try file extension detection
    const extensionType = ContentTypeDetector.detectFromExtension(filePath);
    if (extensionType) {
        return extensionType;
    }
    // Fallback to content analysis
    if (ContentTypeDetector.hasJsxContent(content)) {
        return 'mdx';
    }
    if (ContentTypeDetector.hasMermaidContent(content)) {
        return 'mermaid';
    }
    // Default to markdown for unknown types
    return 'markdown';
}
/**
 * Check if content needs preprocessing based on type and content analysis
 */
function needsPreprocessing(content, contentType) {
    // Always preprocess MDX files
    if (contentType === 'mdx') {
        return true;
    }
    // Check for Mermaid diagrams in any markdown content
    if (ContentTypeDetector.hasMermaidContent(content)) {
        return true;
    }
    // Check for JSX content in markdown files
    if (contentType === 'markdown' && ContentTypeDetector.hasJsxContent(content)) {
        return true;
    }
    // Check for code blocks that might need processing
    if (content.includes('```')) {
        return true;
    }
    return false;
}
/**
 * Process content based on detected content type and configuration
 */
function processContentByType(content, contentType, resolvedConfig) {
    let processedContent = content;
    // Process MDX content if present
    if (contentType === 'mdx' || ContentTypeDetector.hasJsxContent(content)) {
        processedContent = processWithPreprocessor(processedContent, 'mdx', { mode: resolvedConfig.mdx });
    }
    // Process Mermaid diagrams if present (check original content, not processed)
    if (ContentTypeDetector.hasMermaidContent(content)) {
        processedContent = processWithPreprocessor(processedContent, 'mermaid', { mode: resolvedConfig.mermaid });
    }
    // Process code blocks if present and not already handled by MDX processor
    if (processedContent.includes('```')) {
        processedContent = processCodeBlocks(processedContent, resolvedConfig.code);
    }
    return processedContent;
}
/**
 * Process content with a specific preprocessor
 */
function processWithPreprocessor(content, preprocessorName, options) {
    const preprocessor = preprocessorRegistry.get(preprocessorName);
    if (!preprocessor) {
        console.log(`Unknown preprocessor: ${preprocessorName}, using fallback`);
        return handleUnknownContentType(content, preprocessorName);
    }
    try {
        // Call the preprocessor directly - it will check if it needs to process the content
        return preprocessor.process(content, options);
    }
    catch (error) {
        console.error(`Preprocessor ${preprocessorName} failed: ${error instanceof Error ? error.message : String(error)}`);
        return handleUnknownContentType(content, preprocessorName);
    }
}
/**
 * Process code blocks based on configuration
 */
function processCodeBlocks(content, mode) {
    if (mode === 'keep') {
        return content;
    }
    // Find all code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    if (mode === 'strip') {
        return content.replace(codeBlockRegex, '');
    }
    if (mode === 'placeholder') {
        return content.replace(codeBlockRegex, (match) => {
            const language = ContentTypeDetector.extractCodeFenceLanguage(match);
            return language ? `[${language} code block removed]` : '[code block removed]';
        });
    }
    return content;
}
/**
 * Handle unknown content types with fallback
 */
function handleUnknownContentType(content, contentType) {
    console.log(`Unknown content type detected: ${contentType}, using fallback`);
    return '[content removed]';
}
/**
 * Handle processing failures with graceful fallback
 */
function handleProcessingFailure(content, contentType) {
    console.log(`Processing failed for content type: ${contentType}, using placeholder`);
    // Try to preserve basic structure while removing problematic content
    switch (contentType) {
        case 'mdx':
            return '[MDX content removed due to processing error]';
        case 'mermaid':
            return '[diagram removed due to processing error]';
        default:
            return '[content removed due to processing error]';
    }
}
/**
 * Handle critical failures that prevent any processing
 */
function handleCriticalFailure(content) {
    console.error('Critical preprocessing failure, returning minimal fallback');
    // For plain content without problematic syntax, return as-is
    if (!content.includes('<') && !content.includes('```') &&
        !content.includes('import ') && !content.includes('export ')) {
        return content;
    }
    // Return a safe fallback that preserves some content structure
    const lines = content.split('\n');
    const safeLines = lines.filter(line => {
        // Keep lines that look like plain text or basic markdown
        return line.trim().length > 0 &&
            !line.includes('<') &&
            !line.includes('```') &&
            !line.startsWith('import ') &&
            !line.startsWith('export ');
    });
    if (safeLines.length > 0) {
        return safeLines.join('\n');
    }
    return '[content could not be processed safely]';
}
/**
 * Utility function to get preprocessing statistics for debugging
 */
export function getPreprocessingStats(originalContent, processedContent) {
    const originalLines = originalContent.split('\n').length;
    const processedLines = processedContent.split('\n').length;
    return {
        originalLength: originalContent.length,
        processedLength: processedContent.length,
        reductionRatio: processedContent.length / originalContent.length,
        linesRemoved: originalLines - processedLines
    };
}
