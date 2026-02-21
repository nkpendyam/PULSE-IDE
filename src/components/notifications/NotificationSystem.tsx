'use client';

import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import {
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Bell,
  Loader2
} from 'lucide-react';

// Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title: string;
  message?: string;
  duration?: number;
  actions?: {
    label: string;
    onClick: () => void;
  }[];
  progress?: number;
  persistent?: boolean;
}

export interface NotificationSystemProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'bottom-center';
  maxNotifications?: number;
  className?: string;
}

// Context for notifications
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Hook for using notifications
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Provider Component
export const NotificationProvider: React.FC<{
  children: React.ReactNode;
  position?: NotificationSystemProps['position'];
  maxNotifications?: number;
}> = ({ children, position = 'bottom-right', maxNotifications = 5 }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>): string => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? (notification.type === 'loading' ? 0 : 5000),
    };

    setNotifications((prev) => {
      const updated = [...prev, newNotification];
      if (updated.length > maxNotifications) {
        return updated.slice(-maxNotifications);
      }
      return updated;
    });

    return id;
  }, [maxNotifications]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    );
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification, clearAll, updateNotification }}
    >
      {children}
      <NotificationSystem
        notifications={notifications}
        position={position}
        onRemove={removeNotification}
      />
    </NotificationContext.Provider>
  );
};

// Notification Item Component
interface NotificationItemProps {
  notification: Notification;
  onRemove: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  // Auto-remove
  useEffect(() => {
    if (notification.duration && notification.duration > 0 && !notification.persistent) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onRemove, 300);
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.duration, notification.persistent, onRemove]);

  // Get icon and colors
  const getTypeConfig = () => {
    switch (notification.type) {
      case 'success':
        return {
          icon: <CheckCircle size={20} />,
          iconColor: 'text-green-400',
          borderColor: 'border-l-green-400',
          bgColor: 'bg-[#1e4620]',
        };
      case 'error':
        return {
          icon: <AlertCircle size={20} />,
          iconColor: 'text-red-400',
          borderColor: 'border-l-red-400',
          bgColor: 'bg-[#4a1e1e]',
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={20} />,
          iconColor: 'text-yellow-400',
          borderColor: 'border-l-yellow-400',
          bgColor: 'bg-[#4a4a1e]',
        };
      case 'loading':
        return {
          icon: <Loader2 size={20} className="animate-spin" />,
          iconColor: 'text-blue-400',
          borderColor: 'border-l-blue-400',
          bgColor: 'bg-[#1e3a4a]',
        };
      default:
        return {
          icon: <Info size={20} />,
          iconColor: 'text-blue-400',
          borderColor: 'border-l-blue-400',
          bgColor: 'bg-[#1e1e1e]',
        };
    }
  };

  const config = getTypeConfig();

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onRemove, 300);
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-r shadow-lg
        border-l-4 ${config.borderColor} ${config.bgColor}
        transform transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
    >
      {/* Icon */}
      <span className={config.iconColor}>{config.icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{notification.title}</p>
        {notification.message && (
          <p className="mt-1 text-xs text-gray-300">{notification.message}</p>
        )}

        {/* Progress Bar */}
        {notification.progress !== undefined && (
          <div className="mt-2 h-1 bg-gray-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 transition-all duration-300"
              style={{ width: `${notification.progress}%` }}
            />
          </div>
        )}

        {/* Actions */}
        {notification.actions && notification.actions.length > 0 && (
          <div className="flex gap-2 mt-2">
            {notification.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                  handleClose();
                }}
                className="px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-white"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="p-1 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// Notification System Component
export const NotificationSystem: React.FC<{
  notifications: Notification[];
  position?: NotificationSystemProps['position'];
  onRemove: (id: string) => void;
  className?: string;
}> = ({ notifications, position = 'bottom-right', onRemove, className = '' }) => {
  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={`fixed z-50 flex flex-col gap-2 max-w-sm w-full ${positionClasses[position]} ${className}`}
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={() => onRemove(notification.id)}
        />
      ))}
    </div>
  );
};

// Standalone Notifications Component (for use without provider)
export const Notifications: React.FC<NotificationSystemProps & {
  notifications: Notification[];
  onRemove: (id: string) => void;
}> = ({ notifications, onRemove, position = 'bottom-right', maxNotifications = 5, className = '' }) => {
  return (
    <NotificationSystem
      notifications={notifications.slice(-maxNotifications)}
      position={position}
      onRemove={onRemove}
      className={className}
    />
  );
};

export default NotificationSystem;
