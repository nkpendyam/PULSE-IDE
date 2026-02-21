'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Smartphone,
  MessageSquare,
  Phone,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Wifi,
  WifiOff,
  Bell,
  MoreHorizontal
} from 'lucide-react';

// Types
export interface MessagingConfig {
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack';
  enabled: boolean;
  connected: boolean;
  botToken?: string;
  phoneNumber?: string;
  webhookUrl?: string;
  chatId?: string;
}

export interface MessagingMessage {
  id: string;
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'ide';
  direction: 'incoming' | 'outgoing';
  sender: string;
  content: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface MessagingPanelProps {
  configs?: MessagingConfig[];
  messages?: MessagingMessage[];
  onSend?: (platform: string, message: string, recipient: string) => void;
  onConfigUpdate?: (platform: string, config: Partial<MessagingConfig>) => void;
  onConnect?: (platform: string) => Promise<boolean>;
  onDisconnect?: (platform: string) => void;
  className?: string;
}

// Platform colors and icons
const PLATFORM_CONFIG = {
  telegram: { color: 'bg-blue-500', icon: Send, label: 'Telegram' },
  whatsapp: { color: 'bg-green-500', icon: Phone, label: 'WhatsApp' },
  discord: { color: 'bg-purple-500', icon: MessageSquare, label: 'Discord' },
  slack: { color: 'bg-orange-500', icon: MessageSquare, label: 'Slack' },
};

// Default configurations
const DEFAULT_CONFIGS: MessagingConfig[] = [
  { platform: 'telegram', enabled: false, connected: false },
  { platform: 'whatsapp', enabled: false, connected: false },
  { platform: 'discord', enabled: false, connected: false },
  { platform: 'slack', enabled: false, connected: false },
];

// Configuration Modal
const ConfigModal: React.FC<{
  platform: MessagingConfig;
  onSave: (config: Partial<MessagingConfig>) => void;
  onClose: () => void;
}> = ({ platform, onSave, onClose }) => {
  const [botToken, setBotToken] = useState(platform.botToken || '');
  const [phoneNumber, setPhoneNumber] = useState(platform.phoneNumber || '');
  const [chatId, setChatId] = useState(platform.chatId || '');

  const config = PLATFORM_CONFIG[platform.platform];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e1e] rounded-lg shadow-xl w-full max-w-md border border-[#3c3c3c]">
        <div className={`flex items-center gap-3 p-4 ${config.color} rounded-t-lg`}>
          <config.icon size={24} className="text-white" />
          <span className="text-lg font-semibold text-white">{config.label} Setup</span>
        </div>

        <div className="p-4 space-y-4">
          {platform.platform === 'telegram' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bot Token</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Get from @BotFather on Telegram</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Chat ID</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="Your chat ID or group ID"
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white text-sm"
                />
              </div>
            </>
          )}

          {platform.platform === 'whatsapp' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">API Key</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Your WhatsApp Business API key"
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white text-sm"
                />
              </div>
            </>
          )}

          {platform.platform === 'discord' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bot Token</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Your Discord bot token"
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Webhook URL</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white text-sm"
                />
              </div>
            </>
          )}

          {(platform.platform === 'slack') && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Webhook URL</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-[#3c3c3c]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({ botToken, phoneNumber, chatId, enabled: true });
              onClose();
            }}
            className="flex-1 px-4 py-2 bg-[#007acc] hover:bg-[#1a8cdb] rounded text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Message Bubble Component
