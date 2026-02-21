/**
 * Kyro IDE - Flame Graph Visualization
 * Stack frame processing, time aggregation, and export capabilities
 */

import type {
  FlameGraphNode,
  StackFrame,
  ColorCategory,
  ProfileSample,
} from './performance-profiler';

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface FlameGraphConfig {
  /** Minimum width percentage to display a frame */
  minFrameWidth: number;
  /** Height of each stack level in pixels */
  frameHeight: number;
  /** Enable color coding by module */
  colorByModule: boolean;
  /** Enable color coding by category */
  colorByCategory: boolean;
  /** Highlight hot spots */
  highlightHotSpots: boolean;
  /** Hot spot threshold (percentage) */
  hotSpotThreshold: number;
  /** Maximum depth to render */
  maxDepth: number;
  /** Show function names */
  showNames: boolean;
  /** Show timing info */
  showTiming: boolean;
  /** Enable interactive features */
  interactive: boolean;
  /** Zoom level (1 = 100%) */
  zoomLevel: number;
  /** Pan offset X */
  panX: number;
  /** Pan offset Y */
  panY: number;
}

export interface FlameGraphViewport {
  /** X position of viewport */
  x: number;
  /** Y position of viewport */
  y: number;
  /** Width of viewport */
  width: number;
  /** Height of viewport */
  height: number;
  /** Zoom level */
  zoom: number;
}

export interface FlameFrameData {
  /** Unique frame ID */
  id: string;
  /** Function name */
  name: string;
  /** Module/package name */
  module?: string;
  /** Full qualified name */
  fullName: string;
  /** X position (normalized 0-1) */
  x: number;
  /** Width (normalized 0-1) */
  width: number;
  /** Depth level */
  depth: number;
  /** Self time value */
  selfValue: number;
  /** Total time value */
  totalValue: number;
  /** Percentage of total */
  percent: number;
  /** Color hex code */
  color: string;
  /** Color category */
  category: ColorCategory;
  /** Is a hot spot */
  isHotSpot: boolean;
  /** Has children */
  hasChildren: boolean;
  /** Child count */
  childCount: number;
  /** Script URL */
  scriptUrl?: string;
  /** Line number */
  lineNumber?: number;
  /** Column number */
  columnNumber?: number;
  /** Tooltip text */
  tooltip: string;
  /** Raw node reference */
  node: FlameGraphNode;
}

export interface FlameGraphRenderData {
  /** Processed frames for rendering */
  frames: FlameFrameData[];
  /** Total depth of flame graph */
  totalDepth: number;
  /** Total samples represented */
  totalSamples: number;
  /** Total execution time (microseconds) */
  totalTime: number;
  /** Viewport configuration */
  viewport: FlameGraphViewport;
  /** Color legend */
  colorLegend: ColorLegendEntry[];
  /** Hot spot frames */
  hotSpotFrames: FlameFrameData[];
}

export interface ColorLegendEntry {
  category: ColorCategory;
  label: string;
  color: string;
  description: string;
}

export interface TimeAggregation {
  /** Function name */
  functionName: string;
  /** Module name */
  moduleName?: string;
  /** Total self time (microseconds) */
  selfTime: number;
  /** Total time (microseconds) */
  totalTime: number;
  /** Percentage of total */
  percent: number;
  /** Sample count */
  sampleCount: number;
  /** Average time per sample */
  avgTime: number;
  /** Min time */
  minTime: number;
  /** Max time */
  maxTime: number;
}

export interface StackAggregation {
  /** Stack hash */
  hash: string;
  /** Stack frames */
  frames: StackFrame[];
  /** Sample count */
  count: number;
  /** Percentage */
  percent: number;
  /** Total time */
  totalTime: number;
}

export interface FlameGraphExport {
  /** Export format */
  format: 'svg' | 'json' | 'html' | 'cpuprofile' | 'collapsed';
  /** Export data */
  data: string | object;
  /** Metadata */
  metadata: {
    exportedAt: Date;
    totalSamples: number;
    totalTime: number;
    appName: string;
    version: string;
  };
}

