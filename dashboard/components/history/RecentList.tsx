"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MusicIcon, PlayIcon, SkipForwardIcon, PauseIcon } from 'lucide-react'

export default function RecentList({ history }: { history: any[] }) {
  const getIcon = (event: string) => {
    switch (event) {
      case 'play': return <PlayIcon className="w-4 h-4 text-emerald-500" />
      case 'skip': return <SkipForwardIcon className="w-4 h-4 text-amber-500" />
      case 'pause': return <PauseIcon className="w-4 h-4 text-slate-400" />
      default: return <MusicIcon className="w-4 h-4 text-indigo-500" />
    }
  }

  return (
    <Card className="col-span-1 lg:col-span-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
      <CardHeader className="border-b border-slate-100 bg-white/50 backdrop-blur">
        <CardTitle className="text-slate-800 text-lg">Recent Playbacks</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No recent playbacks found.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((item, idx) => (
                <li key={idx} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="min-w-10 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                      {getIcon(item.eventType)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm flex items-center gap-2">
                        {item.title || `Video ID: ${item.videoId}`}
                      </p>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">{item.eventType}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block">{(item.msPlayed / 1000).toFixed(0)}s</p>
                    <p className="text-[11px] text-slate-400 mt-1">{new Date(item.timestamp).toLocaleTimeString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
