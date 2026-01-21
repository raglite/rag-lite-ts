/**
 * CORE MODULE — Model Validation and Compatibility System
 * Comprehensive validation system for transformers.js compatibility and model support
 * Provides detailed error messages and suggestions for unsupported models
 */
import { ModelRegistry, SUPPORTED_MODELS } from './model-registry.js';
// =============================================================================
// TRANSFORMERS.JS VERSION COMPATIBILITY MATRIX
// =============================================================================
/**
 * Compatibility matrix for different transformers.js versions
 */
export const TRANSFORMERS_COMPATIBILITY_MATRIX = {
    '2.6.0': {
        version: '2.6.0',
        supportedFeatures: ['tokenizers', 'text-generation', 'feature-extraction'],
        supportedModelTypes: ['sentence-transformer'],
        knownIssues: ['Limited CLIP support', 'No image processing']
    },
    '2.7.0': {
        version: '2.7.0',
        supportedFeatures: ['tokenizers', 'text-generation', 'feature-extraction', 'image-classification'],
        supportedModelTypes: ['sentence-transformer'],
        knownIssues: ['Experimental CLIP support']
    },
    '2.8.0': {
        version: '2.8.0',
        supportedFeatures: ['tokenizers', 'text-generation', 'feature-extraction', 'image-classification', 'vision'],
        supportedModelTypes: ['sentence-transformer', 'clip'],
        knownIssues: []
    },
    '2.9.0': {
        version: '2.9.0',
        supportedFeatures: ['tokenizers', 'text-generation', 'feature-extraction', 'image-classification', 'vision', 'zero-shot-image-classification'],
        supportedModelTypes: ['sentence-transformer', 'clip'],
        knownIssues: []
    },
    '3.0.0': {
        version: '3.0.0',
        supportedFeatures: ['tokenizers', 'text-generation', 'feature-extraction', 'image-classification', 'vision', 'zero-shot-image-classification', 'image-to-text'],
        supportedModelTypes: ['sentence-transformer', 'clip'],
        knownIssues: []
    }
};
// =============================================================================
// MODEL VALIDATOR CLASS
// =============================================================================
/**
 * Comprehensive model validator with transformers.js compatibility checking
 */
