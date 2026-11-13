"use client";

import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Schemas } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Day = Schemas["DayCount"];

// Sent / failed: a validated colour-blind-safe pair (see globals.css), always shown with a legend.
const config = {
  sent: { label: "Sent", color: "var(--chart-sent)" },
  failed: { label: "Failed", color: "var(--chart-failed)" },
} satisfies ChartConfig;

/** Emails sent and failed per day, stacked. */
export function EmailsPerDayChart({ days, className }: { days: Day[]; className?: string }) {
  const data = days.map((d) => ({ ...d, label: format(parseISO(d.date), "d MMM") }));
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-64 w-full", className)}>
      <BarChart data={data} margin={{ left: -16, right: 4, top: 8 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={48} />
        <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} itemSorter={(item) => (item.dataKey === "sent" ? 0 : 1)} />
        {/* 2px gap between stacked segments, in the card's colour. */}
        <Bar dataKey="sent" stackId="day" fill="var(--color-sent)" maxBarSize={24} stroke="var(--card)" strokeWidth={2} />
        <Bar
          dataKey="failed"
          stackId="day"
          fill="var(--color-failed)"
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
          stroke="var(--card)"
          strokeWidth={2}
        />
      </BarChart>
    </ChartContainer>
  );
}
