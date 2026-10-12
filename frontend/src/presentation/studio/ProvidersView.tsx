import React, { useEffect, useState } from 'react';
import { ProviderStatus } from '../../infrastructure/api/UpApiClient';
import { useStudio } from './StudioContext';

const CAPABILITY_LABELS: Record<string, string> = {
  text: 'Text generation',
  vision: 'Vision (image understanding)',
  image: 'Image generation',
  embedding: 'Embeddings (vector search)',
};

export const ProvidersView: React.FC = () => {
  const { api, setError } = useStudio();
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [error, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setStatus(await api.providerStatus());
      } catch (err) {
        setError((err as Error).message);
        setLocalError((err as Error).message);
      }
    })();
  }, [api, setError]);

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold">AI providers</h2>
      <p className="text-xs text-muted-foreground">
        No provider is configured by default. Generation is refused (HTTP 409) until the required capability has a
        provider. Configure providers in <code>worker/.env</code>.
      </p>
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</div>
      ) : !status ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60">
              <tr>
                <th className="px-3 py-2">Capability</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Configured</th>
                <th className="px-3 py-2">Reachable</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(status.capabilities).map(([cap, info]) => (
                <tr key={cap} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{CAPABILITY_LABELS[cap] || cap}</td>
                  <td className="px-3 py-2">{info.provider || '—'}</td>
                  <td className="px-3 py-2">{info.model || '—'}</td>
                  <td className="px-3 py-2">{info.configured ? '✅' : '—'}</td>
                  <td className="px-3 py-2">{info.reachable ? '✅' : '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{info.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