const MessageBubble: React.FC<{ message: MessagingMessage }> = ({ message }) => {
  const isIncoming = message.direction === 'incoming';

  return (
    <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} mb-2`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isIncoming
            ? 'bg-[#2d2d2d] text-gray-200'
            : 'bg-[#007acc] text-white'
        }`}
      >
        {!isIncoming && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs opacity-70">
              via {PLATFORM_CONFIG[message.platform]?.label || 'IDE'}
            </span>
          </div>
        )}
        {isIncoming && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-gray-400">{message.sender}</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-xs opacity-50">
            {message.timestamp.toLocaleTimeString()}
          </span>
          {!isIncoming && (
            <span className="text-xs">
              {message.status === 'sent' && <Check size={12} />}
              {message.status === 'delivered' && <><Check size={12} /><Check size={12} className="-ml-1" /></>}
              {message.status === 'failed' && <AlertCircle size={12} className="text-red-400" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Messaging Panel Component
export const MessagingPanel: React.FC<MessagingPanelProps> = ({
  configs: controlledConfigs,
  messages: controlledMessages,
  onSend,
  onConfigUpdate,
  onConnect,
  onDisconnect,
  className = '',
}) => {
  const [internalConfigs, setInternalConfigs] = useState<MessagingConfig[]>(
    controlledConfigs || DEFAULT_CONFIGS
  );
  const [internalMessages, setInternalMessages] = useState<MessagingMessage[]>(
    controlledMessages || []
  );
  const [inputMessage, setInputMessage] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [configModalPlatform, setConfigModalPlatform] = useState<MessagingConfig | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const configs = controlledConfigs || internalConfigs;
  const messages = controlledMessages || internalMessages;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filter messages by platform
  const filteredMessages = messages.filter(
    (m) => selectedPlatform === 'all' || m.platform === selectedPlatform
  );

  // Handle send message
  const handleSend = useCallback(() => {
    if (!inputMessage.trim()) return;

    const activeConfig = configs.find((c) => c.connected);
    if (!activeConfig) {
      // Add to IDE chat
      const newMessage: MessagingMessage = {
        id: `msg-${Date.now()}`,
        platform: 'ide',
        direction: 'outgoing',
        sender: 'You',
        content: inputMessage,
        timestamp: new Date(),
        status: 'sent',
      };
      setInternalMessages((prev) => [...prev, newMessage]);

      // Simulate AI response
      setTimeout(() => {
        const response: MessagingMessage = {
          id: `msg-${Date.now() + 1}`,
          platform: 'ide',
          direction: 'incoming',
          sender: 'PULSE AI',
          content: `I received your message: "${inputMessage}"\n\nConnect a messaging platform to enable remote AI assistance!`,
          timestamp: new Date(),
          status: 'delivered',
        };
        setInternalMessages((prev) => [...prev, response]);
      }, 1000);
    } else {
      onSend?.(activeConfig.platform, inputMessage, activeConfig.chatId || '');
    }

    setInputMessage('');
  }, [inputMessage, configs, onSend]);

  // Handle connect
  const handleConnect = useCallback(async (platform: string) => {
    setIsConnecting(platform);
    try {
      const success = await onConnect?.(platform) ?? true;
      setInternalConfigs((prev) =>
        prev.map((c) =>
          c.platform === platform ? { ...c, connected: success } : c
        )
      );
    } finally {
      setIsConnecting(null);
    }
  }, [onConnect]);

  // Handle config save
  const handleConfigSave = useCallback((platform: string, config: Partial<MessagingConfig>) => {
    setInternalConfigs((prev) =>
      prev.map((c) =>
        c.platform === platform ? { ...c, ...config } : c
      )
    );
    onConfigUpdate?.(platform, config);
  }, [onConfigUpdate]);

  return (
    <div className={`flex flex-col h-full bg-[#181818] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-purple-400" />
          <span className="text-sm font-medium text-gray-200">Messaging</span>
        </div>
        <div className="flex items-center gap-1">
          {configs.filter((c) => c.connected).length > 0 ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Wifi size={12} />
              {configs.filter((c) => c.connected).length} connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <WifiOff size={12} />
              No connections
            </span>
          )}
        </div>
      </div>

      {/* Platform Tabs */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[#3c3c3c] overflow-x-auto">
        <button
          onClick={() => setSelectedPlatform('all')}
          className={`px-2 py-1 text-xs rounded ${
            selectedPlatform === 'all'
              ? 'bg-[#3c3c3c] text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          All
        </button>
        {configs.map((config) => {
          const platformConfig = PLATFORM_CONFIG[config.platform];
          const Icon = platformConfig.icon;
          return (
            <button
              key={config.platform}
              onClick={() => setSelectedPlatform(config.platform)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                selectedPlatform === config.platform
                  ? 'bg-[#3c3c3c] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={12} />
              {platformConfig.label}
              {config.connected && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Platform Status Cards */}
      <div className="grid grid-cols-2 gap-2 p-2 border-b border-[#3c3c3c]">
        {configs.map((config) => {
          const platformConfig = PLATFORM_CONFIG[config.platform];
          const Icon = platformConfig.icon;
          return (
            <div
              key={config.platform}
              className="flex items-center justify-between p-2 bg-[#1e1e1e] rounded"
            >
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded ${platformConfig.color} flex items-center justify-center`}>
                  <Icon size={14} className="text-white" />
                </div>
                <span className="text-xs text-gray-300">{platformConfig.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {config.connected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <button
                      onClick={() => onDisconnect?.(config.platform)}
                      className="p-1 text-gray-400 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleConnect(config.platform)}
                      disabled={isConnecting === config.platform}
                      className="px-2 py-0.5 text-xs bg-[#007acc] hover:bg-[#1a8cdb] rounded text-white"
                    >
                      {isConnecting === config.platform ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        'Connect'
                      )}
                    </button>
                    <button
                      onClick={() => setConfigModalPlatform(config)}
                      className="p-1 text-gray-400 hover:text-white"
                    >
                      <Settings size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredMessages.length > 0 ? (
          <>
            {filteredMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageSquare size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Connect a platform to start messaging</p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#3c3c3c]">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#007acc]"
          />
          <button
            onClick={handleSend}
            disabled={!inputMessage.trim()}
            className={`px-4 py-2 rounded-lg flex items-center gap-1 ${
              inputMessage.trim()
                ? 'bg-[#007acc] hover:bg-[#1a8cdb] text-white'
                : 'bg-[#2d2d2d] text-gray-500 cursor-not-allowed'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Active: {configs.find((c) => c.connected)?.platform || 'IDE Chat'}
        </p>
      </div>

      {/* Config Modal */}
      {configModalPlatform && (
        <ConfigModal
          platform={configModalPlatform}
          onSave={(config) => handleConfigSave(configModalPlatform.platform, config)}
          onClose={() => setConfigModalPlatform(null)}
        />
      )}
    </div>
  );
};

export default MessagingPanel;
