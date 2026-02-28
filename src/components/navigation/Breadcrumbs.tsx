'use client';

import React from 'react';
import { ChevronRight, File, Folder, GitBranch } from 'lucide-react';
import { useKyroStore } from '@/store/kyroStore';

interface BreadcrumbItem {
  name: string;
  path: string;
  type: 'folder' | 'file' | 'symbol';
}

interface BreadcrumbsProps {
  className?: string;
}

export function Breadcrumbs({ className = '' }: BreadcrumbsProps) {
  const { projectPath, openFiles, activeFileIndex, currentScope } = useKyroStore();
  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

  if (!currentFile && !projectPath) return null;

  // Build breadcrumb items from path
  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];

    if (projectPath) {
      const projectParts = projectPath.split('/');
      items.push({
        name: projectParts[projectParts.length - 1] || 'Project',
        path: projectPath,
        type: 'folder'
      });
    }

    if (currentFile) {
      // Get relative path
      const relativePath = projectPath 
        ? currentFile.path.replace(projectPath, '').replace(/^\//, '')
        : currentFile.path;

      const pathParts = relativePath.split('/');
      
      pathParts.forEach((part, index) => {
        if (index === pathParts.length - 1) {
          // Last part is the file
          items.push({
            name: part,
            path: currentFile.path,
            type: 'file'
          });
        } else {
          // Intermediate folders
          items.push({
            name: part,
            path: projectPath + '/' + pathParts.slice(0, index + 1).join('/'),
            type: 'folder'
          });
        }
      });

      // Add current scope (function/class) if available
      if (currentScope) {
        items.push({
          name: currentScope.name,
          path: `${currentFile.path}#${currentScope.name}`,
          type: 'symbol'
        });
      }
    }

    return items;
  };

  const breadcrumbs = buildBreadcrumbs();

  // Handle click on breadcrumb
  const handleClick = (item: BreadcrumbItem) => {
    // Could open folder in file tree or navigate
    console.log('Navigate to:', item.path);
  };

  return (
    <div className={`flex items-center h-6 px-3 bg-[#161b22] border-b border-[#30363d] text-xs ${className}`}>
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && (
            <ChevronRight size={12} className="mx-1 text-[#484f58]" />
          )}
          <button
            onClick={() => handleClick(item)}
            className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
          >
            {item.type === 'folder' && <Folder size={12} />}
            {item.type === 'file' && <File size={12} />}
            {item.type === 'symbol' && <GitBranch size={12} className="text-[#58a6ff]" />}
            <span className="max-w-[150px] truncate">{item.name}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
