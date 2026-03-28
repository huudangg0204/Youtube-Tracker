"use client";

import { useEffect, useState, useCallback } from 'react';
import { fetchHistory, fetchStats } from '@/lib/api';
import TimeChart from '@/components/charts/TimeChart';
import SkipRateChart from '@/components/charts/SkipRateChart';
import ContextPieChart from '@/components/charts/ContextPieChart';
import HistoryTable from '@/components/history/HistoryTable';
import NowPlayingCard from '@/components/dashboard/NowPlayingCard';
import TotalPlaytimeCard from '@/components/dashboard/TotalPlaytimeCard';
import TopVideosCard from '@/components/dashboard/TopVideosCard';
import { useSocket } from '@/hooks/useSocket';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liveEvent, setLiveEvent] = useState<any>(null);

  const socket = useSocket(user?.id);
  
  // Custom hook for Supabase
  useEffect(() => {
    const supabaseClient = createClient();
    supabaseClient.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [histRes, statsRes] = await Promise.all([
        fetchHistory(),
        fetchStats()
      ]);
      setHistory(histRes.data || []);
      setStats(statsRes.data || null);
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

  useEffect(() => {
    if (socket) {
      socket.on('new_track_event', (data) => {
        setLiveEvent(data);
        
        // Chỉ gọi lại báo cáo dữ liệu (cập nhật biểu đồ/bảng history) 
        // khi sự kiện KHÔNG PHẢI là 'play' (Heartbeat bắn mỗi giây)
        // Các sự kiện như 'pause', 'skip', 'track_completed' mới mang ý nghĩa chốt dữ liệu
        if (data.eventType !== 'play') {
          setHistory(prev => [data, ...prev].slice(0, 50));
          setTimeout(loadData, 2000); // Reload overall stats after 2 seconds
        }
      });
    }
    return () => {
      if (socket) socket.off('new_track_event');
    }
  }, [socket, loadData]);

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
        <p className="text-slate-500 font-medium">Loading your listening habits...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 relative">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Analytics Hub</h2>
        <p className="text-slate-500">Deep tracking metrics, context analysis, and live playbacks</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <NowPlayingCard liveEvent={liveEvent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TotalPlaytimeCard totalMs={stats?.total_history_ms || 0} />
        <TopVideosCard topVideos={stats?.top_videos || { week: [], month: [] }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2">
          <TimeChart data={stats?.daily_ms || []} />
        </div>
        <div className="col-span-1 flex flex-col gap-6">
          <SkipRateChart skipRate={stats?.skip_rate || 0} />
          <ContextPieChart data={stats?.context_distribution || []} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <HistoryTable history={history} />
      </div>
    </div>
  )
}
