'use client';

import React, { useState } from 'react';
import { Globe, RefreshCw, ExternalLink, X } from 'lucide-react';

interface BrowserPreviewProps {
  url?: string;
}

export function BrowserPreview({ url: initialUrl }: BrowserPreviewProps) {
  const [url, setUrl] = useState(initialUrl || 'http://localhost:3000');
  const [inputUrl, setInputUrl] = useState(url);
  const [key, setKey] = useState(0);

  const navigate = () => {
    setUrl(inputUrl);
    setKey(prev => prev + 1);
  };

  const refresh = () => {
    setKey(prev => prev + 1);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Browser bar */}
      <div className="px-3 py-2 border-b border-[#30363d] flex items-center gap-2">
        <Globe size={14} className="text-[#8b949e] shrink-0" />
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate()}
          className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-xs text-[#c9d1d9] focus:border-[#58a6ff] outline-none"
        />
        <button onClick={refresh} className="text-[#8b949e] hover:text-[#c9d1d9]" title="Refresh">
          <RefreshCw size={14} />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8b949e] hover:text-[#c9d1d9]"
          title="Open in browser"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 relative">
        <iframe
          key={key}
          src={url}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Browser Preview"
        />
      </div>
    </div>
  );
}