export interface FlameGraphDiff {
  /** Base flame graph */
  base: FlameGraphRenderData;
  /** Comparison flame graph */
  compare: FlameGraphRenderData;
  /** Diff frames */
  diffFrames: DiffFrame[];
  /** Summary statistics */
  summary: DiffSummary;
}

export interface DiffFrame {
  /** Function name */
  name: string;
  /** Module name */
  module?: string;
  /** Base value (0 if not present) */
  baseValue: number;
  /** Compare value (0 if not present) */
  compareValue: number;
  /** Difference */
  diff: number;
  /** Percentage change */
  changePercent: number;
  /** Diff type */
  type: 'added' | 'removed' | 'increased' | 'decreased' | 'unchanged';
}

export interface DiffSummary {
  /** Total base samples */
  baseSamples: number;
  /** Total compare samples */
  compareSamples: number;
  /** Sample count change */
  sampleChange: number;
  /** New functions added */
  addedFunctions: number;
  /** Functions removed */
  removedFunctions: number;
  /** Functions with significant increase */
  increasedFunctions: number;
  /** Functions with significant decrease */
  decreasedFunctions: number;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

export const DEFAULT_FLAME_GRAPH_CONFIG: FlameGraphConfig = {
  minFrameWidth: 0.001,
  frameHeight: 24,
  colorByModule: true,
  colorByCategory: true,
  highlightHotSpots: true,
  hotSpotThreshold: 5,
  maxDepth: 100,
  showNames: true,
  showTiming: true,
  interactive: true,
  zoomLevel: 1,
  panX: 0,
  panY: 0,
};

// ============================================
// COLOR PALETTE
// ============================================

const COLOR_PALETTE: Record<ColorCategory, { primary: string; gradient: string[] }> = {
  javascript: {
    primary: '#f7df1e',
    gradient: ['#f7df1e', '#e6ce00', '#c4b000'],
  },
  typescript: {
    primary: '#3178c6',
    gradient: ['#3178c6', '#2563eb', '#1d4ed8'],
  },
  native: {
    primary: '#6b7280',
    gradient: ['#6b7280', '#4b5563', '#374151'],
  },
  nodejs: {
    primary: '#339933',
    gradient: ['#339933', '#22c55e', '#16a34a'],
  },
  library: {
    primary: '#8b5cf6',
    gradient: ['#8b5cf6', '#7c3aed', '#6d28d9'],
  },
  test: {
    primary: '#10b981',
    gradient: ['#10b981', '#059669', '#047857'],
  },
  config: {
    primary: '#f59e0b',
    gradient: ['#f59e0b', '#d97706', '#b45309'],
  },
  other: {
    primary: '#64748b',
    gradient: ['#64748b', '#475569', '#334155'],
  },
};

const COLOR_LEGEND: ColorLegendEntry[] = [
  { category: 'javascript', label: 'JavaScript', color: '#f7df1e', description: 'JavaScript source files' },
  { category: 'typescript', label: 'TypeScript', color: '#3178c6', description: 'TypeScript source files' },
  { category: 'native', label: 'Native', color: '#6b7280', description: 'Native/built-in functions' },
  { category: 'nodejs', label: 'Node.js', color: '#339933', description: 'Node.js built-in modules' },
  { category: 'library', label: 'Library', color: '#8b5cf6', description: 'Third-party libraries' },
  { category: 'test', label: 'Test', color: '#10b981', description: 'Test files' },
  { category: 'config', label: 'Config', color: '#f59e0b', description: 'Configuration files' },
  { category: 'other', label: 'Other', color: '#64748b', description: 'Uncategorized files' },
];

// ============================================
// FLAME GRAPH PROCESSOR CLASS
// ============================================

export class FlameGraphProcessor {
  private config: FlameGraphConfig;
  private frameCounter: number = 0;

