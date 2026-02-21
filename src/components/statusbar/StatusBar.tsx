'use client';

import React, { useState, useCallback } from 'react';
import {
  GitBranch,
  AlertCircle,
  AlertTriangle,
  Bell,
  Wifi,
  WifiOff,
  Cpu,
  Database,
  Bot,
  Check,
  Loader2,
  Settings,
  RefreshCw,
  Zap
} from 'lucide-react';

// Types
export interface StatusBarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  tooltip?: string;
  onClick?: () => void;
  type?: 'info' | 'warning' | 'error' | 'success' | 'loading';
}

export interface StatusBarProps {
  items?: {
    left?: StatusBarItem[];
    right?: StatusBarItem[];
  };
  line?: number;
  column?: number;
  selectedLines?: number;
  encoding?: string;
  lineEnding?: 'LF' | 'CRLF';
  language?: string;
  gitBranch?: string;
  errors?: number;
  warnings?: number;
  aiModel?: string;
  aiStatus?: 'ready' | 'loading' | 'error' | 'offline';
  memoryUsage?: number;
  cpuUsage?: number;
  isConnected?: boolean;
  onNotificationClick?: () => void;
  onSettingsClick?: () => void;
  className?: string;
}

// Status Bar Item Component
interface StatusBarItemComponentProps {
  item: StatusBarItem;
}

const StatusBarItemComponent: React.FC<StatusBarItemComponentProps> = ({ item }) => {
  const colorClass = {
    info: 'text-gray-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
    success: 'text-green-400',
    loading: 'text-blue-400',
  }[item.type || 'info'];

  return (
    <button
      onClick={item.onClick}
      className={`
        flex items-center gap-1 px-2 py-0.5 h-full
        hover:bg-[#3c3c3c] transition-colors
        ${item.onClick ? 'cursor-pointer' : 'cursor-default'}
        ${colorClass}
      `}
      title={item.tooltip || item.label}
    >
      {item.type === 'loading' && <Loader2 size={12} className="animate-spin" />}
      {item.icon}
      <span className="text-xs">{item.label}</span>
    </button>
  );
};

// Main Status Bar Component
export const StatusBar: React.FC<StatusBarProps> = ({
  items,
  line = 1,
  column = 1,
  selectedLines,
  encoding = 'UTF-8',
  lineEnding = 'LF',
  language = 'TypeScript',
  gitBranch = 'main',
  errors = 0,
  warnings = 0,
  aiModel = 'Llama 3.2',
  aiStatus = 'ready',
  memoryUsage,
  cpuUsage,
  isConnected = true,
  onNotificationClick,
  onSettingsClick,
  className = '',
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  // Default left items
  const defaultLeftItems: StatusBarItem[] = [
    {
      id: 'git',
      label: gitBranch,
      icon: <GitBranch size={12} />,
      tooltip: `Branch: ${gitBranch}`,
      onClick: () => {},
    },
    {
      id: 'errors',
      label: errors.toString(),
      icon: <AlertCircle size={12} className="text-red-400" />,
      tooltip: `${errors} Errors`,
      type: errors > 0 ? 'error' : 'info',
      onClick: () => {},
    },
    {
      id: 'warnings',
      label: warnings.toString(),
      icon: <AlertTriangle size={12} className="text-yellow-400" />,
      tooltip: `${warnings} Warnings`,
      type: warnings > 0 ? 'warning' : 'info',
      onClick: () => {},
    },
  ];

  // Default right items
  const defaultRightItems: StatusBarItem[] = [
    {
      id: 'ai',
      label: aiModel,
      icon: aiStatus === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />,
      tooltip: `AI Model: ${aiModel}`,
      type: aiStatus === 'ready' ? 'success' : aiStatus === 'loading' ? 'loading' : aiStatus === 'error' ? 'error' : 'info',
      onClick: () => {},
    },
    {
      id: 'language',
      label: language,
      tooltip: `Language: ${language}`,
      onClick: () => {},
    },
    {
      id: 'encoding',
      label: encoding,
      tooltip: `Encoding: ${encoding}`,
      onClick: () => {},
    },
    {
      id: 'lineEnding',
      label: lineEnding,
      tooltip: `Line Ending: ${lineEnding}`,
      onClick: () => {},
    },
    {
      id: 'position',
      label: selectedLines ? `Ln ${line}, Col ${column} (${selectedLines} selected)` : `Ln ${line}, Col ${column}`,
      tooltip: 'Cursor Position',
    },
  ];

  const leftItems = items?.left || defaultLeftItems;
  const rightItems = items?.right || defaultRightItems;

  return (
    <div className={`flex items-center justify-between h-6 bg-[#007acc] text-white ${className}`}>
      {/* Left Section */}
      <div className="flex items-center h-full">
        {leftItems.map((item) => (
          <StatusBarItemComponent key={item.id} item={item} />
        ))}

        {/* Connection Status */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 h-full hover:bg-[#1a8cdb] cursor-pointer"
          title={isConnected ? 'Connected' : 'Disconnected'}
        >
          {isConnected ? (
            <Wifi size={12} />
          ) : (
            <WifiOff size={12} className="text-red-300" />
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center h-full">
        {/* Performance Indicators */}
        {memoryUsage !== undefined && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 h-full hover:bg-[#1a8cdb] cursor-pointer"
            title={`Memory: ${memoryUsage} MB`}
          >
            <Database size={12} />
            <span className="text-xs">{memoryUsage} MB</span>
          </div>
        )}

        {cpuUsage !== undefined && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 h-full hover:bg-[#1a8cdb] cursor-pointer"
            title={`CPU: ${cpuUsage}%`}
          >
            <Cpu size={12} />
            <span className="text-xs">{cpuUsage}%</span>
          </div>
        )}

        {rightItems.map((item) => (
          <StatusBarItemComponent key={item.id} item={item} />
        ))}

        {/* Notifications */}
        <button
          onClick={() => {
            setShowNotifications(!showNotifications);
            onNotificationClick?.();
          }}
          className="flex items-center gap-1 px-2 py-0.5 h-full hover:bg-[#1a8cdb]"
          title="Notifications"
        >
          <Bell size={12} />
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="flex items-center gap-1 px-2 py-0.5 h-full hover:bg-[#1a8cdb]"
          title="Settings"
        >
          <Settings size={12} />
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
