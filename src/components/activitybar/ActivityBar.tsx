'use client';

import React, { useState, useCallback } from 'react';
import {
  Files,
  Search,
  GitBranch,
  Bug,
  Puzzle,
  Settings,
  User,
  Bot,
  Terminal,
  History,
  LucideIcon
} from 'lucide-react';

// Types
export interface ActivityBarItem {
  id: string;
  icon: LucideIcon;
  label: string;
  badge?: number | string;
  disabled?: boolean;
}

export interface ActivityBarProps {
  items?: ActivityBarItem[];
  activeItem?: string;
  onItemSelect?: (id: string) => void;
  bottomItems?: ActivityBarItem[];
  className?: string;
}

// Default items
const DEFAULT_ITEMS: ActivityBarItem[] = [
  { id: 'explorer', icon: Files, label: 'Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'git', icon: GitBranch, label: 'Source Control', badge: 3 },
  { id: 'debug', icon: Bug, label: 'Run and Debug' },
  { id: 'ai', icon: Bot, label: 'AI Assistant' },
  { id: 'extensions', icon: Puzzle, label: 'Extensions' },
];

const DEFAULT_BOTTOM_ITEMS: ActivityBarItem[] = [
  { id: 'history', icon: History, label: 'History' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

// Activity Bar Item Component
interface ActivityBarItemComponentProps {
  item: ActivityBarItem;
  isActive: boolean;
  onClick: () => void;
}

const ActivityBarItemComponent: React.FC<ActivityBarItemComponentProps> = ({
  item,
  isActive,
  onClick
}) => {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      disabled={item.disabled}
      className={`
        relative w-12 h-12 flex items-center justify-center
        transition-colors duration-150
        ${isActive
          ? 'text-white bg-[#37373d]'
          : 'text-gray-400 hover:text-gray-200'
        }
        ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        group
      `}
      title={item.label}
    >
      <Icon size={24} strokeWidth={1.5} />

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white" />
      )}

      {/* Badge */}
      {item.badge !== undefined && (
        <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-[#007acc] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {item.badge}
        </span>
      )}

      {/* Tooltip */}
      <div className="
        absolute left-full ml-2 px-2 py-1
        bg-[#1e1e1e] border border-[#3c3c3c]
        text-sm text-gray-200 whitespace-nowrap
        rounded shadow-lg
        opacity-0 pointer-events-none
        group-hover:opacity-100 group-hover:pointer-events-auto
        transition-opacity duration-150
        z-50
      ">
        {item.label}
      </div>
    </button>
  );
};

// Main Activity Bar Component
export const ActivityBar: React.FC<ActivityBarProps> = ({
  items = DEFAULT_ITEMS,
  activeItem: controlledActiveItem,
  onItemSelect,
  bottomItems = DEFAULT_BOTTOM_ITEMS,
  className = '',
}) => {
  const [internalActiveItem, setInternalActiveItem] = useState<string>(items[0]?.id || '');

  // Use controlled or internal state
  const activeItem = controlledActiveItem ?? internalActiveItem;

  // Handle item click
  const handleClick = useCallback((id: string) => {
    if (onItemSelect) {
      onItemSelect(id);
    } else {
      setInternalActiveItem(id);
    }
  }, [onItemSelect]);

  return (
    <div className={`flex flex-col h-full bg-[#181818] border-r border-[#3c3c3c] ${className}`}>
      {/* Top Items */}
      <div className="flex-1 flex flex-col">
        {items.map((item) => (
          <ActivityBarItemComponent
            key={item.id}
            item={item}
            isActive={activeItem === item.id}
            onClick={() => handleClick(item.id)}
          />
        ))}
      </div>

      {/* Bottom Items */}
      <div className="flex flex-col">
        {bottomItems.map((item) => (
          <ActivityBarItemComponent
            key={item.id}
            item={item}
            isActive={activeItem === item.id}
            onClick={() => handleClick(item.id)}
          />
        ))}

        {/* User Avatar */}
        <div className="w-12 h-12 flex items-center justify-center">
          <button
            className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm hover:ring-2 hover:ring-purple-400 transition-all"
            title="Account"
          >
            U
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityBar;
