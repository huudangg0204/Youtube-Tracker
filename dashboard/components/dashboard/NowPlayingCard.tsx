"use client";

import { Card, CardContent } from '@/components/ui/card';
import { MusicIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function NowPlayingCard({ liveEvent }: { liveEvent: any }) {
  const [trackInfo, setTrackInfo] = useState<any>(null);

  useEffect(() => {
    if (!liveEvent || !liveEvent.videoId) {
        setTrackInfo(null);
        return;
    }

    const fetchMeta = async () => {
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${liveEvent.videoId}&format=json`);
        const data = await res.json();
        setTrackInfo({
          title: data.title,
          artist: data.author_name,
          thumbnail: `https://img.youtube.com/vi/${liveEvent.videoId}/hqdefault.jpg`,
          eventType: liveEvent.eventType
        });
      } catch (e) {
        setTrackInfo({
          title: `Video ID: ${liveEvent.videoId}`,
          artist: 'Loading...',
          thumbnail: `https://img.youtube.com/vi/${liveEvent.videoId}/hqdefault.jpg`,
          eventType: liveEvent.eventType
        });
      }
    };
    fetchMeta();
  }, [liveEvent]);

  if (!trackInfo) {
    return (
      <Card className="col-span-1 lg:col-span-3 bg-gradient-to-r from-indigo-500 to-purple-600 border-none shadow-lg rounded-2xl overflow-hidden">
        <CardContent className="p-6 flex items-center justify-between text-white">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
               <MusicIcon className="w-6 h-6 text-white/50" />
             </div>
             <div>
               <h3 className="text-lg font-bold text-white/90">Nothing playing right now</h3>
               <p className="text-sm text-indigo-100">Play a track on YouTube to see live stats.</p>
             </div>
           </div>
        </CardContent>
      </Card>
    );
  }

  const isPlaying = trackInfo.eventType === 'play';

  return (
    <Card className="col-span-1 lg:col-span-3 bg-gradient-to-r from-indigo-600 to-purple-700 border-none shadow-xl rounded-2xl overflow-hidden relative group">
      <div className="absolute inset-0 bg-black/10 transition-opacity"></div>
      <CardContent className="p-6 flex items-center justify-between text-white relative z-10">
        <div className="flex items-center gap-6">
          <div className="relative">
            <img src={trackInfo.thumbnail} className={`w-20 h-20 object-cover rounded-full shadow-2xl border-2 border-white/20 ${isPlaying ? 'animate-[spin_...]' : ''}`} style={{ animation: isPlaying ? 'spin 10s linear infinite' : 'none' }} alt="disc" />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
               <div className="w-4 h-4 bg-indigo-900 rounded-full border border-white/30"></div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-white">{trackInfo.eventType}</span>
              <span className="text-xs text-indigo-200">Live Sync Active</span>
            </div>
            <h3 className="text-xl font-bold line-clamp-1">{trackInfo.title}</h3>
            <p className="text-sm text-indigo-100">{trackInfo.artist}</p>
          </div>
        </div>
        {isPlaying && (
          <div className="hidden sm:flex flex-col items-end gap-2 w-1/3">
             <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden relative">
                <div className="bg-white h-full w-2/3 animate-pulse rounded-full"></div>
             </div>
             <p className="text-xs text-indigo-200 font-medium tracking-wide">Tracking in progress...</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
