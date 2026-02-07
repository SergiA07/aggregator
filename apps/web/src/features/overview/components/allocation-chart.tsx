import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { formatCurrency } from '@/utils/formatters';
import { DEFAULT_COLORS } from '../config/institutions';

interface AllocationChartProps {
  data: { name: string; value: number; percentage: number }[];
  /** Optional color map for specific items (e.g., institutions) */
  colorMap?: Map<string, string>;
}

export function AllocationChart({ data, colorMap }: AllocationChartProps) {
  // Filter out zero values and sort by value descending
  const filteredData = data.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);

  if (filteredData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  // Get color for an item - use colorMap if provided, otherwise fall back to default colors
  const getColor = (name: string, index: number) => {
    if (colorMap?.has(name)) {
      return colorMap.get(name)!;
    }
    return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  // Create chart config for shadcn chart
  const chartConfig = Object.fromEntries(
    filteredData.map((item, index) => [
      item.name,
      {
        label: item.name,
        color: getColor(item.name, index),
      },
    ]),
  );

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filteredData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
          >
            {filteredData.map((entry, index) => (
              <Cell key={`cell-${entry.name}`} fill={getColor(entry.name, index)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-muted-foreground">
                    {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                  </div>
                </div>
              );
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => {
              const item = filteredData.find((d) => d.name === value);
              if (!item) return value;
              return (
                <span className="text-sm">
                  {value} ({item.percentage.toFixed(0)}%)
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