export class ModelValidator {
    static currentTransformersVersion = null;
    static systemCapabilities = null;
    /**
     * Set the current transformers.js version for compatibility checking
     * @param version - Current transformers.js version
     */
    static setTransformersVersion(version) {
        this.currentTransformersVersion = version;
    }
    /**
     * Set system capabilities for compatibility checking
     * @param capabilities - System capabilities
     */
    static setSystemCapabilities(capabilities) {
        this.systemCapabilities = capabilities;
    }
    /**
     * Get the current transformers.js version
     * @returns Current version or null if not set
     */
    static getTransformersVersion() {
        return this.currentTransformersVersion;
    }
    /**
     * Detect transformers.js version from the environment
     * @returns Promise resolving to the detected version or null
     */
    static async detectTransformersVersion() {
        try {
            // Try to import transformers and get version
            const transformers = await import('@huggingface/transformers');
            // Check if version is available in the package
            if ('version' in transformers && typeof transformers.version === 'string') {
                this.currentTransformersVersion = transformers.version;
                return transformers.version;
            }
            // Fallback: try to read from filesystem package.json
            try {
                const fs = await import('fs');
                const path = await import('path');
                // Try to find the package.json in node_modules
                const packageJsonPath = path.join(process.cwd(), 'node_modules', '@huggingface', 'transformers', 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    const packageContent = fs.readFileSync(packageJsonPath, 'utf-8');
                    const packageInfo = JSON.parse(packageContent);
                    if (packageInfo.version) {
                        this.currentTransformersVersion = packageInfo.version;
                        return packageInfo.version;
                    }
                }
            }
            catch {
                // Filesystem read failed, continue with other methods
            }
            // Fallback: try to detect from package.json import
            try {
                const packageInfo = await import('@huggingface/transformers/package.json' + '');
                if (packageInfo.version) {
                    this.currentTransformersVersion = packageInfo.version;
                    return packageInfo.version;
                }
            }
            catch {
                // Package.json import failed, continue with other methods
            }
            // If we can't detect the version, assume a recent version that should work
            console.warn('Could not detect transformers.js version, assuming 3.7.0 (compatible)');
            this.currentTransformersVersion = '3.7.0';
            return '3.7.0';
        }
        catch (error) {
            console.warn('Transformers.js not found or not importable:', error);
            return null;
        }
    }
    /**
     * Validate a model with comprehensive compatibility checking
     * @param modelName - Name of the model to validate
     * @param systemCapabilities - Optional system capabilities override
     * @returns Detailed validation result
     */
    static async validateModelDetailed(modelName, systemCapabilities) {
        const capabilities = systemCapabilities || this.systemCapabilities || undefined;
        // Get basic validation from registry
        const basicValidation = ModelRegistry.validateModel(modelName);
        const modelInfo = ModelRegistry.getModelInfo(modelName);
        if (!basicValidation.isValid) {
            return {
                ...basicValidation,
                modelInfo: undefined,
                systemCompatibility: undefined,
                recommendations: {
                    alternativeModels: this.getSimilarModels(modelName).length > 0 ?
                        this.getSimilarModels(modelName) :
                        Object.keys(SUPPORTED_MODELS).slice(0, 3),
                    systemUpgrades: [],
                    configurationChanges: []
                }
            };
        }
        // Perform detailed compatibility checking
        const systemCompatibility = await this.checkSystemCompatibility(modelInfo, capabilities);
        const recommendations = this.generateRecommendations(modelInfo, systemCompatibility, capabilities);
        // Combine all validation results
        const errors = [...basicValidation.errors];
        const warnings = [...basicValidation.warnings];
        const suggestions = [...basicValidation.suggestions];
        // Add system compatibility errors
        if (!systemCompatibility.transformersJs) {
            errors.push('Transformers.js version incompatibility detected');
        }
        if (!systemCompatibility.memory) {
            errors.push('Insufficient system memory for this model');
        }
        if (!systemCompatibility.platform) {
            errors.push('Model not supported on current platform');
        }
        if (!systemCompatibility.features) {
            errors.push('Required features not available in current transformers.js version');
        }
        // Add recommendations as suggestions
        if (recommendations.alternativeModels.length > 0) {
            suggestions.push(`Alternative models: ${recommendations.alternativeModels.join(', ')}`);
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            suggestions,
            modelInfo: modelInfo || undefined,
            systemCompatibility,
            recommendations
        };
    }
    /**
     * Validate transformers.js version compatibility for a model
     * @param modelInfo - Model information
     * @param transformersVersion - Transformers.js version to check
     * @returns Validation result
     */
    static validateTransformersCompatibility(modelInfo, transformersVersion) {
        const version = transformersVersion || this.currentTransformersVersion;
        if (!version) {
            return {
                isValid: false,
                errors: ['Transformers.js version not detected. Please ensure @huggingface/transformers is installed.'],
                warnings: [],
                suggestions: ['Install transformers.js: npm install @huggingface/transformers']
            };
        }
        const requiredVersion = modelInfo.requirements.transformersJsVersion;
        const isCompatible = this.checkVersionCompatibility(version, requiredVersion);
        if (!isCompatible) {
            const compatibilityInfo = this.getCompatibilityInfo(version);
            const supportedModelTypes = compatibilityInfo?.supportedModelTypes || [];
            return {
                isValid: false,
                errors: [
                    `Model '${modelInfo.name}' requires transformers.js ${requiredVersion}, but ${version} is installed.`,
                    `Current version does not support '${modelInfo.type}' models.`
                ],
                warnings: [...(compatibilityInfo?.knownIssues || [])],
                suggestions: [
                    `Upgrade transformers.js: npm install @huggingface/transformers@latest`,
                    `Supported model types in ${version}: ${supportedModelTypes.join(', ')}`
                ]
            };
        }
        const compatibilityInfo = this.getCompatibilityInfo(version);
        const warnings = [];
        const suggestions = [];
        // Check for known issues
        if (compatibilityInfo?.knownIssues.length) {
            warnings.push(...compatibilityInfo.knownIssues);
        }
        // Check if all required features are supported
        const requiredFeatures = modelInfo.requirements.requiredFeatures || [];
        const supportedFeatures = compatibilityInfo?.supportedFeatures || [];
        const missingFeatures = requiredFeatures.filter(feature => !supportedFeatures.includes(feature));
        if (missingFeatures.length > 0) {
            warnings.push(`Some features may not be fully supported: ${missingFeatures.join(', ')}`);
            suggestions.push('Consider upgrading to the latest transformers.js version for full feature support');
        }
        return {
            isValid: true,
            errors: [],
            warnings,
            suggestions
        };
    }
    /**
     * Get all models compatible with a specific transformers.js version
     * @param transformersVersion - Transformers.js version
     * @returns Array of compatible model names
     */
    static getCompatibleModels(transformersVersion) {
        const version = transformersVersion || this.currentTransformersVersion;
        if (!version)
            return [];
        const compatibilityInfo = this.getCompatibilityInfo(version);
        if (!compatibilityInfo)
            return [];
        return Object.keys(SUPPORTED_MODELS).filter(modelName => {
            const modelInfo = SUPPORTED_MODELS[modelName];
            return compatibilityInfo.supportedModelTypes.includes(modelInfo.type) &&
                this.checkVersionCompatibility(version, modelInfo.requirements.transformersJsVersion);
        });
    }
    /**
     * Get recommended models for a specific use case
     * @param contentTypes - Required content types
     * @param maxMemory - Maximum available memory in MB
     * @param transformersVersion - Transformers.js version
     * @returns Array of recommended model names
     */
    static getRecommendedModels(contentTypes, maxMemory, transformersVersion) {
        const compatibleModels = this.getCompatibleModels(transformersVersion);
        return compatibleModels.filter(modelName => {
            const modelInfo = SUPPORTED_MODELS[modelName];
            // Check content type support
            const supportsAllTypes = contentTypes.every(type => modelInfo.supportedContentTypes.includes(type));
            if (!supportsAllTypes)
                return false;
            // Check memory requirements
            if (maxMemory && modelInfo.requirements.minimumMemory) {
                if (modelInfo.requirements.minimumMemory > maxMemory)
                    return false;
            }
            return true;
        }).sort((a, b) => {
            // Sort by memory efficiency (lower memory first)
            const aMemory = SUPPORTED_MODELS[a].requirements.minimumMemory || 0;
            const bMemory = SUPPORTED_MODELS[b].requirements.minimumMemory || 0;
            return aMemory - bMemory;
        });
    }
    // =============================================================================
    // PRIVATE HELPER METHODS
    // =============================================================================
    /**
     * Check system compatibility for a model
     */
    static async checkSystemCompatibility(modelInfo, capabilities) {
        const transformersJs = capabilities?.transformersJsVersion ?
            this.checkVersionCompatibility(capabilities.transformersJsVersion, modelInfo.requirements.transformersJsVersion) :
            this.currentTransformersVersion ?
                this.checkVersionCompatibility(this.currentTransformersVersion, modelInfo.requirements.transformersJsVersion) :
                false;
        const memory = capabilities?.availableMemory && modelInfo.requirements.minimumMemory ?
            capabilities.availableMemory >= modelInfo.requirements.minimumMemory :
            true; // Assume sufficient if not specified
        const platform = capabilities?.platform && modelInfo.requirements.platformSupport ?
            modelInfo.requirements.platformSupport.includes(capabilities.platform) :
            true; // Assume compatible if not specified
        const features = capabilities?.supportedFeatures && modelInfo.requirements.requiredFeatures ?
            modelInfo.requirements.requiredFeatures.every(feature => capabilities.supportedFeatures.includes(feature)) :
            true; // Assume compatible if not specified
        return { transformersJs, memory, platform, features };
    }
    /**
     * Generate recommendations based on validation results
     */
    static generateRecommendations(modelInfo, systemCompatibility, capabilities) {
        const alternativeModels = [];
        const systemUpgrades = [];
        const configurationChanges = [];
        // Suggest alternative models if current one is incompatible
        if (!systemCompatibility.transformersJs || !systemCompatibility.memory) {
            const compatibleModels = this.getCompatibleModels();
            const sameTypeModels = compatibleModels.filter(name => SUPPORTED_MODELS[name].type === modelInfo.type);
            alternativeModels.push(...sameTypeModels.slice(0, 3));
        }
        // Suggest system upgrades
        if (!systemCompatibility.transformersJs) {
            systemUpgrades.push('Upgrade transformers.js to the latest version');
        }
        if (!systemCompatibility.memory && capabilities?.availableMemory && modelInfo.requirements.minimumMemory) {
            const needed = modelInfo.requirements.minimumMemory - capabilities.availableMemory;
            systemUpgrades.push(`Increase available memory by ${needed}MB`);
        }
        // Suggest configuration changes
        if (modelInfo.capabilities.maxBatchSize && modelInfo.capabilities.maxBatchSize < 8) {
            configurationChanges.push(`Use smaller batch sizes (max: ${modelInfo.capabilities.maxBatchSize})`);
        }
        return { alternativeModels, systemUpgrades, configurationChanges };
    }
    /**
     * Check version compatibility using semantic versioning
     */
    static checkVersionCompatibility(currentVersion, requiredVersion) {
        // Simple version comparison - in production, use a proper semver library
        const cleanRequired = requiredVersion.replace(/[>=<~^]/g, '');
        const currentParts = currentVersion.split('.').map(Number);
        const requiredParts = cleanRequired.split('.').map(Number);
        // Major version must match or be higher
        if (currentParts[0] > requiredParts[0])
            return true;
        if (currentParts[0] < requiredParts[0])
            return false;
        // Minor version must match or be higher
        if (currentParts[1] > requiredParts[1])
            return true;
        if (currentParts[1] < requiredParts[1])
            return false;
        // Patch version must match or be higher
        return currentParts[2] >= requiredParts[2];
    }
    /**
     * Get compatibility information for a transformers.js version
     */
    static getCompatibilityInfo(version) {
        // Find the closest matching version
        const availableVersions = Object.keys(TRANSFORMERS_COMPATIBILITY_MATRIX).sort();
        const matchingVersion = availableVersions.find(v => version.startsWith(v)) ||
            availableVersions[availableVersions.length - 1]; // Default to latest
        return TRANSFORMERS_COMPATIBILITY_MATRIX[matchingVersion] || null;
    }
    /**
     * Get similar models for suggestions
     */
    static getSimilarModels(modelName) {
        const allModels = Object.keys(SUPPORTED_MODELS);
        const lowerModelName = modelName.toLowerCase();
        return allModels.filter(supportedModel => {
            const lowerSupported = supportedModel.toLowerCase();
            // Check for common keywords
            const keywords = ['clip', 'mpnet', 'minilm', 'sentence', 'transformer', 'all', 'base', 'vit'];
            const modelKeywords = keywords.filter(keyword => lowerModelName.includes(keyword));
            const supportedKeywords = keywords.filter(keyword => lowerSupported.includes(keyword));
            return modelKeywords.some(keyword => supportedKeywords.includes(keyword));
        }).slice(0, 3);
    }
}
// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
/**
 * Enhanced ModelValidationError class with comprehensive error information
 */
