import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { LockKeyhole, LogOut, Users } from 'lucide-react';
import App from '../App';
import { clientDocuments, portalJson, PortalError, type PortalAccount, type PortalClient, type PortalUser } from '../lib/portal-api';

const sessionNotice = 'operadash:session-updated';
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.';

function AccessCard({ title, children }: { title: string; children?: ReactNode }) {
  return <main className="portal-access"><section className="portal-access__card panel">
    <div className="portal-access__brand"><LockKeyhole size={20} aria-hidden="true" /> OperaDash</div>
    <h1>{title}</h1>
    {children}
  </section></main>;
}

function AccessForm({ user, onSession }: { user: PortalUser | null; onSession: (user: PortalUser) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const body = user ? { current: form.get('current'), password: form.get('password') } : { login: form.get('login'), password: form.get('password') };
      onSession(await portalJson<PortalUser>(user ? 'password' : 'login', 'POST', body));
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  return <form className="portal-form" onSubmit={submit}>
    {user ? <label>Senha atual<input name="current" type="password" autoComplete="current-password" maxLength={128} required /></label>
      : <label>Usuário<input name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={128} required /></label>}
    <label>{user ? 'Nova senha' : 'Senha'}<input name="password" type="password" autoComplete={user ? 'new-password' : 'current-password'} minLength={user ? 12 : undefined} maxLength={128} required /></label>
    {error && <p role="alert">{error}</p>}
    <button className="button portal-primary" disabled={busy}>{busy ? 'Aguarde…' : user ? 'Salvar nova senha' : 'Entrar'}</button>
  </form>;
}

function Administration({ clients, reloadClients }: { clients: PortalClient[]; reloadClients: () => Promise<void> }) {
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const refreshAccounts = async () => setAccounts(await portalJson<PortalAccount[]>('admin/users'));
  useEffect(() => { void refreshAccounts().catch(cause => setError(errorText(cause))); }, []);

  async function submit(event: FormEvent<HTMLFormElement>, kind: 'client' | 'account' | 'reset') {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (kind === 'client') {
        await portalJson('admin/clients', 'POST', { name: values.get('name') });
        await reloadClients();
      } else if (kind === 'account') {
        await portalJson('admin/users', 'POST', { login: values.get('login'), password: values.get('password'), clientId: Number(values.get('client')) });
        await refreshAccounts();
      } else {
        await portalJson('admin/users/' + selected, 'PATCH', { password: values.get('password') });
        await refreshAccounts();
      }
      form.reset();
      setNotice(kind === 'client' ? 'Cliente cadastrado.' : kind === 'account' ? 'Conta criada. A senha inicial será trocada no primeiro acesso.' : 'Senha redefinida e sessões encerradas.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  async function toggle(account: PortalAccount) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await portalJson('admin/users/' + account.id, 'PATCH', { active: !account.active });
      await refreshAccounts();
      setNotice(account.active ? 'Conta desativada.' : 'Conta reativada.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  return <main className="portal-admin">
    <h1>Administração</h1>
    <p>Cadastre um cliente e vincule suas contas de consulta. Para carregar arquivos, selecione o cliente e abra Fontes e configurações.</p>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="portal-admin__forms">
      <form className="portal-form panel" onSubmit={event => void submit(event, 'client')}>
        <h2>Novo cliente</h2>
        <label>Nome do cliente<input name="name" required maxLength={100} /></label>
        <button className="button portal-primary" disabled={busy}>Cadastrar cliente</button>
      </form>
      <form className="portal-form panel" onSubmit={event => void submit(event, 'account')}>
        <h2>Nova conta de consulta</h2>
        <label>Cliente<select name="client" required><option value="">Selecione</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label>Usuário<input name="login" required minLength={3} maxLength={128} autoComplete="off" /></label>
        <label>Senha inicial<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
        <button className="button portal-primary" disabled={busy || !clients.length}>Criar conta</button>
      </form>
      <form className="portal-form panel" onSubmit={event => void submit(event, 'reset')}>
        <h2>Redefinir senha</h2>
        <label>Conta<select required value={selected} onChange={event => setSelected(event.target.value)}><option value="">Selecione</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.login}</option>)}</select></label>
        <label>Nova senha inicial<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
        <button className="button portal-primary" disabled={busy || !selected}>Redefinir senha</button>
      </form>
    </div>
    <section className="panel portal-admin__accounts">
      <h2>Contas de clientes</h2>
      {accounts.length ? <div className="solor-table-scroll"><table className="solor-data-table"><thead><tr><th>Usuário</th><th>Cliente</th><th>Status</th><th>Ação</th></tr></thead>
        <tbody>{accounts.map(account => <tr key={account.id}><td>{account.login}</td><td>{clients.find(client => client.id === account.clientId)?.name}</td>
          <td>{account.active ? account.mustChange ? 'Aguardando troca de senha' : 'Ativa' : 'Desativada'}</td>
          <td><button className="button button--quiet" disabled={busy} onClick={() => void toggle(account)}>{account.active ? 'Desativar' : 'Reativar'}</button></td></tr>)}</tbody>
      </table></div> : <p>Nenhuma conta cadastrada.</p>}
    </section>
  </main>;
}

function Workspace({ user, logout, password }: { user: PortalUser; logout: () => void; password: () => void }) {
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [selection, setSelection] = useState('');
  const [adminPanel, setAdminPanel] = useState(false);
  const [error, setError] = useState('');
  const admin = user.role === 'admin';
  const clientId = admin ? Number(selection) : user.clientId ?? 0;
  const storage = useMemo(() => clientId ? clientDocuments(clientId) : null, [clientId]);
  const reloadClients = async () => setClients(await portalJson<PortalClient[]>('clients'));
  useEffect(() => { void reloadClients().catch(cause => setError(errorText(cause))); }, []);
  return <>
    <header className="portal-toolbar">
      <span><strong>{user.login}</strong> · {admin ? 'Administrador' : clients.find(client => client.id === clientId)?.name ?? 'Cliente'}</span>
      {admin && <>
        <label>Cliente ativo <select value={selection} onChange={event => { setSelection(event.target.value); setAdminPanel(false); }}>
          <option value="">Selecione um cliente</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select></label>
        {clientId > 0 && <button className="button button--quiet" onClick={() => setAdminPanel(!adminPanel)}><Users size={15} />{adminPanel ? 'Voltar ao painel' : 'Administração'}</button>}
      </>}
      <button className="button button--quiet" onClick={password}>Alterar senha</button>
      <button className="button button--quiet" onClick={logout}><LogOut size={15} />Sair</button>
    </header>
    {error && <p role="alert" className="portal-error">{error}</p>}
    {admin && (adminPanel || !storage) ? <Administration clients={clients} reloadClients={reloadClients} />
      : storage && <App key={clientId} documents={storage} readOnly={!admin} />}
  </>;
}

export function Portal() {
  const [user, setUser] = useState<PortalUser | null>();
  const [error, setError] = useState('');
  const [changing, setChanging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const verification = useRef(0);
  const notifySession = () => {
    try { localStorage.setItem(sessionNotice, String(Date.now())); } catch { /* Session cookies still work when browser storage is unavailable. */ }
  };
  const accept = (next: PortalUser) => {
    verification.current++;
    setUser(next);
    setChanging(false);
    setError('');
    notifySession();
  };

  useEffect(() => {
    const verify = async () => {
      const request = ++verification.current;
      try {
        const next = await portalJson<PortalUser>('session');
        if (request === verification.current) { setUser(next); setError(''); }
      } catch (cause) {
        if (request !== verification.current) return;
        setUser(null);
        setError(cause instanceof PortalError && cause.status === 401 ? '' : 'Não foi possível verificar a sessão. Atualize a página para tentar novamente.');
      }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === sessionNotice) { setUser(undefined); void verify(); } };
    void verify();
    const timer = setInterval(verify, 30_000);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', verify);
    return () => { verification.current++; clearInterval(timer); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', verify); };
  }, []);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await portalJson('logout', 'POST');
    } catch (cause) {
      if (!(cause instanceof PortalError && cause.status === 401)) {
        setError('A saída não pôde ser confirmada. Tente novamente.');
        setLoggingOut(false);
        return;
      }
    }
    verification.current++;
    setUser(null);
    setChanging(false);
    setError('');
    notifySession();
    setLoggingOut(false);
  };

  if (loggingOut) return <AccessCard title="Encerrando sessão…" />;
  if (user === undefined) return <AccessCard title="Verificando acesso…" />;
  if (!user) return <AccessCard title="Entre no OperaDash">{error && <p role="alert">{error}</p>}<AccessForm user={null} onSession={accept} /></AccessCard>;
  if (user.mustChange || changing) return <AccessCard title="Altere sua senha">
    {user.mustChange && <p>Defina uma senha pessoal de pelo menos 12 caracteres para acessar o portal.</p>}
    {error && <p role="alert">{error}</p>}
    <AccessForm key={user.id} user={user} onSession={accept} />
    <button className="button button--quiet" onClick={() => user.mustChange ? void logout() : setChanging(false)}>{user.mustChange ? 'Sair' : 'Cancelar'}</button>
  </AccessCard>;
  return <>{error && <p className="portal-error" role="alert">{error}</p>}
    <Workspace key={user.id} user={user} logout={() => void logout()} password={() => setChanging(true)} />
  </>;
}
