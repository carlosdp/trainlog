'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { basePath } from '@/lib/basePath';

export function HistoryChart({ runId, metricKeys }: { runId: string; metricKeys: string[] }) {
  const [activeKey, setActiveKey] = useState(metricKeys[0] ?? '');
  const [data, setData] = useState<Array<Record<string, number | string>>>([]);

  useEffect(() => {
    if (!activeKey) return;
    const controller = new AbortController();
    fetch(`${basePath}/api/runs/${runId}/history?keys=${encodeURIComponent(activeKey)}`, {
      signal: controller.signal
    })
      .then((res) => res.json())
      .then((payload) => setData(payload.points ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [runId, activeKey]);

  const hasMetrics = metricKeys.length > 0;

  const options = useMemo(
    () =>
      metricKeys.map((key) => (
        <option key={key} value={key}>
          {key}
        </option>
      )),
    [metricKeys]
  );

  return (
    <div className="panel" style={{ minHeight: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Metric history</h3>
        {hasMetrics ? (
          <select
            value={activeKey}
            onChange={(event) => setActiveKey(event.target.value)}
            style={{
              background: 'var(--panel-alt)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '6px 12px'
            }}
          >
            {options}
          </select>
        ) : (
          <span className="notice">No metrics logged yet.</span>
        )}
      </div>
      {hasMetrics ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="step" stroke="var(--muted)" />
            <YAxis stroke="var(--muted)" />
            <Tooltip
              contentStyle={{
                background: '#0f1216',
                border: '1px solid var(--border)',
                color: 'var(--text)'
              }}
              labelStyle={{ color: 'var(--muted)' }}
            />
            <Line type="monotone" dataKey={activeKey} stroke="#f3b532" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