export class EnhancedModelValidationError extends Error {
    modelName;
    availableModels;
    errorType;
    suggestions;
    troubleshootingSteps;
    name = 'ModelValidationError';
    constructor(modelName, availableModels, message, errorType = 'not_found', suggestions = [], troubleshootingSteps = []) {
        super(message);
        this.modelName = modelName;
        this.availableModels = availableModels;
        this.errorType = errorType;
        this.suggestions = suggestions;
        this.troubleshootingSteps = troubleshootingSteps;
    }
    /**
     * Get formatted error message with suggestions and troubleshooting steps
     */
    getFormattedMessage() {
        const lines = [];
        lines.push(`❌ Model Validation Error: ${this.message}`);
        lines.push('');
        if (this.suggestions.length > 0) {
            lines.push('💡 Suggestions:');
            this.suggestions.forEach(suggestion => {
                lines.push(`  • ${suggestion}`);
            });
            lines.push('');
        }
        if (this.availableModels.length > 0) {
            lines.push('📋 Available Models:');
            this.availableModels.forEach(model => {
                const modelInfo = SUPPORTED_MODELS[model];
                const typeInfo = modelInfo ? ` (${modelInfo.type}, ${modelInfo.dimensions}d)` : '';
                lines.push(`  • ${model}${typeInfo}`);
            });
            lines.push('');
        }
        if (this.troubleshootingSteps.length > 0) {
            lines.push('🔧 Troubleshooting Steps:');
            this.troubleshootingSteps.forEach((step, index) => {
                lines.push(`  ${index + 1}. ${step}`);
            });
        }
        return lines.join('\n');
    }
    /**
     * Log the error with proper formatting
     */
    logError() {
        console.error(this.getFormattedMessage());
    }
}
/**
 * Enhanced TransformersCompatibilityError class with version information
 */
