"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa'];

export default function ContextPieChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return (
     <Card className="col-span-1 shadow-sm border-slate-200 rounded-2xl bg-white">
      <CardHeader>
        <CardTitle className="text-slate-800 text-lg">Daily Routines</CardTitle>
      </CardHeader>
      <CardContent className="h-[250px] flex items-center justify-center">
        <p className="text-sm text-slate-400">Not enough contextual data</p>
      </CardContent>
    </Card>
  );

  return (
    <Card className="col-span-1 shadow-sm border-slate-200 rounded-2xl bg-white">
      <CardHeader>
        <CardTitle className="text-slate-800 text-lg">Listening Context</CardTitle>
      </CardHeader>
      <CardContent className="h-[250px] pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={4}
              dataKey="count"
              nameKey="timeOfDay"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="stroke-white stroke-2" />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
              itemStyle={{ color: '#1e293b', fontWeight: 600 }}
            />
            <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}/>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
