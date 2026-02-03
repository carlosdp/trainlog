export function StateBadge({ state }: { state: string }) {
  const normalized = state?.toLowerCase();
  const className =
    normalized === 'finished'
      ? 'badge ok'
      : normalized === 'failed' || normalized === 'crashed'
        ? 'badge warn'
        : 'badge';
  return <span className={className}>{normalized || 'running'}</span>;
}
