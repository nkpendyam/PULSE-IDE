'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Wifi, WifiOff, Server, Loader2 } from 'lucide-react';

type WsStatus = 'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting' | 'Error';

interface WsState {
  status: WsStatus;
  server_url: string | null;
  connected_room: string | null;
}

export function WebSocketPanel() {
  const [status, setStatus] = useState<WsStatus>('Disconnected');
  const [serverUrl, setServerUrl] = useState('ws://localhost:8080');
  const [roomId, setRoomId] = useState('');
  const [connectedRoom, setConnectedRoom] = useState<string | null>(null);

  const handleConnect = async () => {
    setStatus('Connecting');
    try {
      await invoke('ws_connect', { serverUrl });
      setStatus('Connected');
    } catch {
      setStatus('Error');
    }
  };

  const handleDisconnect = async () => {
    await invoke('ws_disconnect');
    setStatus('Disconnected');
    setConnectedRoom(null);
  };

  const handleJoinRoom = async () => {
    if (!roomId) return;
    try {
      await invoke('ws_join_room', { roomId });
      setConnectedRoom(roomId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeaveRoom = async () => {
    await invoke('ws_leave_room');
    setConnectedRoom(null);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'Connected': return 'text-[#3fb950]';
      case 'Connecting':
      case 'Reconnecting': return 'text-[#f0883e]';
      case 'Error': return 'text-[#f85149]';
      default: return 'text-[#8b949e]';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] p-4">
      <h3 className="text-[#c9d1d9] font-medium mb-4 flex items-center gap-2">
        <Server size={18} /> WebSocket
      </h3>

      <div className="flex items-center gap-2 mb-4">
        {status === 'Connected' ? (
          <Wifi size={20} className={getStatusColor()} />
        ) : (
          <WifiOff size={20} className={getStatusColor()} />
        )}
        <span className={`text-sm ${getStatusColor()}`}>{status}</span>
      </div>

      {status !== 'Connected' ? (
        <>
          <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
            placeholder="WebSocket server URL"
            className="w-full mb-2 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] text-sm" />
          <button onClick={handleConnect}
            className="w-full py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded">
            Connect
          </button>
        </>
      ) : (
        <>
          <button onClick={handleDisconnect}
            className="w-full py-2 bg-[#f85149] hover:bg-[#da3633] text-white text-sm rounded mb-4">
            Disconnect
          </button>

          {connectedRoom ? (
            <div className="bg-[#161b22] p-3 rounded border border-[#30363d]">
              <p className="text-sm text-[#c9d1d9] mb-2">Room: {connectedRoom}</p>
              <button onClick={handleLeaveRoom}
                className="w-full py-2 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-sm rounded">
                Leave Room
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={roomId} onChange={(e) => setRoomId(e.target.value)}
                placeholder="Room ID"
                className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] text-sm" />
              <button onClick={handleJoinRoom}
                className="px-4 py-2 bg-[#58a6ff] hover:bg-[#79c0ff] text-white text-sm rounded">
                Join
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
