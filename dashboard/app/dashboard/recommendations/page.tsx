"use client";

import { useEffect, useState, useCallback } from 'react';
import { fetchRecommend } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { SparklesIcon, CompassIcon, RefreshCcwIcon } from 'lucide-react';

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabaseClient = createClient();
    supabaseClient.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchRecommend();
      setRecommendations(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Determine current time context for mock AI grouping
  const hour = new Date().getHours();
  let timeContext = 'Night';
  if (hour >= 5 && hour < 12) timeContext = 'Morning';
  else if (hour >= 12 && hour < 17) timeContext = 'Afternoon';
  else if (hour >= 17 && hour < 22) timeContext = 'Evening';

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-indigo-500" /> AI Recommendations
          </h2>
          <p className="text-slate-500">Discover new tracks based on your deep tracking metadata</p>
        </div>
        <button 
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCcwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Section 1: Content-Based Filtering */}
        <div className="col-span-1 lg:col-span-2 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100/50">
          <h3 className="text-lg font-bold text-indigo-950 flex items-center gap-2 mb-4">
            <CompassIcon className="w-5 h-5 text-indigo-500" />
            Because you listen to top artists
          </h3>
          
          {loading ? (
             <div className="h-40 flex items-center justify-center">
                 <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
             </div>
          ) : recommendations.length === 0 ? (
             <p className="text-indigo-800/60 bg-white/50 p-4 rounded-xl text-sm">Not enough data to formulate recommendations. Keep listening!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recommendations.slice(0, 6).map((track, i) => (
                <a key={i} href={`https://www.youtube.com/watch?v=${track.videoId}`} target="_blank" rel="noreferrer" className="group block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-indigo-50 flex flex-col items-stretch">
                  <div className="relative aspect-video overflow-hidden">
                    <img src={track.thumbnail || `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`} alt="thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm text-slate-800 line-clamp-1 group-hover:text-indigo-600">{track.title || 'Unknown Track'}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{track.channelTitle || 'YouTube Artist'}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Context-Aware Filtering */}
        <div className="col-span-1 bg-white rounded-2xl p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Good {timeContext} Mix</h3>
          <p className="text-sm text-slate-500 mb-6">Music tailored for your current contextual routine.</p>
          
          <div className="space-y-4">
             {loading ? (
                <div className="h-full flex items-center justify-center py-10">
                   <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
                </div>
             ) : (
                [1,2,3].map((placeholder) => (
                  <div key={placeholder} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors cursor-pointer">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative group">
                        <div className="absolute inset-0 bg-indigo-500/10 group-hover:bg-transparent transition-colors z-10"></div>
                        <SparklesIcon className="w-5 h-5 text-indigo-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">AI Context Hub v2</p>
                      <p className="text-xs text-slate-400 mt-0.5">Under Construction</p>
                    </div>
                  </div>
                ))
             )}
          </div>
        </div>

      </div>
    </div>
  )
}
