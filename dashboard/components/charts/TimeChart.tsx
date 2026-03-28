"use client"

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Clock, PlayCircle } from 'lucide-react'
import { fetchDailyHistory } from '@/lib/api'

export default function TimeChart({ data }: { data: { day: string, total_ms: number }[] }) {
  const maxMs = data.length > 0 ? Math.max(...data.map(d => d.total_ms)) : 0;
  const useMinutes = maxMs < 3600000; // less than 1 hour

  const formattedData = data.map(d => {
    const day = new Date(d.day).toLocaleDateString('en-US', { weekday: 'short' });
    if (useMinutes) {
      return { day, value: Number((d.total_ms / 60000).toFixed(1)), rawDay: d.day };
    } else {
      return { day, value: Number((d.total_ms / 3600000).toFixed(2)), rawDay: d.day };
    }
  });

  const unitName = useMinutes ? 'Minutes' : 'Hours';

  const [selectedDay, setSelectedDay] = useState<{label: string, raw: string} | null>(null);
  const [dailyTracks, setDailyTracks] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  const handleBarClick = async (barData: any) => {
    if (!barData || !barData.rawDay) return;
    const rawDateStr = new Date(barData.rawDay).toISOString().split('T')[0];
    setSelectedDay({ label: barData.day, raw: rawDateStr });
    setLoadingModal(true);
    try {
      const res = await fetchDailyHistory(rawDateStr);
      setDailyTracks(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingModal(false);
    }
  };

  return (
    <Card className="col-span-1 lg:col-span-2 border-slate-200 shadow-sm rounded-2xl bg-white">
      <CardHeader>
        <CardTitle className="text-slate-800 text-lg">Listening Time ({unitName})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(val: any) => [`${val} ${useMinutes ? 'm' : 'h'}`, 'Time']}
              />
              <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} onClick={handleBarClick} className="cursor-pointer hover:opacity-80 transition-opacity" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Modal Overlay */}
        {selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
             <Card className="w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden border-0 relative max-h-[80vh] flex flex-col">
                <CardHeader className="bg-indigo-600 p-5 text-white flex flex-row items-center justify-between shadow-md z-10 sticky top-0">
                   <div>
                      <CardTitle className="text-xl">History: {selectedDay.label}</CardTitle>
                      <p className="text-indigo-100 text-sm mt-1">{selectedDay.raw}</p>
                   </div>
                   <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-indigo-500 rounded-full transition-colors">
                      <X className="w-5 h-5 text-white" />
                   </button>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto bg-slate-50 flex-grow">
                   {loadingModal ? (
                      <div className="p-10 flex flex-col items-center justify-center text-slate-500 gap-3">
                         <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                         <p>Loading tracks...</p>
                      </div>
                   ) : dailyTracks.length === 0 ? (
                      <div className="p-10 text-center text-slate-500">
                         No tracking data for this day.
                      </div>
                   ) : (
                      <ul className="divide-y divide-slate-100">
                         {dailyTracks.map((track, idx) => {
                            const totalMins = Math.floor(track.totalMs / 60000);
                            const h = Math.floor(totalMins / 60);
                            const m = totalMins % 60;
                            const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
                            return (
                               <li key={idx} className="p-4 hover:bg-white transition-colors flex items-center justify-between group">
                                  <div className="flex items-center gap-4">
                                     <div className="relative shrink-0">
                                        <img src={track.thumbnail} alt="thumbnail" className="w-12 h-12 object-cover rounded-lg shadow-sm border border-slate-200" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                           <PlayCircle className="w-6 h-6 text-white" />
                                        </div>
                                     </div>
                                     <div>
                                        <a href={`https://www.youtube.com/watch?v=${track.videoId}`} target="_blank" rel="noreferrer" className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline line-clamp-1 text-sm">
                                           {track.title}
                                        </a>
                                        <p className="text-[11px] text-slate-500 mt-1">{track.artist}</p>
                                     </div>
                                  </div>
                                  <div className="text-right flex flex-col items-end min-w-[70px]">
                                     <p className="text-sm font-semibold text-indigo-600">{timeStr}</p>
                                     <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{track.playCount || 0} plays</p>
                                  </div>
                               </li>
                            );
                         })}
                      </ul>
                   )}
                </CardContent>
             </Card>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
