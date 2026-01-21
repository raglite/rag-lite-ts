import { 
  PieChart, Pie, Cell, 
  ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { useSystemStore } from '@/stores/systemStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export function DashboardCharts() {
  const { stats } = useSystemStore();

  if (!stats || stats.error || !stats.contentTypeDistribution || stats.contentTypeDistribution.length === 0) {
    return null;
  }

  const storageData = [
    { name: 'Database', value: parseFloat(stats.dbSize) },
    { name: 'Index', value: parseFloat(stats.indexSize) },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Content Type Distribution */}
      <Card className="border-primary/5 shadow-sm overflow-hidden">
        <CardHeader className="pb-2 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Content Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.contentTypeDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                animationBegin={0}
                animationDuration={1500}
              >
                {stats.contentTypeDistribution.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Storage Usage */}
      <Card className="border-primary/5 shadow-sm overflow-hidden">
        <CardHeader className="pb-2 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Storage Footprint (MB)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={storageData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                style={{ fontSize: '12px', fontWeight: 'bold' }}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar 
                dataKey="value" 
                fill="#3b82f6" 
                radius={[0, 4, 4, 0]} 
                barSize={30}
                animationBegin={500}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
