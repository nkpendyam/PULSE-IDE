'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useExtendedKyroStore, Collaborator } from '@/store/extendedStore';
import { Users, Plus, LogOut, Send, Hash, Lock, Circle } from 'lucide-react';

export function CollaborationPanel() {
  const {
    currentRoom,
    rooms,
    collaborators,
    presence,
    collabConnected,
    createRoom,
    joinRoom,
    leaveRoom,
    fetchRooms,
  } = useExtendedKyroStore();

  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ user: string; text: string }[]>([]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;
    const room = await createRoom(roomName);
    await joinRoom(room.id);
    setShowCreateRoom(false);
    setRoomName('');
  };

  const handleJoinRoom = async () => {
    if (!joinRoomId.trim()) return;
    await joinRoom(joinRoomId);
    setJoinRoomId('');
  };

  const handleLeaveRoom = async () => {
    await leaveRoom();
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !currentRoom) return;
    await invoke('send_chat_message', { roomId: currentRoom.id, message });
    setMessages([...messages, { user: 'You', text: message }]);
    setMessage('');
  };

  if (currentRoom && collabConnected) {
    return (
      <div className="h-full flex flex-col bg-[#0d1117]">
        {/* Room Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-[#8b949e]" />
            <span className="text-[#c9d1d9] font-medium">{currentRoom.name || currentRoom.id}</span>
            {currentRoom.is_encrypted && <Lock size={14} className="text-[#3fb950]" />}
          </div>
          <button
            onClick={handleLeaveRoom}
            className="flex items-center gap-1 text-sm text-[#f85149] hover:text-[#ff7b72]"
          >
            <LogOut size={16} />
            Leave
          </button>
        </div>

        {/* Collaborators */}
        <div className="px-4 py-2 border-b border-[#30363d]">
          <div className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
            <Users size={14} />
            <span>{collaborators.length} users</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {collaborators.map((collab) => (
              <CollaboratorAvatar key={collab.id} collaborator={collab} />
            ))}
          </div>
        </div>

        {/* Presence Indicators */}
        <div className="px-4 py-2 border-b border-[#30363d] text-xs">
          <p className="text-[#8b949e] mb-1">Active Cursors:</p>
          <div className="space-y-1">
            {presence.map((p) => (
              <div key={p.user_id} className="flex items-center gap-2">
                <Circle size={8} className="fill-[#58a6ff] text-[#58a6ff]" />
                <span className="text-[#c9d1d9]">Ln {p.cursor_line}, Col {p.cursor_column}</span>
                {p.active_file && (
                  <span className="text-[#8b949e]">• {p.active_file.split('/').pop()}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className="text-sm">
              <span className="text-[#58a6ff]">{msg.user}:</span>{' '}
              <span className="text-[#c9d1d9]">{msg.text}</span>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-[#30363d]">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Send a message..."
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
            />
            <button
              onClick={handleSendMessage}
              className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117] p-4">
      <h3 className="text-[#c9d1d9] font-medium mb-4">Collaboration</h3>

      {/* Create Room */}
      <div className="mb-4">
        <button
          onClick={() => setShowCreateRoom(!showCreateRoom)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded"
        >
          <Plus size={18} />
          Create Room
        </button>

        {showCreateRoom && (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name"
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
            />
            <button
              onClick={handleCreateRoom}
              className="w-full px-4 py-2 bg-[#58a6ff] hover:bg-[#79c0ff] text-white rounded"
            >
              Create & Join
            </button>
          </div>
        )}
      </div>

      {/* Join Room */}
      <div className="mb-4">
        <p className="text-sm text-[#8b949e] mb-2">Join existing room:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            placeholder="Room ID"
            className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
          />
          <button
            onClick={handleJoinRoom}
            className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#c9d1d9] rounded"
          >
            Join
          </button>
        </div>
      </div>

      {/* Available Rooms */}
      <div className="flex-1 overflow-y-auto">
        <p className="text-sm text-[#8b949e] mb-2">Available Rooms:</p>
        <div className="space-y-2">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-[#161b22] border border-[#30363d] rounded p-3 hover:border-[#58a6ff] cursor-pointer"
              onClick={() => joinRoom(room.id)}
            >
              <div className="flex items-center justify-between">
                <span className="text-[#c9d1d9]">{room.name || room.id}</span>
                {room.is_encrypted && <Lock size={14} className="text-[#3fb950]" />}
              </div>
              <div className="text-xs text-[#8b949e] mt-1">
                {room.user_count}/{room.max_users} users
              </div>
            </div>
          ))}
          {rooms.length === 0 && (
            <p className="text-sm text-[#8b949e]">No rooms available. Create one to start!</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CollaboratorAvatar({ collaborator }: { collaborator: Collaborator }) {
  return (
    <div className="flex items-center gap-2 bg-[#21262d] rounded px-2 py-1">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
        style={{ backgroundColor: collaborator.color }}
      >
        {collaborator.name.charAt(0).toUpperCase()}
      </div>
      <span className="text-sm text-[#c9d1d9]">{collaborator.name}</span>
    </div>
  );
}
