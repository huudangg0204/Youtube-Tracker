"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

export default function TopVideosCard({ topVideos }: { topVideos: { week: any[], month: any[] } }) {
  const [timeframe, setTimeframe] = useState<'week'|'month'>('week');
  const activeList = timeframe === 'week' ? (topVideos?.week || []) : (topVideos?.month || []);

  return (
    <Card className="col-span-1 lg:col-span-2 border-slate-200 shadow-sm rounded-2xl bg-white">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
         <CardTitle className="text-slate-800 text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Top 5 Tracks
         </CardTitle>
         <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button 
               onClick={() => setTimeframe('week')}
               className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeframe === 'week' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
               7 Days
            </button>
            <button 
               onClick={() => setTimeframe('month')}
               className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeframe === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
               30 Days
            </button>
         </div>
      </CardHeader>
      <CardContent>
         <div className="flex flex-col gap-3 mt-2">
            {(!activeList || activeList.length === 0) ? (
              <p className="text-sm text-slate-500">No data available yet.</p>
            ) : (
                activeList.map((video, index) => {
                    const totalMinutes = Math.floor((video.totalMs || 0) / 60000);
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                    return (
                        <div key={video.videoId} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl hover:bg-slate-100 transition-colors">
                           <div className="flex items-center gap-4">
                               <div className="relative font-bold text-slate-300 text-lg w-4 text-center">
                                   {index + 1}
                               </div>
                               <img src={video.thumbnail} alt={video.title} className="w-12 h-12 object-cover rounded-md shadow-sm" />
                               <div className="flex flex-col">
                                   <p className="text-sm font-bold text-slate-800 line-clamp-1">{video.title}</p>
                                   <p className="text-xs text-slate-500">{video.artist}</p>
                               </div>
                           </div>
                           <div className="text-right">
                               <p className="text-sm font-semibold text-indigo-600">{timeString}</p>
                               <p className="text-xs text-slate-400 font-medium">{video.playCount || 0} plays</p>
                           </div>
                        </div>
                    );
                })
            )}
         </div>
      </CardContent>
    </Card>
  );
}
