import { useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';

export function CompanyLogoSettings({ logo, onChange }: { logo: string; onChange: (logo: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async (file: File) => {
    setError(''); setBusy(true);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Selecione uma imagem PNG, JPG ou WebP.');
      if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('O logo precisa ter até 2 MB e não pode estar vazio.');
      const bitmap = await createImageBitmap(file); bitmap.close();
      const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file); });
      localStorage.setItem('operadash:company-logo', url); onChange(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível aplicar o logo.'); }
    finally { setBusy(false); }
  };
  return <section className="panel company-logo-settings"><div className="sidebar-source-panel__header"><span className="itsm-panel-icon"><ImagePlus size={18} /></span><div><span className="section-kicker">IDENTIDADE VISUAL</span><h2>Logo da empresa</h2></div></div><p>Personalize a marca do menu lateral. O logo fica salvo somente neste navegador.</p>{logo && <div className="company-logo-preview"><img src={logo} alt="Logo atual da empresa" /></div>}<input ref={input} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Arquivo do logo da empresa" onChange={event => { const file = event.target.files?.[0]; if (file) void load(file); event.target.value = ''; }} /><div className="mapping-actions"><button className="button button--quiet" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} />{busy ? 'Carregando…' : logo ? 'Trocar logo' : 'Adicionar logo'}</button>{logo && <button className="button button--quiet" onClick={() => { localStorage.removeItem('operadash:company-logo'); onChange(''); setError(''); }}><X size={14} />Remover logo</button>}</div><small>PNG, JPG ou WebP · até 2 MB. Prefira uma imagem horizontal com fundo transparente.</small>{error && <p className="source-warning" role="alert">{error}</p>}</section>;
}
