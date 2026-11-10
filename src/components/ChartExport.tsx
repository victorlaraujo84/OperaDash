import { useState } from 'react';
import { Download } from 'lucide-react';

export function ChartExport({ title }: { title: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download(panel: HTMLElement) {
    setBusy(true);
    setError('');
    try {
      const { toBlob } = await import('html-to-image');
      await document.fonts.ready;
      const blob = await toBlob(panel, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: node => !(node instanceof Element && node.matches('button, select, [data-chart-export], .recharts-tooltip-wrapper')),
      });
      if (!blob) throw new Error('Imagem indisponível.');
      const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `operadash-${slug || 'grafico'}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Não foi possível exportar o gráfico. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return <span className="chart-export" data-chart-export>
    <button type="button" className="button button--quiet button--small" disabled={busy}
      aria-label={`Exportar ${title} em PNG`} onClick={event => {
        const panel = event.currentTarget.closest('section');
        if (panel) void download(panel);
      }}>
      <Download size={14} aria-hidden="true" /> {busy ? 'Exportando…' : 'PNG'}
    </button>
    {error && <span className="chart-export__error" role="alert">{error}</span>}
  </span>;
}
