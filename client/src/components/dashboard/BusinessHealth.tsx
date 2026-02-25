import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUpRight, DollarSign, Activity, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell } from "recharts";
import { FeatureLock } from "@/components/FeatureLock";

// Mock Data for Charts (Replace with real aggregation later)
const revenueData = [
    { name: "Mon", total: 1200 },
    { name: "Tue", total: 2100 },
    { name: "Wed", total: 800 },
    { name: "Thu", total: 1600 },
    { name: "Fri", total: 2400 },
    { name: "Sat", total: 3200 },
    { name: "Sun", total: 1800 },
];

const pipelineData = [
    { name: 'Lead', value: 12, color: '#94a3b8' },
    { name: 'Quoted', value: 8, color: '#fbbf24' },
    { name: 'Booked', value: 5, color: '#3b82f6' },
    { name: 'In Progress', value: 3, color: '#8b5cf6' },
];

export function BusinessHealth() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-8">

            {/* 1. Revenue Chart (Big) */}
            <FeatureLock feature="analytics.lite">
                <Card className="col-span-4 shadow-sm border-none bg-gradient-to-br from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                    <CardHeader>
                        <CardTitle className="text-lg font-medium">Revenue Overview</CardTitle>
                        <CardDescription>
                            Gross revenue for the last 7 days.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="name"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value: number) => [`$${value}`, 'Revenue']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#22c55e"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorTotal)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </FeatureLock>

            {/* 2. Pipeline Snapshot & Drilldowns */}
            <FeatureLock feature="analytics.drilldowns">
                <Card className="col-span-3 shadow-sm border-none bg-card ring-1 ring-border">
                    <CardHeader>
                        <CardTitle className="text-lg font-medium">Project Pipeline</CardTitle>
                        <CardDescription>
                            Count of jobs by stage.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={pipelineData} layout="vertical" margin={{ left: 0, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {pipelineData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div className="bg-primary/5 p-3 rounded-lg">
                                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Win Rate</div>
                                <div className="text-2xl font-bold flex items-center gap-2">
                                    42%
                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                </div>
                            </div>
                            <div className="bg-primary/5 p-3 rounded-lg">
                                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Avg Margin</div>
                                <div className="text-2xl font-bold">38.5%</div>
                            </div>
                        </div>

                    </CardContent>
                </Card>
            </FeatureLock>
        </div>
    );
}
