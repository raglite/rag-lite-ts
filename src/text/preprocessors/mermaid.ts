import { Preprocessor, PreprocessorOptions } from '../../types.js';
import { ContentTypeDetector } from './registry.js';

/**
 * Mermaid preprocessor for handling Mermaid diagrams in Markdown files
 * Supports strip, extract, and placeholder modes
 */
export class MermaidPreprocessor implements Preprocessor {
  /**
   * Check if this preprocessor applies to the given language/content type
   * Applies to mermaid code blocks and content with Mermaid syntax
   */
  appliesTo(language: string): boolean {
    return language === 'mermaid';
  }

  /**
   * Process Mermaid content based on the specified mode
   */
  process(content: string, options: PreprocessorOptions): string {
    // Only process if content actually contains Mermaid diagrams
    if (!ContentTypeDetector.hasMermaidContent(content)) {
      return content;
    }

    switch (options.mode) {
      case 'strip':
        return this.stripMermaid(content);
      case 'extract':
        return this.extractMermaidEdges(content);
      case 'placeholder':
        return this.replaceWithPlaceholders(content);
      default:
        console.log(`Unknown Mermaid processing mode: ${options.mode}, using placeholder`);
        return this.replaceWithPlaceholders(content);
    }
  }

  /**
   * Strip Mermaid diagrams entirely
   */
  private stripMermaid(content: string): string {
    let cleaned = content;

    // Remove mermaid code blocks: ```mermaid ... ```
    cleaned = cleaned.replace(/```mermaid[\s\S]*?```/gi, '');

    // Clean up multiple consecutive newlines and trim
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    // Ensure we never return empty content (requirement 6.4)
    if (!cleaned.trim()) {
      return '[content removed]';
    }

    return cleaned;
  }

  /**
   * Replace Mermaid diagrams with descriptive placeholders
   */
  private replaceWithPlaceholders(content: string): string {
    let cleaned = content;

    // Replace mermaid code blocks with placeholder
    cleaned = cleaned.replace(/```mermaid[\s\S]*?```/gi, '[diagram removed]');

    // Clean up multiple consecutive newlines and trim
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    return cleaned;
  }

  /**
   * Extract semantic information from Mermaid diagrams
   * Converts diagram edges to plain text while ignoring styling and layout instructions
   */
  private extractMermaidEdges(content: string): string {
    let processed = content;

    // Process each mermaid code block
    processed = processed.replace(/```mermaid([\s\S]*?)```/gi, (match, diagramContent) => {
      const edges = this.extractEdgesFromDiagram(diagramContent);
      return edges.length > 0 ? edges.join('\n') : '[diagram content extracted]';
    });

    return processed;
  }

