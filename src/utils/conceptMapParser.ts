/**
 * Concept Map Parser
 * Parses AI-generated concept map responses into structured graph data
 */

import { ConceptMap, ConceptMapNode, ConceptMapLink } from '../types';

/**
 * Parse concept map from AI markdown/text response
 * Expected format: Hierarchical bullet points with relationships indicated by arrows (->)
 *
 * Example:
 * # Topic Name
 * - Main Concept
 *   - Sub-concept 1 -> depends on -> Base Concept
 *   - Sub-concept 2
 */
export function parseConceptMapFromText(text: string, title: string = 'Concept Map'): ConceptMap {
  const nodes = new Map<string, ConceptMapNode>();
  const links: ConceptMapLink[] = [];
  let rootNodeId = '';

  const lines = text.split('\n').filter((line) => line.trim());

  // Extract nodes from markdown
  let currentLevel = 0;
  let parentStack: string[] = [];

  lines.forEach((line) => {
    // Skip headers and empty lines
    if (line.startsWith('#') || !line.trim()) return;

    // Calculate indentation level
    const indentMatch = line.match(/^(\s*)-\s*/);
    if (!indentMatch) return;

    const indent = indentMatch[1].length / 2; // Assuming 2 spaces per level
    const content = line.replace(/^(\s*)-\s*/, '').trim();

    // Parse relationships (node -> relationship -> other node)
    const relationshipMatch = content.match(/^(.+?)\s*->\s*(.+?)\s*->\s*(.+)$/);

    if (relationshipMatch) {
      const [, fromNode, relationship, toNode] = relationshipMatch;
      const fromId = sanitizeId(fromNode.trim());
      const toId = sanitizeId(toNode.trim());

      createNodeIfNotExists(nodes, fromId, fromNode.trim());
      createNodeIfNotExists(nodes, toId, toNode.trim());

      links.push({
        from: fromId,
        to: toId,
        relationship: relationship.trim(),
      });
    } else {
      // Regular node
      const nodeId = sanitizeId(content);
      createNodeIfNotExists(nodes, nodeId, content);

      // Set root node (first node at level 0)
      if (indent === 0 && !rootNodeId) {
        rootNodeId = nodeId;
      }

      // Establish parent-child relationships based on indentation
      if (indent > 0 && parentStack.length > 0) {
        const parentId = parentStack[indent - 1];
        const parentNode = nodes.get(parentId);
        if (parentNode && !parentNode.children.includes(nodeId)) {
          parentNode.children.push(nodeId);
        }
      }

      // Update parent stack
      parentStack[indent] = nodeId;
      parentStack = parentStack.slice(0, indent + 1);
    }
  });

  // If no root node found, use the first node
  if (!rootNodeId && nodes.size > 0) {
    rootNodeId = Array.from(nodes.keys())[0];
  }

  const rootNode = nodes.get(rootNodeId) || createDefaultRootNode(title);

  return {
    id: `conceptmap_${Date.now()}`,
    title,
    rootNode,
    allNodes: Object.fromEntries(nodes),
    links,
    topic: title,
  };
}

/**
 * Create a concept map from structured JSON
 * Useful for programmatic generation
 */
export function createConceptMapFromStructure(
  title: string,
  structure: {
    label: string;
    children?: any[];
    related?: string[];
    description?: string;
  }
): ConceptMap {
  const nodes = new Map<string, ConceptMapNode>();
  const links: ConceptMapLink[] = [];

  function processNode(data: any, parentId?: string): string {
    const nodeId = sanitizeId(data.label);

    if (!nodes.has(nodeId)) {
      const node: ConceptMapNode = {
        id: nodeId,
        label: data.label,
        description: data.description,
        children: [],
        relatedTo: [],
        examples: data.examples || [],
        formulas: data.formulas || [],
      };

      nodes.set(nodeId, node);

      // Add parent-child relationship
      if (parentId) {
        const parent = nodes.get(parentId);
        if (parent && !parent.children.includes(nodeId)) {
          parent.children.push(nodeId);
        }

        links.push({
          from: parentId,
          to: nodeId,
          relationship: 'contains',
        });
      }

      // Process children
      if (data.children && Array.isArray(data.children)) {
        data.children.forEach((child: any) => {
          processNode(child, nodeId);
        });
      }

      // Process related concepts
      if (data.related && Array.isArray(data.related)) {
        data.related.forEach((related: string) => {
          const relatedId = sanitizeId(related);
          if (!nodes.has(relatedId)) {
            createNodeIfNotExists(nodes, relatedId, related);
          }
          node.relatedTo.push(relatedId);
          links.push({
            from: nodeId,
            to: relatedId,
            relationship: 'related to',
          });
        });
      }
    }

    return nodeId;
  }

  const rootNodeId = processNode(structure);
  const rootNode = nodes.get(rootNodeId) || createDefaultRootNode(title);

  return {
    id: `conceptmap_${Date.now()}`,
    title,
    rootNode,
    allNodes: Object.fromEntries(nodes),
    links,
    topic: title,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function sanitizeId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
}

function createNodeIfNotExists(nodes: Map<string, ConceptMapNode>, id: string, label: string) {
  if (!nodes.has(id)) {
    nodes.set(id, {
      id,
      label,
      children: [],
      relatedTo: [],
    });
  }
}

function createDefaultRootNode(title: string): ConceptMapNode {
  return {
    id: sanitizeId(title),
    label: title,
    children: [],
    relatedTo: [],
  };
}

/**
 * Expand a node in the concept map
 */
export function expandNode(conceptMap: ConceptMap, nodeId: string): ConceptMapNode[] {
  const node = conceptMap.allNodes[nodeId];
  if (!node) return [];

  return node.children.map((childId) => conceptMap.allNodes[childId]).filter(Boolean);
}

/**
 * Get path from root to a specific node
 */
export function getPathToNode(conceptMap: ConceptMap, targetNodeId: string): string[] {
  const path: string[] = [];
  const visited = new Set<string>();

  function traverse(nodeId: string): boolean {
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    path.push(nodeId);

    if (nodeId === targetNodeId) return true;

    const node = conceptMap.allNodes[nodeId];
    if (node) {
      for (const childId of node.children) {
        if (traverse(childId)) return true;
      }
    }

    path.pop();
    return false;
  }

  traverse(conceptMap.rootNode.id);
  return path;
}
