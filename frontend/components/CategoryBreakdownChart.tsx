"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { CategoryBreakdownItem } from "@/lib/apiClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

const chartConfig = {
  high: { label: "High", color: "oklch(0.63 0.2 25)" },
  medium: { label: "Medium", color: "oklch(0.75 0.15 85)" },
  low: { label: "Low", color: "oklch(0.7 0.14 155)" },
} satisfies ChartConfig;

export function CategoryBreakdownChart({
  items,
}: {
  items: CategoryBreakdownItem[];
}) {
  const data = items.slice(0, 8).map((item) => ({
    category: item.category.replaceAll("_", " "),
    high: item.high,
    medium: item.medium,
    low: item.low,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Risk distribution</CardDescription>
        <CardTitle>Categories</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <Empty className="border border-dashed py-8">
            <EmptyHeader>
              <EmptyTitle>No categories</EmptyTitle>
              <EmptyDescription>Flagged clause categories will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-[4/3] w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={56}
                tickFormatter={(value: string) =>
                  value.length > 12 ? `${value.slice(0, 12)}…` : value
                }
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="high" stackId="a" fill="var(--color-high)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="medium" stackId="a" fill="var(--color-medium)" />
              <Bar dataKey="low" stackId="a" fill="var(--color-low)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
