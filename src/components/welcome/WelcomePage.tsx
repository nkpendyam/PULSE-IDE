'use client';

import React, { useState } from 'react';
import {
  FolderOpen,
  FileCode,
  GitBranch,
  Clock,
  Star,
  ArrowRight,
  Book,
  Puzzle,
  Settings,
  Zap,
  Bot,
  Github,
  ExternalLink,
  Heart
} from 'lucide-react';

// Types
interface RecentProject {
  id: string;
  name: string;
  path: string;
  lastOpened: Date;
  gitBranch?: string;
}

interface WelcomePageProps {
  recentProjects?: RecentProject[];
  onOpenProject?: () => void;
  onOpenFile?: () => void;
  onCloneRepo?: () => void;
  onSelectProject?: (project: RecentProject) => void;
  version?: string;
  className?: string;
}

// Default recent projects
const DEFAULT_RECENT_PROJECTS: RecentProject[] = [
  { id: '1', name: 'KYRO-IDE', path: '/home/user/projects/kyro-ide', lastOpened: new Date(), gitBranch: 'main' },
  { id: '2', name: 'my-nextjs-app', path: '/home/user/projects/my-nextjs-app', lastOpened: new Date(Date.now() - 86400000), gitBranch: 'develop' },
  { id: '3', name: 'api-server', path: '/home/user/projects/api-server', lastOpened: new Date(Date.now() - 172800000) },
];

// Quick Start Actions
const QUICK_START_ACTIONS = [
  {
    id: 'new-file',
    icon: FileCode,
    label: 'New File',
    description: 'Create a new file',
    shortcut: 'Ctrl+N',
  },
  {
    id: 'open-folder',
    icon: FolderOpen,
    label: 'Open Folder',
    description: 'Open a local folder',
    shortcut: 'Ctrl+K Ctrl+O',
  },
  {
    id: 'clone-repo',
    icon: GitBranch,
    label: 'Clone Repository',
    description: 'Clone from Git URL',
    shortcut: 'Ctrl+Shift+G',
  },
];

// Help Links
const HELP_LINKS = [
  {
    id: 'docs',
    icon: Book,
    label: 'Documentation',
    description: 'Learn how to use Kyro IDE',
    href: '#',
  },
  {
    id: 'extensions',
    icon: Puzzle,
    label: 'Extensions',
    description: 'Customize with extensions',
    href: '#',
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings',
    description: 'Configure your IDE',
    href: '#',
  },
  {
    id: 'shortcuts',
    icon: Zap,
    label: 'Keyboard Shortcuts',
    description: 'Speed up your workflow',
    href: '#',
  },
];

// Getting Started Steps
const GETTING_STARTED = [
  {
    step: 1,
    title: 'Open a Project',
    description: 'Open a folder to start editing files and using AI assistance.',
  },
  {
    step: 2,
    title: 'Configure AI Models',
    description: 'Set up Ollama for local AI or connect to cloud providers.',
  },
  {
    step: 3,
    title: 'Start Coding',
    description: 'Use the AI assistant to write, refactor, and debug your code.',
  },
];