  constructor(config: Partial<FlameGraphConfig> = {}) {
    this.config = { ...DEFAULT_FLAME_GRAPH_CONFIG, ...config };
  }

  /**
   * Process flame graph node tree into render data
   */
  processFlameGraph(
    rootNode: FlameGraphNode,
    totalSamples: number
  ): FlameGraphRenderData {
    this.frameCounter = 0;
    const frames: FlameFrameData[] = [];
    const hotSpotFrames: FlameFrameData[] = [];
    const totalTime = totalSamples * 1000; // Approximate microseconds

    // Process tree recursively
    this.processNode(
      rootNode,
      0, // x
      1, // width
      0, // depth
      totalSamples,
      frames,
      hotSpotFrames
    );

    // Calculate total depth
    const totalDepth = Math.max(...frames.map((f) => f.depth)) + 1;

    // Create viewport
    const viewport: FlameGraphViewport = {
      x: 0,
      y: 0,
      width: 1,
      height: totalDepth * this.config.frameHeight,
      zoom: this.config.zoomLevel,
    };

    return {
      frames,
      totalDepth,
      totalSamples,
      totalTime,
      viewport,
      colorLegend: COLOR_LEGEND,
      hotSpotFrames,
    };
  }

  /**
   * Process a single node recursively
   */
  private processNode(
    node: FlameGraphNode,
    x: number,
    width: number,
    depth: number,
    totalSamples: number,
    frames: FlameFrameData[],
    hotSpotFrames: FlameFrameData[]
  ): void {
    // Skip if width is too small
    if (width < this.config.minFrameWidth) return;

    // Skip if depth exceeds max
    if (depth > this.config.maxDepth) return;

    const percent = (node.totalValue / totalSamples) * 100;
    const isHotSpot = percent >= this.config.hotSpotThreshold || node.isHotSpot;

    const frame: FlameFrameData = {
      id: `frame-${++this.frameCounter}`,
      name: node.name,
      module: node.module,
      fullName: this.getFullName(node),
      x,
      width,
      depth,
      selfValue: node.value,
      totalValue: node.totalValue,
      percent,
      color: this.getColor(node, depth),
      category: node.colorCategory,
      isHotSpot,
      hasChildren: node.children.length > 0,
      childCount: node.children.length,
      scriptUrl: node.scriptUrl,
      lineNumber: node.line,
      columnNumber: node.column,
      tooltip: this.generateTooltip(node, totalSamples),
      node,
    };

    frames.push(frame);

    if (isHotSpot && this.config.highlightHotSpots) {
      hotSpotFrames.push(frame);
    }

    // Process children
    let childX = x;
    const parentWidth = width;

    node.children.forEach((child) => {
      const childWidth = (child.totalValue / node.totalValue) * parentWidth;
      this.processNode(
        child,
        childX,
        childWidth,
        depth + 1,
        totalSamples,
        frames,
        hotSpotFrames
      );
      childX += childWidth;
    });
  }

  /**
   * Get full qualified name for node
   */
  private getFullName(node: FlameGraphNode): string {
    const parts: string[] = [];
    if (node.module) parts.push(node.module);
    parts.push(node.name);
    return parts.join('::');
  }

  /**
   * Get color for node
   */
  private getColor(node: FlameGraphNode, depth: number): string {
    const palette = COLOR_PALETTE[node.colorCategory] || COLOR_PALETTE.other;
    const gradient = palette.gradient;
    const index = depth % gradient.length;
    return gradient[index];
  }

  /**
   * Generate tooltip text
   */
  private generateTooltip(node: FlameGraphNode, totalSamples: number): string {
    const percent = ((node.totalValue / totalSamples) * 100).toFixed(2);
    const lines: string[] = [
      `Function: ${node.name}`,
      `Time: ${percent}% (${node.totalValue} samples)`,
    ];

    if (node.module) {
      lines.push(`Module: ${node.module}`);
    }

    if (node.scriptUrl) {
      lines.push(`File: ${node.scriptUrl}:${node.line || '?'}`);
    }

    if (node.isHotSpot) {
      lines.push('⚠️ Hot Spot');
    }

    return lines.join('\n');
  }