export class EnhancedTransformersCompatibilityError extends Error {
    modelName;
    requiredVersion;
    currentVersion;
    upgradeInstructions;
    alternativeModels;
    name = 'TransformersCompatibilityError';
    constructor(modelName, requiredVersion, currentVersion, message, upgradeInstructions = [], alternativeModels = []) {
        super(message);
        this.modelName = modelName;
        this.requiredVersion = requiredVersion;
        this.currentVersion = currentVersion;
        this.upgradeInstructions = upgradeInstructions;
        this.alternativeModels = alternativeModels;
    }
    /**
     * Get formatted error message with upgrade instructions
     */
    getFormattedMessage() {
        const lines = [];
        lines.push(`❌ Transformers.js Compatibility Error: ${this.message}`);
        lines.push('');
        lines.push('📊 Version Information:');
        lines.push(`  • Required: ${this.requiredVersion}`);
        lines.push(`  • Current:  ${this.currentVersion}`);
        lines.push('');
        if (this.upgradeInstructions.length > 0) {
            lines.push('⬆️  Upgrade Instructions:');
            this.upgradeInstructions.forEach((instruction, index) => {
                lines.push(`  ${index + 1}. ${instruction}`);
            });
            lines.push('');
        }
        if (this.alternativeModels.length > 0) {
            lines.push('🔄 Compatible Alternative Models:');
            this.alternativeModels.forEach(model => {
                const modelInfo = SUPPORTED_MODELS[model];
                const versionInfo = modelInfo ? ` (requires ${modelInfo.requirements.transformersJsVersion})` : '';
                lines.push(`  • ${model}${versionInfo}`);
            });
        }
        return lines.join('\n');
    }
    /**
     * Log the error with proper formatting
     */
    logError() {
        console.error(this.getFormattedMessage());
    }
}
/**
 * Create a comprehensive model validation error with helpful information
 * @param modelName - Name of the invalid model
 * @param reason - Reason for validation failure
 * @param errorType - Type of validation error
 * @returns Enhanced ModelValidationError instance
 */