  /**
   * Extract edges and relationships from a Mermaid diagram
   * Ignores styling, layout, and formatting instructions
   */
  private extractEdgesFromDiagram(diagramContent: string): string[] {
    const edges: string[] = [];
    const lines = diagramContent.split('\n');
    
    // Detect diagram type from first non-empty line
    let diagramType = 'flowchart'; // default
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('%')) {
        if (trimmed.includes('sequenceDiagram')) diagramType = 'sequence';
        else if (trimmed.includes('classDiagram')) diagramType = 'class';
        else if (trimmed.includes('stateDiagram')) diagramType = 'state';
        else if (trimmed.includes('erDiagram')) diagramType = 'er';
        else if (trimmed.includes('graph') || trimmed.includes('flowchart')) diagramType = 'flowchart';
        break;
      }
    }

    // For flowcharts, build a node label mapping first
    const nodeLabelMap = new Map<string, string>();
    if (diagramType === 'flowchart') {
      this.buildNodeLabelMap(lines, nodeLabelMap);
    }

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines, comments, and diagram type declarations
      if (!trimmedLine || 
          trimmedLine.startsWith('%') || 
          trimmedLine.startsWith('%%') ||
          this.isLayoutInstruction(trimmedLine) ||
          this.isStyleInstruction(trimmedLine)) {
        continue;
      }

      // Extract edges from different diagram types
      const edge = this.extractEdgeFromLine(trimmedLine, diagramType, nodeLabelMap);
      if (edge) {
        edges.push(edge);
      }
    }

    return edges;
  }

  /**
   * Build a mapping of node IDs to their labels by scanning all lines
   */
  private buildNodeLabelMap(lines: string[], nodeLabelMap: Map<string, string>): void {
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('%') || trimmedLine.startsWith('%%')) {
        continue;
      }

      // Find all node definitions in the line (both source and target)
      const regex = /(\w+)(?:\[([^\]]+)\]|\{([^}]+)\}|\(\(([^)]+)\)\)|\(([^)]+)\))/g;
      let match;
      while ((match = regex.exec(trimmedLine)) !== null) {
        const [, nodeId, squareLabel, curlyLabel, doubleParenLabel, parenLabel] = match;
        const label = squareLabel || curlyLabel || doubleParenLabel || parenLabel;
        if (label) {
          nodeLabelMap.set(nodeId, label.trim());
        }
      }
    }
  }

  /**
   * Check if a line is a layout instruction (should be ignored)
   */
  private isLayoutInstruction(line: string): boolean {
    const layoutPatterns = [
      /^(graph|flowchart)\s+(TD|TB|BT|RL|LR)/i,
      /^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt)/i,
      /^pie\s+title/i,
      /^direction\s+(TD|TB|BT|RL|LR)/i,
      /^subgraph/i,
      /^end$/i
    ];

    return layoutPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if a line is a styling instruction (should be ignored)
   */
  private isStyleInstruction(line: string): boolean {
    const stylePatterns = [
      /^classDef\s+/i,
      /^class\s+.*\s+\w+$/i,
      /^style\s+/i,
      /^fill:/i,
      /^stroke:/i,
      /^color:/i,
      /:::.*$/,  // CSS class assignments
      /^linkStyle\s+/i,
      /^click\s+/i
    ];

    return stylePatterns.some(pattern => pattern.test(line));
  }

  /**
   * Extract the meaningful label from a node definition
   * Examples: A[Start] -> "Start", B{Decision} -> "Decision", C((End)) -> "End", D -> "D"
   */
  private extractNodeLabel(nodeText: string, nodeLabelMap?: Map<string, string>): string {
    // Handle square brackets: A[Start]
    const squareMatch = nodeText.match(/\w+\[([^\]]+)\]/);
    if (squareMatch) {
      return squareMatch[1].trim();
    }
    
    // Handle curly braces: B{Decision}
    const curlyMatch = nodeText.match(/\w+\{([^}]+)\}/);
    if (curlyMatch) {
      return curlyMatch[1].trim();
    }
    
    // Handle double parentheses: C((End))
    const doubleParenMatch = nodeText.match(/\w+\(\(([^)]+)\)\)/);
    if (doubleParenMatch) {
      return doubleParenMatch[1].trim();
    }
    
    // Handle single parentheses: D(Text)
    const parenMatch = nodeText.match(/\w+\(([^)]+)\)/);
    if (parenMatch) {
      return parenMatch[1].trim();
    }
    
    // If no inline label found, check the node label map
    const idMatch = nodeText.match(/(\w+)/);
    const nodeId = idMatch ? idMatch[1] : nodeText;
    
    if (nodeLabelMap && nodeLabelMap.has(nodeId)) {
      return nodeLabelMap.get(nodeId)!;
    }
    
    // Return the node ID as fallback
    return nodeId;
  }

  /**
   * Extract edge information from a single line
   */
  private extractEdgeFromLine(line: string, diagramType: string = 'flowchart', nodeLabelMap?: Map<string, string>): string | null {
    // Handle based on diagram type
    if (diagramType === 'sequence') {
      // Sequence diagram: A->>B: message or A-->>B: message
      const sequenceMatch = line.match(/(\w+)\s*--?>>?\+?\s*(\w+)\s*:\s*(.+)/);
      if (sequenceMatch) {
        const [, from, to, message] = sequenceMatch;
        return `${from} sends to ${to}: ${message.trim()}`;
      }
    }

    if (diagramType === 'class') {
      // Class diagram inheritance: Animal --|> Dog
      const inheritanceMatch = line.match(/(\w+)\s*--\|>\s*(\w+)/);
      if (inheritanceMatch) {
        const [, from, to] = inheritanceMatch;
        return `${from} inherits from ${to}`;
      }

      // Class diagram other relationships
      const classMatch = line.match(/(\w+)\s*(<\|--|--\||<\|--\|>|\*--|--\*|o--|--o)\s*(\w+)/);
      if (classMatch) {
        const [, from, connector, to] = classMatch;
        const relationship = this.interpretClassConnector(connector);
        return `${from} ${relationship} ${to}`;
      }
    }

    if (diagramType === 'er') {
      // ER diagram: CUSTOMER ||--o{ ORDER
      const erMatch = line.match(/(\w+)\s*(\|\|--o\{|\}o--\|\||\|\|--\|\||o\{--\|\|)\s*(\w+)/);
      if (erMatch) {
        const [, from, connector, to] = erMatch;
        const relationship = this.interpretERConnector(connector);
        return `${from} ${relationship} ${to}`;
      }
    }

    if (diagramType === 'state') {
      // State diagram: state1 --> state2 (but not [*] --> state)
      const stateMatch = line.match(/^(?!\s*\[\*\])\s*(\w+)\s*-->\s*(\w+)$/);
      if (stateMatch) {
        const [, from, to] = stateMatch;
        return `${from} transitions to ${to}`;
      }
    }

    if (diagramType === 'flowchart') {
      // Flowchart/Graph edges with labels: A --> B | label | (not A -->|label| B)
      const flowchartLabelMatch = line.match(/(\w+(?:\[[^\]]+\]|\{[^}]+\}|\(\([^)]+\)\)|\([^)]+\))?)\s*(-->|---|-.->|-\.-|->|--)\s+(\w+(?:\[[^\]]+\]|\{[^}]+\}|\(\([^)]+\)\)|\([^)]+\))?)\s*\|\s*([^|]+)\s*\|/);
      if (flowchartLabelMatch) {
        const [, fromNode, connector, toNode, edgeLabel] = flowchartLabelMatch;
        const from = this.extractNodeLabel(fromNode, nodeLabelMap);
        const to = this.extractNodeLabel(toNode, nodeLabelMap);
        const relationship = this.interpretConnector(connector);
        return `${from} ${relationship} ${to} (${edgeLabel.trim()})`;
      }

      // Alternative label format: A -->|label| B (handle nodes with spaces in labels)
      const flowchartLabelMatch2 = line.match(/(\w+(?:\[[^\]]+\]|\{[^}]+\}|\(\([^)]+\)\)|\([^)]+\))?)\s*(-->|---|-.->|-\.-|->|--)\|([^|]+)\|\s*(.+)/);
      if (flowchartLabelMatch2) {
        const [, fromNode, connector, edgeLabel, toNode] = flowchartLabelMatch2;
        const from = this.extractNodeLabel(fromNode, nodeLabelMap);
        const to = this.extractNodeLabel(toNode.trim(), nodeLabelMap);
        const relationship = this.interpretConnector(connector);
        return `${from} ${relationship} ${to} (${edgeLabel.trim()})`;
      }

      // Flowchart/Graph edges: A --> B, A --- B, A -.-> B, etc. (with optional node styling)
      const flowchartEdgeMatch = line.match(/(\w+(?:\[[^\]]+\]|\{[^}]+\}|\(\([^)]+\)\)|\([^)]+\))?)\s*(-->|---|-.->|-\.-|->|--)\s*(.+)/);
      if (flowchartEdgeMatch) {
        const [, fromNode, connector, toNode] = flowchartEdgeMatch;
        // Skip if this looks like a label format (contains |)
        if (toNode.includes('|')) {
          return null;
        }
        const from = this.extractNodeLabel(fromNode, nodeLabelMap);
        const to = this.extractNodeLabel(toNode.trim(), nodeLabelMap);
        const relationship = this.interpretConnector(connector);
        return `${from} ${relationship} ${to}`;
      }
    }

    return null;
  }

  /**
   * Interpret flowchart connector symbols
   */
  private interpretConnector(connector: string): string {
    if (connector.includes('-->')) return 'leads to';
    if (connector.includes('-.->')) return 'optionally leads to';
    if (connector.includes('---')) return 'connects to';
    if (connector.includes('-.-')) return 'optionally connects to';
    return 'relates to';
  }

  /**
   * Interpret class diagram connector symbols
   */
  private interpretClassConnector(connector: string): string {
    switch (connector) {
      case '--|>': return 'inherits from';
      case '<|--': return 'is inherited by';
      case '--||': return 'implements';
      case '<|--|>': return 'has bidirectional inheritance with';
      case '*--': return 'composes';
      case '--*': return 'is composed by';
      case 'o--': return 'aggregates';
      case '--o': return 'is aggregated by';
      default: return 'relates to';
    }
  }

  /**
   * Interpret ER diagram connector symbols
   */
  private interpretERConnector(connector: string): string {
    switch (connector) {
      case '||--o{': return 'has one-to-many relationship with';
      case '}o--||': return 'has many-to-one relationship with';
      case '||--||': return 'has one-to-one relationship with';
      case 'o{--||': return 'has many-to-one relationship with';
      default: return 'has relationship with';
    }
  }
}