// Welcome Page Component
export const WelcomePage: React.FC<WelcomePageProps> = ({
  recentProjects = DEFAULT_RECENT_PROJECTS,
  onOpenProject,
  onOpenFile,
  onCloneRepo,
  onSelectProject,
  version = '1.0.0',
  className = '',
}) => {
  const [showAllRecent, setShowAllRecent] = useState(false);

  const displayedProjects = showAllRecent ? recentProjects : recentProjects.slice(0, 5);

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'new-file':
        onOpenFile?.();
        break;
      case 'open-folder':
        onOpenProject?.();
        break;
      case 'clone-repo':
        onCloneRepo?.();
        break;
    }
  };

  return (
    <div className={`flex flex-col h-full overflow-auto bg-[#1e1e1e] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Bot size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Kyro IDE</h1>
            <p className="text-sm text-gray-400">Open Source AI-Powered IDE v{version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/nkpendyam/KYRO-IDE"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#2d2d2d] rounded"
          >
            <Github size={14} />
            GitHub
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-8 py-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Quick Start & Recent */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Start */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Start
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {QUICK_START_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action.id)}
                    className="flex items-center gap-3 p-4 bg-[#2d2d2d] hover:bg-[#3c3c3c] rounded-lg text-left transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1e1e1e] flex items-center justify-center">
                      <action.icon size={20} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{action.label}</p>
                      <p className="text-xs text-gray-500">{action.shortcut}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Recent Projects */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Recent
              </h2>
              <div className="bg-[#2d2d2d] rounded-lg overflow-hidden">
                {displayedProjects.length > 0 ? (
                  <>
                    {displayedProjects.map((project, index) => (
                      <button
                        key={project.id}
                        onClick={() => onSelectProject?.(project)}
                        className={`w-full flex items-center gap-3 p-3 hover:bg-[#3c3c3c] text-left transition-colors ${
                          index !== displayedProjects.length - 1 ? 'border-b border-[#3c3c3c]' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded bg-[#1e1e1e] flex items-center justify-center shrink-0">
                          <FolderOpen size={16} className="text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{project.name}</p>
                          <p className="text-xs text-gray-500 truncate">{project.path}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
                          {project.gitBranch && (
                            <span className="flex items-center gap-1">
                              <GitBranch size={10} />
                              {project.gitBranch}
                            </span>
                          )}
                          <span>
                            {project.lastOpened.toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    ))}
                    {recentProjects.length > 5 && (
                      <button
                        onClick={() => setShowAllRecent(!showAllRecent)}
                        className="w-full p-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-[#3c3c3c] text-center"
                      >
                        {showAllRecent ? 'Show Less' : `Show All (${recentProjects.length})`}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No recent projects
                  </div>
                )}
              </div>
            </section>

            {/* Getting Started */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Getting Started
              </h2>
              <div className="space-y-3">
                {GETTING_STARTED.map((item) => (
                  <div
                    key={item.step}
                    className="flex items-start gap-3 p-3 bg-[#2d2d2d] rounded-lg"
                  >
                    <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-gray-400">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column - Help & Info */}
          <div className="space-y-6">
            {/* Help Links */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Help
              </h2>
              <div className="bg-[#2d2d2d] rounded-lg overflow-hidden">
                {HELP_LINKS.map((link, index) => (
                  <a
                    key={link.id}
                    href={link.href}
                    className={`flex items-center gap-3 p-3 hover:bg-[#3c3c3c] transition-colors ${
                      index !== HELP_LINKS.length - 1 ? 'border-b border-[#3c3c3c]' : ''
                    }`}
                  >
                    <link.icon size={16} className="text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{link.label}</p>
                      <p className="text-xs text-gray-500">{link.description}</p>
                    </div>
                    <ArrowRight size={14} className="text-gray-500" />
                  </a>
                ))}
              </div>
            </section>

            {/* Features */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Features
              </h2>
              <div className="bg-[#2d2d2d] rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm text-gray-300">Multi-Agent AI System</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-sm text-gray-300">Local LLM Support (Ollama)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="text-sm text-gray-300">Privacy-First Design</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-sm text-gray-300">No Usage Limits</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pink-400" />
                  <span className="text-sm text-gray-300">Open Source (MIT)</span>
                </div>
              </div>
            </section>

            {/* Keyboard Shortcuts */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Keyboard Shortcuts
              </h2>
              <div className="bg-[#2d2d2d] rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Command Palette</span>
                  <span className="text-gray-500">Ctrl+Shift+P</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Quick Open</span>
                  <span className="text-gray-500">Ctrl+P</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Toggle Terminal</span>
                  <span className="text-gray-500">Ctrl+`</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Toggle Sidebar</span>
                  <span className="text-gray-500">Ctrl+B</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">AI Assistant</span>
                  <span className="text-gray-500">Ctrl+I</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t border-[#3c3c3c]">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span>Made with</span>
            <Heart size={12} className="text-red-400" />
            <span>by the Kyro IDE Team</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-gray-400">Privacy</a>
            <a href="#" className="hover:text-gray-400">Terms</a>
            <a href="#" className="hover:text-gray-400">License</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
