import type { Project, SerializedProject } from '../types/project';

const STORAGE_KEY = 'flowlang_project';
const SCHEMA_VERSION = '1.0';

/**
 * Save project to localStorage
 */
export function saveProject(project: Project): void {
  try {
    const serialized: SerializedProject = {
      ...project,
      version: SCHEMA_VERSION,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save project to localStorage:', error);
    // If storage is full, try to clear old data
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded - clearing old data');
      clearProject();
    }
  }
}

/**
 * Load project from localStorage
 */
export function loadProject(): Project | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: SerializedProject = JSON.parse(stored);

    // Handle schema migrations if needed
    if (parsed.version !== SCHEMA_VERSION) {
      console.warn(`Project schema version mismatch: ${parsed.version} !== ${SCHEMA_VERSION}`);
      // Could implement migrations here if needed
    }

    // Validate basic structure
    if (!parsed.metadata || !parsed.flows) {
      console.error('Invalid project structure in localStorage');
      return null;
    }

    return {
      metadata: parsed.metadata,
      flows: parsed.flows,
      currentFlowId: parsed.currentFlowId,
    };
  } catch (error) {
    console.error('Failed to load project from localStorage:', error);
    return null;
  }
}

/**
 * Clear project from localStorage
 */
export function clearProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear project from localStorage:', error);
  }
}

/**
 * Export project as JSON file
 */
export function exportProjectToFile(project: Project, filename?: string): void {
  try {
    const serialized: SerializedProject = {
      ...project,
      version: SCHEMA_VERSION,
    };

    const jsonString = JSON.stringify(serialized, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${project.metadata.name.replace(/\s+/g, '_')}_project.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export project to file:', error);
    throw new Error('Failed to export project');
  }
}

/**
 * Import project from JSON file
 */
export function importProjectFromFile(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed: SerializedProject = JSON.parse(content);

        // Validate structure
        if (!parsed.metadata || !parsed.flows) {
          throw new Error('Invalid project file structure');
        }

        // Handle schema migrations if needed
        if (parsed.version && parsed.version !== SCHEMA_VERSION) {
          console.warn(`Importing project with different schema version: ${parsed.version}`);
          // Could implement migrations here
        }

        const project: Project = {
          metadata: parsed.metadata,
          flows: parsed.flows,
          currentFlowId: parsed.currentFlowId,
        };

        resolve(project);
      } catch (error) {
        reject(new Error(`Failed to parse project file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read project file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Get storage usage information
 */
export function getStorageInfo(): { used: number; available: number; percentage: number } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const used = stored ? new Blob([stored]).size : 0;

    // Most browsers have a 5-10MB limit for localStorage
    // We'll assume 5MB as a conservative estimate
    const available = 5 * 1024 * 1024; // 5MB in bytes

    return {
      used,
      available,
      percentage: (used / available) * 100,
    };
  } catch (error) {
    return { used: 0, available: 0, percentage: 0 };
  }
}
