"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const COLORS = ['#e2e8f0', '#4f46e5']

export default function SkipRateChart({ skipRate }: { skipRate: number }) {
  const data = [
    { name: 'Skipped', value: skipRate * 100 },
    { name: 'Completed', value: 100 - (skipRate * 100) },
  ]

  return (
    <Card className="col-span-1 border-slate-200 shadow-sm rounded-2xl bg-white">
      <CardHeader>
        <CardTitle className="text-slate-800 text-lg">Completion Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(val: any) => `${Number(val).toFixed(1)}%`}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
