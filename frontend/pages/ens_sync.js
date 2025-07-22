const FIELDS = {
  vaultfire_sync: 'true',
  ghostkey_id: 'Ghostkey-316',
  loyalty_tier: 'Legacy Tier',
  status: 'Active Contributor'
};

function App() {
  const [ens, setEns] = React.useState('');
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [provider, setProvider] = React.useState(null);
  const web3ModalRef = React.useRef(null);

  React.useEffect(() => {
    web3ModalRef.current = new window.Web3Modal.default({ cacheProvider: false });
  }, []);

  async function checkStatus(e) {
    e.preventDefault();
    setError('');
    setStatus(null);
    if (!ens) {
      setError('ENS name required');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/ens_sync_status?ens=${encodeURIComponent(ens)}`);
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      if (!data || Object.keys(data).length === 0) {
        setStatus({ vaultfire_sync: 'false', message: 'No record found' });
      } else {
        setStatus(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet() {
    try {
      const instance = await web3ModalRef.current.connect();
      const prov = new ethers.providers.Web3Provider(instance);
      setProvider(prov);
      return prov;
    } catch (err) {
      setError('Wallet connection failed');
      return null;
    }
  }

  async function updateRecords() {
    const prov = provider || await connectWallet();
    if (!prov) return;
    setLoading(true);
    setError('');
    try {
      const signer = prov.getSigner();
      const resolver = await prov.getResolver(ens);
      if (!resolver) throw new Error('Resolver not found');
      const withSigner = resolver.connect(signer);
      for (const [key, value] of Object.entries(FIELDS)) {
        await withSigner.setText(key, value);
      }
      alert('Records updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const outOfSync = status && status.vaultfire_sync !== 'true';

  return (
    <div>
      <h1>Vaultfire ENS Sync</h1>
      <form onSubmit={checkStatus}>
        <input
          value={ens}
          onChange={e => setEns(e.target.value)}
          placeholder="yourname.eth"
        />
        <button type="submit">Check Status</button>
      </form>
      {loading && <p>Loading...</p>}
      {error && <p style={{color:'red'}}>{error}</p>}
      {status && (
        <div>
          <h3>Status</h3>
          <pre>{JSON.stringify(status, null, 2)}</pre>
          {outOfSync ? (
            <button onClick={updateRecords}>Update Text Records</button>
          ) : (
            <p>Records in sync</p>
          )}
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));

