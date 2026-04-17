"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Music2 } from 'lucide-react';

// ─── 8 Mood Categories với Color Palette cố định ───────────────────────────────
const MOOD_CONFIG: Record<string, { color: string; emoji: string }> = {
  'Happy/Upbeat':    { color: '#FFD93D', emoji: '😊' },
  'Sad/Melancholic': { color: '#6C5CE7', emoji: '😢' },
  'Energetic':       { color: '#FF6B6B', emoji: '🔥' },
  'Chill/Relaxed':   { color: '#4ECDC4', emoji: '😌' },
  'Angry/Intense':   { color: '#E17055', emoji: '😠' },
  'Romantic/Dreamy': { color: '#FD79A8', emoji: '🌙' },
  'Dramatic/Epic':   { color: '#636E72', emoji: '🎭' },
  'Party/Dance':     { color: '#00B894', emoji: '🎉' },
  'Unknown':         { color: '#B2BEC3', emoji: '❓' },
};

interface MoodDayData {
  date: string;
  day_label: string;
  moods: Record<string, number>;
  total: number;
}

// Custom Tooltip cho stacked bar
function MoodTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const items = payload.filter((p: any) => p.value > 0).reverse();
  const total = items.reduce((sum: number, p: any) => sum + p.value, 0);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 min-w-[160px]">
      <p className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1.5">{label}</p>
      {items.map((item: any, idx: number) => {
        const config = MOOD_CONFIG[item.dataKey] || MOOD_CONFIG['Unknown'];
        return (
          <div key={idx} className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
              <span className="text-xs text-slate-600">{config.emoji} {item.dataKey}</span>
            </div>
            <span className="text-xs font-semibold text-slate-800">{item.value} bài</span>
          </div>
        );
      })}
      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-100">
        <span className="text-xs font-medium text-slate-500">Tổng</span>
        <span className="text-xs font-bold text-indigo-600">{total} bài</span>
      </div>
    </div>
  );
}

// Custom Legend
function MoodLegend({ activeMoods }: { activeMoods: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 px-2">
      {activeMoods.map(mood => {
        const config = MOOD_CONFIG[mood] || MOOD_CONFIG['Unknown'];
        return (
          <div key={mood} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
            <span className="text-[11px] text-slate-500">{config.emoji} {mood}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function MoodChart({ data }: { data: MoodDayData[] }) {
  // Empty state
  if (!data || data.length === 0 || data.every(d => d.total === 0)) {
    return (
      <Card className="shadow-sm border-slate-200 rounded-2xl bg-white">
        <CardHeader>
          <CardTitle className="text-slate-800 text-lg flex items-center gap-2">
            <span className="text-xl">🎭</span> Biểu Đồ Cảm Xúc
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
            <Music2 className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400 text-center max-w-[260px]">
            Chưa có dữ liệu cảm xúc. Nghe thêm nhạc để xem mood chart! 🎵
          </p>
        </CardContent>
      </Card>
    );
  }

  // Tìm tất cả mood có trong data
  const allMoods = new Set<string>();
  data.forEach(d => Object.keys(d.moods).forEach(m => allMoods.add(m)));
  const activeMoods = Array.from(allMoods);

  // Chuyển đổi data cho Recharts StackedBar format
  const chartData = data.map(d => ({
    name: d.day_label,
    date: d.date,
    ...d.moods,
  }));

  return (
    <Card className="shadow-sm border-slate-200 rounded-2xl bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-800 text-lg flex items-center gap-2">
          <span className="text-xl">🎭</span> Biểu Đồ Cảm Xúc
          <span className="text-xs text-slate-400 font-normal ml-auto">7 ngày gần nhất</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip content={<MoodTooltip />} cursor={{ fill: '#f8fafc' }} />
              {activeMoods.map(mood => (
                <Bar
                  key={mood}
                  dataKey={mood}
                  stackId="mood"
                  fill={(MOOD_CONFIG[mood] || MOOD_CONFIG['Unknown']).color}
                  radius={activeMoods.indexOf(mood) === activeMoods.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={45}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <MoodLegend activeMoods={activeMoods} />
      </CardContent>
    </Card>
  );
}