export function createModelValidationError(modelName, reason, errorType = 'not_found') {
    const availableModels = Object.keys(SUPPORTED_MODELS);
    const message = `Model '${modelName}' validation failed: ${reason}`;
    // Generate contextual suggestions based on error type
    const suggestions = generateModelSuggestions(modelName, errorType);
    const troubleshootingSteps = generateTroubleshootingSteps(errorType);
    return new EnhancedModelValidationError(modelName, availableModels, message, errorType, suggestions, troubleshootingSteps);
}
/**
 * Create a comprehensive transformers compatibility error with version information
 * @param modelName - Name of the model
 * @param requiredVersion - Required transformers.js version
 * @param currentVersion - Current transformers.js version
 * @returns Enhanced TransformersCompatibilityError instance
 */
export function createTransformersCompatibilityError(modelName, requiredVersion, currentVersion) {
    const message = `Model '${modelName}' requires transformers.js ${requiredVersion}, but ${currentVersion} is installed`;
    // Generate upgrade instructions
    const upgradeInstructions = generateUpgradeInstructions(requiredVersion, currentVersion);
    // Find alternative models compatible with current version
    const alternativeModels = ModelValidator.getCompatibleModels(currentVersion);
    return new EnhancedTransformersCompatibilityError(modelName, requiredVersion, currentVersion, message, upgradeInstructions, alternativeModels);
}
/**
 * Initialize the model validator with system detection
 * @returns Promise resolving to initialization success
 */