  /**
   * Aggregate samples by function
   */
  aggregateByFunction(samples: ProfileSample[]): TimeAggregation[] {
    const aggregation = new Map<string, TimeAggregation>();

    samples.forEach((sample) => {
      sample.stack.forEach((frame, index) => {
        const key = `${frame.functionName}:${frame.scriptId}`;
        const existing = aggregation.get(key);

        if (existing) {
          existing.sampleCount++;
          if (index === 0) {
            // Leaf frame - count as self time
            existing.selfTime += sample.cpuTime;
          }
          existing.totalTime += sample.cpuTime;
          existing.minTime = Math.min(existing.minTime, sample.cpuTime);
          existing.maxTime = Math.max(existing.maxTime, sample.cpuTime);
          existing.avgTime = existing.totalTime / existing.sampleCount;
        } else {
          aggregation.set(key, {
            functionName: frame.functionName,
            moduleName: frame.moduleName,
            selfTime: index === 0 ? sample.cpuTime : 0,
            totalTime: sample.cpuTime,
            percent: 0,
            sampleCount: 1,
            avgTime: sample.cpuTime,
            minTime: sample.cpuTime,
            maxTime: sample.cpuTime,
          });
        }
      });
    });

    // Calculate percentages
    const totalTime = samples.reduce((sum, s) => sum + s.cpuTime, 0);
    aggregation.forEach((agg) => {
      agg.percent = (agg.totalTime / totalTime) * 100;
    });

    // Sort by total time descending
    return Array.from(aggregation.values()).sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Aggregate samples by stack
   */
  aggregateByStack(samples: ProfileSample[]): StackAggregation[] {
    const aggregation = new Map<string, StackAggregation>();

    samples.forEach((sample) => {
      const hash = sample.stack.map((f) => f.hash).join('|');
      const existing = aggregation.get(hash);

      if (existing) {
        existing.count++;
        existing.totalTime += sample.cpuTime;
        existing.percent = (existing.count / samples.length) * 100;
      } else {
        aggregation.set(hash, {
          hash,
          frames: [...sample.stack],
          count: 1,
          percent: (1 / samples.length) * 100,
          totalTime: sample.cpuTime,
        });
      }
    });

    // Sort by count descending
    return Array.from(aggregation.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Apply zoom transformation
   */
  applyZoom(
    renderData: FlameGraphRenderData,
    centerX: number,
    centerY: number,
    zoomDelta: number
  ): FlameGraphRenderData {
    const newZoom = Math.max(
      0.1,
      Math.min(10, renderData.viewport.zoom * (1 + zoomDelta))
    );

    const viewport: FlameGraphViewport = {
      ...renderData.viewport,
      zoom: newZoom,
    };

    return {
      ...renderData,
      viewport,
    };
  }

  /**
   * Apply pan transformation
   */
  applyPan(
    renderData: FlameGraphRenderData,
    deltaX: number,
    deltaY: number
  ): FlameGraphRenderData {
    const viewport: FlameGraphViewport = {
      ...renderData.viewport,
      x: Math.max(0, Math.min(1, renderData.viewport.x + deltaX)),
      y: Math.max(0, renderData.viewport.y + deltaY),
    };

    return {
      ...renderData,
      viewport,
    };
  }

  /**
   * Find frames at position
   */
  findFramesAtPosition(
    renderData: FlameGraphRenderData,
    x: number,
    y: number
  ): FlameFrameData[] {
    return renderData.frames.filter((frame) => {
      const frameX = frame.x;
      const frameWidth = frame.width;
      const frameY = frame.depth * this.config.frameHeight;
      const frameHeight = this.config.frameHeight;

      return (
        x >= frameX &&
        x <= frameX + frameWidth &&
        y >= frameY &&
        y <= frameY + frameHeight
      );
    });
  }

  /**
   * Get frames for zoomed region
   */
  getFramesInViewport(
    renderData: FlameGraphRenderData,
    viewport: FlameGraphViewport
  ): FlameFrameData[] {
    return renderData.frames.filter((frame) => {
      const frameRight = frame.x + frame.width;
      const viewportRight = viewport.x + viewport.width;

      return (
        frame.x < viewportRight &&
        frameRight > viewport.x &&
        frame.depth * this.config.frameHeight >= viewport.y
      );
    });
  }

  /**
   * Export to SVG format
   */
  exportToSVG(renderData: FlameGraphRenderData): FlameGraphExport {
    const { frames, totalDepth, totalSamples } = renderData;
    const width = 1200;
    const height = totalDepth * this.config.frameHeight + 60;
    const frameHeight = this.config.frameHeight;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .frame { stroke: #fff; stroke-width: 0.5; }
    .frame:hover { stroke-width: 2; cursor: pointer; }
    .hotspot { stroke: #ef4444; stroke-width: 2; }
    .label { font-family: monospace; font-size: 11px; fill: #000; }
    .title { font-family: sans-serif; font-size: 16px; font-weight: bold; fill: #1f2937; }
  </style>
  <rect width="100%" height="100%" fill="#f3f4f6"/>
  <text x="10" y="25" class="title">Flame Graph - ${totalSamples.toLocaleString()} samples</text>
`;

    frames.forEach((frame) => {
      const x = frame.x * width;
      const frameWidth = Math.max(1, frame.width * width);
      const y = frame.depth * frameHeight + 40;
      const className = frame.isHotSpot ? 'frame hotspot' : 'frame';

      svg += `  <rect class="${className}" x="${x.toFixed(2)}" y="${y}" width="${frameWidth.toFixed(2)}" height="${frameHeight - 2}" fill="${frame.color}">
    <title>${frame.tooltip}</title>
  </rect>\n`;

      // Add label if frame is wide enough
      if (frameWidth > 50) {
        const label = this.truncateLabel(frame.name, frameWidth);
        svg += `  <text class="label" x="${(x + 3).toFixed(2)}" y="${y + 15}">${label}</text>\n`;
      }
    });

    svg += '</svg>';

    return {
      format: 'svg',
      data: svg,
      metadata: {
        exportedAt: new Date(),
        totalSamples,
        totalTime: totalSamples * 1000,
        appName: 'Kyro IDE',
        version: '1.0.0',
      },
    };
  }

  /**
   * Export to JSON format
   */
  exportToJSON(renderData: FlameGraphRenderData): FlameGraphExport {
    const jsonData = {
      frames: renderData.frames.map((f) => ({
        name: f.name,
        module: f.module,
        x: f.x,
        width: f.width,
        depth: f.depth,
        value: f.totalValue,
        selfValue: f.selfValue,
        percent: f.percent,
        color: f.color,
        category: f.category,
        isHotSpot: f.isHotSpot,
        scriptUrl: f.scriptUrl,
        lineNumber: f.lineNumber,
      })),
      totalDepth: renderData.totalDepth,
      totalSamples: renderData.totalSamples,
      viewport: renderData.viewport,
    };

    return {
      format: 'json',
      data: jsonData,
      metadata: {
        exportedAt: new Date(),
        totalSamples: renderData.totalSamples,
        totalTime: renderData.totalTime,
        appName: 'Kyro IDE',
        version: '1.0.0',
      },
    };
  }

  /**
   * Export to HTML format
   */
  exportToHTML(renderData: FlameGraphRenderData): FlameGraphExport {
    const svgExport = this.exportToSVG(renderData);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flame Graph - Kyro IDE</title>
  <style>
    body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #f3f4f6; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { padding: 20px; border-bottom: 1px solid #e5e7eb; }
    .header h1 { margin: 0 0 8px 0; font-size: 20px; }
    .header p { margin: 0; color: #6b7280; }
    .svg-container { overflow-x: auto; }
    .legend { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; border-top: 1px solid #e5e7eb; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    .legend-color { width: 16px; height: 16px; border-radius: 4px; }
    .legend-label { font-size: 12px; color: #4b5563; }
    .tooltip { position: fixed; background: #1f2937; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-family: monospace; pointer-events: none; z-index: 1000; white-space: pre; display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Flame Graph</h1>
      <p>${renderData.totalSamples.toLocaleString()} samples | Total time: ${(renderData.totalTime / 1000).toFixed(2)}ms</p>
    </div>
    <div class="svg-container">
      ${svgExport.data}
    </div>
    <div class="legend">
      ${renderData.colorLegend.map((l) => `
        <div class="legend-item">
          <div class="legend-color" style="background: ${l.color}"></div>
          <span class="legend-label">${l.label}</span>
        </div>
      `).join('')}
    </div>
  </div>
  <div id="tooltip" class="tooltip"></div>
  <script>
    const tooltip = document.getElementById('tooltip');
    document.querySelectorAll('rect[title]').forEach(el => {
      el.addEventListener('mouseenter', e => {
        tooltip.textContent = el.getAttribute('title');
        tooltip.style.display = 'block';
      });
      el.addEventListener('mousemove', e => {
        tooltip.style.left = e.clientX + 10 + 'px';
        tooltip.style.top = e.clientY + 10 + 'px';
      });
      el.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });
  </script>
</body>
</html>`;

    return {
      format: 'html',
      data: html,
      metadata: {
        exportedAt: new Date(),
        totalSamples: renderData.totalSamples,
        totalTime: renderData.totalTime,
        appName: 'Kyro IDE',
        version: '1.0.0',
      },
    };
  }

  /**
   * Export to collapsed stack format (for external tools)
   */
  exportToCollapsed(samples: ProfileSample[]): FlameGraphExport {
    const lines: string[] = [];

    samples.forEach((sample) => {
      const stack = sample.stack
        .map((f) => f.functionName)
        .reverse()
        .join(';');
      lines.push(`${stack} 1`);
    });

    return {
      format: 'collapsed',
      data: lines.join('\n'),
      metadata: {
        exportedAt: new Date(),
        totalSamples: samples.length,
        totalTime: samples.reduce((sum, s) => sum + s.cpuTime, 0),
        appName: 'Kyro IDE',
        version: '1.0.0',
      },
    };
  }

  /**
   * Export to Chrome CPU Profile format
   */
  exportToCPUProfile(
    samples: ProfileSample[],
    startTime: number
  ): FlameGraphExport {
    const nodes: CPUProfileNode[] = [];
    const nodeIdMap = new Map<string, number>();
    let nextNodeId = 1;

    // Build node tree
    samples.forEach((sample) => {
      let parentId = 0;

      sample.stack.forEach((frame) => {
        const key = frame.hash;
        let nodeId = nodeIdMap.get(key);

        if (!nodeId) {
          nodeId = nextNodeId++;
          nodeIdMap.set(key, nodeId);

          nodes.push({
            id: nodeId,
            callFrame: {
              functionName: frame.functionName,
              scriptId: frame.scriptId,
              url: frame.url || '',
              lineNumber: frame.lineNumber - 1, // 0-based
              columnNumber: frame.columnNumber - 1, // 0-based
            },
            hitCount: 0,
            children: [],
            parent: parentId || undefined,
          });
        }

        // Add child relationship
        if (parentId > 0) {
          const parentNode = nodes.find((n) => n.id === parentId);
          if (parentNode && !parentNode.children.includes(nodeId)) {
            parentNode.children.push(nodeId);
          }
        }

        // Increment hit count for leaf
        if (frame === sample.stack[0]) {
          const node = nodes.find((n) => n.id === nodeId);
          if (node) node.hitCount++;
        }

        parentId = nodeId;
      });
    });

    const profile: CPUProfile = {
      nodes,
      startTime,
      endTime: startTime + samples.reduce((sum, s) => sum + s.cpuTime, 0),
      samples: samples.map((s) => {
        const leafFrame = s.stack[0];
        return nodeIdMap.get(leafFrame?.hash) || 0;
      }),
      timeDeltas: samples.map((s, i) =>
        i === 0 ? 0 : samples[i - 1].cpuTime - s.cpuTime
      ),
    };

    return {
      format: 'cpuprofile',
      data: profile,
      metadata: {
        exportedAt: new Date(),
        totalSamples: samples.length,
        totalTime: samples.reduce((sum, s) => sum + s.cpuTime, 0),
        appName: 'Kyro IDE',
        version: '1.0.0',
      },
    };
  }

  /**
   * Truncate label to fit width
   */
  private truncateLabel(label: string, width: number): string {
    const maxChars = Math.floor(width / 7); // Approximate char width
    if (label.length <= maxChars) return label;
    return label.substring(0, maxChars - 3) + '...';
  }

  /**
   * Compare two flame graphs
   */
  compareFlameGraphs(
    base: FlameGraphRenderData,
    compare: FlameGraphRenderData
  ): FlameGraphDiff {
    const diffFrames: DiffFrame[] = [];
    const functionMap = new Map<string, { base: number; compare: number }>();

    // Collect all functions from base
    base.frames.forEach((frame) => {
      const key = frame.fullName;
      functionMap.set(key, { base: frame.totalValue, compare: 0 });
    });

    // Collect all functions from compare
    compare.frames.forEach((frame) => {
      const key = frame.fullName;
      const existing = functionMap.get(key);
      if (existing) {
        existing.compare = frame.totalValue;
      } else {
        functionMap.set(key, { base: 0, compare: frame.totalValue });
      }
    });

    // Calculate differences
    functionMap.forEach((values, key) => {
      const [module, name] = key.includes('::')
        ? key.split('::')
        : [undefined, key];

      const diff = values.compare - values.base;
      const changePercent =
        values.base > 0 ? (diff / values.base) * 100 : values.compare > 0 ? 100 : 0;

      let type: DiffFrame['type'];
      if (values.base === 0) type = 'added';
      else if (values.compare === 0) type = 'removed';
      else if (changePercent > 10) type = 'increased';
      else if (changePercent < -10) type = 'decreased';
      else type = 'unchanged';

      diffFrames.push({
        name,
        module,
        baseValue: values.base,
        compareValue: values.compare,
        diff,
        changePercent,
        type,
      });
    });

    // Sort by absolute difference
    diffFrames.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    // Calculate summary
    const summary: DiffSummary = {
      baseSamples: base.totalSamples,
      compareSamples: compare.totalSamples,
      sampleChange: compare.totalSamples - base.totalSamples,
      addedFunctions: diffFrames.filter((f) => f.type === 'added').length,
      removedFunctions: diffFrames.filter((f) => f.type === 'removed').length,
      increasedFunctions: diffFrames.filter((f) => f.type === 'increased').length,
      decreasedFunctions: diffFrames.filter((f) => f.type === 'decreased').length,
    };

    return {
      base,
      compare,
      diffFrames,
      summary,
    };
  }
}

// ============================================
// CPU PROFILE TYPES
// ============================================

interface CPUProfileNode {
  id: number;
  callFrame: {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  hitCount: number;
  children: number[];
  parent?: number;
}

interface CPUProfile {
  nodes: CPUProfileNode[];
  startTime: number;
  endTime: number;
  samples: number[];
  timeDeltas: number[];
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let processorInstance: FlameGraphProcessor | null = null;

export function getFlameGraphProcessor(
  config?: Partial<FlameGraphConfig>
): FlameGraphProcessor {
  if (!processorInstance) {
    processorInstance = new FlameGraphProcessor(config);
  }
  return processorInstance;
}

export function resetFlameGraphProcessor(): void {
  processorInstance = null;
}
