"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClockIcon, PlayIcon, ChevronDownIcon } from 'lucide-react'

export default function HistoryTable({ history }: { history: any[] }) {
  // Trích lọc: Chỉ lấy sự kiện 'play' để làm lịch sử nghe nhạc
  const listenHistory = history.filter(item => item.eventType === 'play');
  
  // Gộp các sự kiện play liên tiếp của cùng 1 bài hát cho lịch sử gọn gàng hơn.
  const deduplicatedHistory: any[] = [];
  listenHistory.forEach(item => {
    const last = deduplicatedHistory[deduplicatedHistory.length - 1];
    if (!last || last.videoId !== item.videoId) {
      deduplicatedHistory.push(item);
    }
  });

  const [visibleCount, setVisibleCount] = useState(10);
  const displayedHistory = deduplicatedHistory.slice(0, visibleCount);

  return (
    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
      <CardHeader className="border-b border-slate-100 bg-white/50 backdrop-blur flex flex-row items-center justify-between">
        <CardTitle className="text-slate-800 text-lg">Listening History</CardTitle>
        <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md">Recent Tracks</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {deduplicatedHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No listening history found.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {displayedHistory.map((item, idx) => (
                <li key={idx} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                       <img src={item.thumbnail} alt="thumbnail" className="w-14 h-14 object-cover rounded-lg shadow-sm border border-slate-200" />
                       <a href={`https://www.youtube.com/watch?v=${item.videoId}`} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <PlayIcon className="w-5 h-5 text-white ml-0.5" />
                       </a>
                    </div>
                    <div>
                      <a href={`https://www.youtube.com/watch?v=${item.videoId}`} target="_blank" rel="noreferrer" className="font-semibold text-slate-800 text-sm hover:text-indigo-600 hover:underline line-clamp-1">
                        {item.title}
                      </a>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.artist}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end min-w-[80px]">
                    <p className="text-[12px] text-slate-400 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          
          {visibleCount < deduplicatedHistory.length && (
            <div className="p-4 flex justify-center border-t border-slate-100">
              <button 
                onClick={() => setVisibleCount(v => v + 10)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                View More <ChevronDownIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