export async function initializeModelValidator() {
    try {
        const version = await ModelValidator.detectTransformersVersion();
        if (version) {
            console.log(`Detected transformers.js version: ${version}`);
            return true;
        }
        else {
            console.warn('Could not detect transformers.js version');
            return false;
        }
    }
    catch (error) {
        console.error('Failed to initialize model validator:', error);
        return false;
    }
}
// =============================================================================
// HELPER FUNCTIONS FOR ERROR GENERATION
// =============================================================================
/**
 * Generate contextual suggestions based on model name and error type
 */
function generateModelSuggestions(modelName, errorType) {
    const suggestions = [];
    const lowerModelName = modelName.toLowerCase();
    switch (errorType) {
        case 'not_found':
            // Check for common typos and similar models
            const similarModels = ModelValidator.getSimilarModels(modelName);
            if (similarModels.length > 0) {
                suggestions.push(`Did you mean one of these models?`);
                similarModels.forEach(model => suggestions.push(`  • ${model}`));
            }
            else {
                suggestions.push('Check the model name for typos');
                suggestions.push('Ensure the model is supported by transformers.js');
            }
            // Suggest based on apparent intent
            if (lowerModelName.includes('clip')) {
                suggestions.push('For multimodal models, try: Xenova/clip-vit-base-patch32');
            }
            else if (lowerModelName.includes('sentence') || lowerModelName.includes('text')) {
                suggestions.push('For text models, try: sentence-transformers/all-MiniLM-L6-v2');
            }
            break;
        case 'incompatible':
            suggestions.push('Update transformers.js to the latest version');
            suggestions.push('Check the model requirements in the documentation');
            suggestions.push('Consider using a compatible alternative model');
            break;
        case 'unsupported_features':
            suggestions.push('Upgrade transformers.js to get required features');
            suggestions.push('Use a model with fewer feature requirements');
            suggestions.push('Check transformers.js changelog for feature availability');
            break;
    }
    return suggestions;
}
/**
 * Generate troubleshooting steps based on error type
 */
function generateTroubleshootingSteps(errorType) {
    const steps = [];
    switch (errorType) {
        case 'not_found':
            steps.push('Verify the model name spelling and format');
            steps.push('Check if the model exists on Hugging Face Hub');
            steps.push('Ensure the model is compatible with transformers.js');
            steps.push('Try using a model from the supported models list');
            break;
        case 'incompatible':
            steps.push('Check your current transformers.js version: npm list @huggingface/transformers');
            steps.push('Update to the latest version: npm install @huggingface/transformers@latest');
            steps.push('Clear npm cache if update fails: npm cache clean --force');
            steps.push('Restart your application after updating');
            break;
        case 'unsupported_features':
            steps.push('Check which features are missing in your transformers.js version');
            steps.push('Update transformers.js to get the latest features');
            steps.push('Use alternative models that don\'t require missing features');
            steps.push('Check the transformers.js documentation for feature support');
            break;
    }
    return steps;
}
/**
 * Generate upgrade instructions for transformers.js
 */
function generateUpgradeInstructions(requiredVersion, currentVersion) {
    const instructions = [];
    // Clean version strings for comparison
    const cleanRequired = requiredVersion.replace(/[>=<~^]/g, '');
    const isSpecificVersion = !requiredVersion.includes('>=');
    if (isSpecificVersion) {
        instructions.push(`Install specific version: npm install @huggingface/transformers@${cleanRequired}`);
    }
    else {
        instructions.push('Update to latest version: npm install @huggingface/transformers@latest');
        instructions.push(`Or install minimum required: npm install @huggingface/transformers@${cleanRequired}`);
    }
    instructions.push('Clear npm cache if needed: npm cache clean --force');
    instructions.push('Restart your application after updating');
    instructions.push('Verify installation: npm list @huggingface/transformers');
    return instructions;
}
// =============================================================================
// ENHANCED VALIDATION FUNCTIONS
// =============================================================================
/**
 * Comprehensive model validation with detailed error reporting
 * @param modelName - Name of the model to validate
 * @param options - Validation options
 * @returns Promise resolving to validation result or throws enhanced error
 */
