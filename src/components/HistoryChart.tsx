"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type HistoryPoint = { session: string; score: number };

const MOCK_DATA: HistoryPoint[] = [
  { session: "#01", score: 55 },
  { session: "#02", score: 58 },
  { session: "#03", score: 52 },
  { session: "#04", score: 60 },
  { session: "#05", score: 63 },
  { session: "#06", score: 66 },
  { session: "#07", score: 62 },
  { session: "#08", score: 68 },
  { session: "#09", score: 70 },
  { session: "#10", score: 72 },
  { session: "#11", score: 68 },
  { session: "#12", score: 74 },
  { session: "#13", score: 76 },
  { session: "#14", score: 78 },
];

interface HistoryChartProps {
  data?: HistoryPoint[];
}

export function HistoryChart({ data }: HistoryChartProps) {
  const chartData = data && data.length > 0 ? data : MOCK_DATA;
  const isReal = !!(data && data.length > 0);

  return (
    <div style={{ width: "100%", height: 180 }}>
      {!isReal && (
        <div
          className="mono"
          style={{ fontSize: 10, color: "var(--color-fg-3)", letterSpacing: "0.12em", marginBottom: 8 }}
        >
          DEMO DATA — 로그인 후 실제 분석 이력이 표시됩니다
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-acc)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-acc)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="session"
            stroke="var(--color-fg-3)"
            tickLine={false}
            axisLine={{ stroke: "var(--color-line-2)" }}
            interval={chartData.length > 8 ? 1 : 0}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            stroke="var(--color-fg-3)"
            tickLine={false}
            axisLine={{ stroke: "var(--color-line-2)" }}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-2)",
              border: "1px solid var(--color-line-2)",
              borderRadius: 4,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-fg-0)",
            }}
            labelStyle={{ color: "var(--color-fg-3)", letterSpacing: "0.1em" }}
            cursor={{ stroke: "var(--color-acc)", strokeDasharray: "2 4" }}
          />
          <ReferenceLine
            y={68}
            stroke="var(--color-fg-3)"
            strokeDasharray="3 4"
            label={{
              value: "PRO AVG 68",
              fill: "var(--color-fg-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="var(--color-acc)"
            strokeWidth={2}
            fill="url(#histFill)"
            dot={{ r: 2.5, fill: "var(--color-bg-0)", stroke: "var(--color-acc)", strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: "var(--color-acc)", stroke: "var(--color-acc)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
