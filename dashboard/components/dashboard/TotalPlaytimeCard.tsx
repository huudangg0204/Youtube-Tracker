"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function TotalPlaytimeCard({ totalMs }: { totalMs: number }) {
  const totalMinutes = Math.floor((totalMs || 0) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  let timeString = '';
  if (hours > 0) {
    timeString = `${hours}h ${minutes}m`;
  } else {
    timeString = `${minutes}m`;
  }

  return (
    <Card className="col-span-1 border-slate-200 shadow-sm rounded-2xl bg-white flex flex-col justify-center">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center">
          <Clock className="w-7 h-7 text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">Total Playtime</p>
          <h3 className="text-3xl font-bold text-slate-800">{timeString}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