export async function validateModelWithDetailedErrors(modelName, options = {}) {
    const { checkTransformersVersion = true, systemCapabilities, throwOnError = false } = options;
    try {
        // Basic model validation
        const basicValidation = ModelRegistry.validateModel(modelName);
        if (!basicValidation.isValid) {
            const error = createModelValidationError(modelName, basicValidation.errors[0], 'not_found');
            if (throwOnError) {
                throw error;
            }
            return {
                ...basicValidation,
                modelInfo: undefined,
                systemCompatibility: undefined,
                recommendations: {
                    alternativeModels: ModelValidator.getSimilarModels(modelName).length > 0 ?
                        ModelValidator.getSimilarModels(modelName) :
                        Object.keys(SUPPORTED_MODELS).slice(0, 3),
                    systemUpgrades: [],
                    configurationChanges: []
                }
            };
        }
        // Get model info for detailed validation
        const modelInfo = ModelRegistry.getModelInfo(modelName);
        // Check transformers.js compatibility if requested
        if (checkTransformersVersion) {
            const currentVersion = ModelValidator.getTransformersVersion() || await ModelValidator.detectTransformersVersion();
            if (currentVersion) {
                const compatibilityResult = ModelValidator.validateTransformersCompatibility(modelInfo, currentVersion);
                if (!compatibilityResult.isValid) {
                    const error = createTransformersCompatibilityError(modelName, modelInfo.requirements.transformersJsVersion, currentVersion);
                    if (throwOnError) {
                        throw error;
                    }
                    // Return failed validation result
                    return {
                        isValid: false,
                        errors: compatibilityResult.errors,
                        warnings: compatibilityResult.warnings,
                        suggestions: compatibilityResult.suggestions,
                        modelInfo,
                        systemCompatibility: {
                            transformersJs: false,
                            memory: true,
                            platform: true,
                            features: false
                        },
                        recommendations: {
                            alternativeModels: ModelValidator.getCompatibleModels(currentVersion),
                            systemUpgrades: ['Upgrade transformers.js to the latest version'],
                            configurationChanges: []
                        }
                    };
                }
            }
        }
        // Perform detailed validation
        return await ModelValidator.validateModelDetailed(modelName, systemCapabilities);
    }
    catch (error) {
        if (error instanceof EnhancedModelValidationError || error instanceof EnhancedTransformersCompatibilityError) {
            throw error;
        }
        // Wrap unexpected errors
        const wrappedError = createModelValidationError(modelName, error instanceof Error ? error.message : String(error), 'incompatible');
        if (throwOnError) {
            throw wrappedError;
        }
        return {
            isValid: false,
            errors: [wrappedError.message],
            warnings: [],
            suggestions: wrappedError.suggestions.slice(),
            modelInfo: undefined,
            systemCompatibility: undefined,
            recommendations: {
                alternativeModels: [],
                systemUpgrades: [],
                configurationChanges: []
            }
        };
    }
}
/**
 * Validate model and provide user-friendly error messages
 * @param modelName - Name of the model to validate
 * @param options - Validation options
 * @returns Promise resolving to true if valid, throws user-friendly error if not
 */
export async function validateModelOrThrow(modelName, options = {}) {
    const { logErrors = true } = options;
    try {
        const result = await validateModelWithDetailedErrors(modelName, {
            ...options,
            throwOnError: true
        });
        // Log warnings if validation passed but has warnings
        if (result.warnings.length > 0 && logErrors) {
            console.warn('⚠️  Model validation warnings:');
            result.warnings.forEach(warning => console.warn(`  • ${warning}`));
        }
        return true;
    }
    catch (error) {
        if (logErrors) {
            if (error instanceof EnhancedModelValidationError || error instanceof EnhancedTransformersCompatibilityError) {
                error.logError();
            }
            else {
                console.error('❌ Model validation failed:', error instanceof Error ? error.message : String(error));
            }
        }
        throw error;
    }
}
// =============================================================================
// CONSTANTS
// =============================================================================
/**
 * Minimum supported transformers.js version
 */
export const MIN_TRANSFORMERS_VERSION = '2.6.0';
/**
 * Recommended transformers.js version
 */
export const RECOMMENDED_TRANSFORMERS_VERSION = '2.8.0';
/**
 * Default system capabilities for validation
 */
export const DEFAULT_SYSTEM_CAPABILITIES = {
    platform: 'node',
    availableMemory: 2048, // 2GB default
    gpuSupport: false,
    supportedFeatures: ['tokenizers', 'text-generation', 'feature-extraction']
};
