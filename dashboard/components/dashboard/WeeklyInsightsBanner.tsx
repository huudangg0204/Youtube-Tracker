"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { fetchWeeklyInsights } from '@/lib/api';
import { Sparkles, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

// ─── Skeleton Loading ──────────────────────────────────────────────────────────
function SkeletonPulse() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3.5 bg-amber-200/40 rounded-full w-[92%]" />
      <div className="h-3.5 bg-amber-200/40 rounded-full w-[78%]" />
      <div className="h-3.5 bg-amber-200/40 rounded-full w-[85%]" />
      <div className="h-3 bg-amber-200/30 rounded-full w-[60%]" />
    </div>
  );
}

// ─── Summary Stats Pills ───────────────────────────────────────────────────────
function StatsPills({ summary }: { summary: any }) {
  if (!summary) return null;

  const pills = [
    summary.total_listening_hours && `🎧 ${summary.total_listening_hours}h nghe`,
    summary.total_tracks_played && `🎵 ${summary.total_tracks_played} bài`,
    summary.top_3_artists?.[0] && `👑 ${summary.top_3_artists[0].name}`,
    summary.peak_listening_hours?.label,
    summary.completion_rate && `✅ ${Math.round(summary.completion_rate * 100)}% hoàn thành`,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {pills.map((pill, i) => (
        <span
          key={i}
          className="text-[11px] font-medium px-2.5 py-1 rounded-full 
                     bg-amber-500/10 text-amber-800 border border-amber-200/50"
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function WeeklyInsightsBanner() {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [insightText, setInsightText] = useState('');
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [weekRange, setWeekRange] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetchWeeklyInsights();
        if (cancelled) return;

        const data = res.data;
        if (!data || data.empty) {
          setStatus('empty');
          setInsightText(data?.wrapped_text || '');
          return;
        }

        setInsightText(data.wrapped_text || '');
        setSummaryStats(data.summary_json || null);
        setWeekRange(`${data.week_start} → ${data.week_end}`);
        setStatus('loaded');
      } catch (err) {
        if (cancelled) return;
        console.error('[WeeklyInsights] Error:', err);
        setStatus('error');
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Error state: ẩn hoàn toàn ──
  if (status === 'error') return null;

  // ── Empty state ──
  if (status === 'empty') {
    return (
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden bg-gradient-to-r from-slate-50 to-slate-100">
        <CardContent className="p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200/60 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-600">Your Weekly Insights</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {insightText || '🎧 Tuần trước bạn chưa nghe bài nào. Hãy mở YouTube và bắt đầu hành trình âm nhạc nào!'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden relative 
                     bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50
                     border-l-4 border-l-amber-400">
      {/* Header */}
      <CardContent className="p-0">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 
                            flex items-center justify-center shadow-sm">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                ✨ Your Weekly Insights
              </h3>
              {weekRange && (
                <p className="text-[10px] text-amber-600/70 font-medium">{weekRange}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-amber-100/60 transition-colors text-amber-600"
            aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Content */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: isExpanded ? '500px' : '0px', opacity: isExpanded ? 1 : 0 }}
        >
          <div className="px-5 pb-4">
            {status === 'loading' ? (
              <div>
                <SkeletonPulse />
                <p className="text-[11px] text-amber-500 mt-3 flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin" />
                  Đang phân tích thói quen nghe nhạc tuần qua...
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-amber-900/80 leading-relaxed whitespace-pre-line">
                  {insightText}
                </p>
                <StatsPills summary={summaryStats} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
