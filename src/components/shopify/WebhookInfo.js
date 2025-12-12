import { useState, useEffect } from 'react';

export default function WebhookInfo({ onBitrixUrlChange }) {
  // Static webhook URLs - these will never change
  const [baseUrl, setBaseUrl] = useState('');
  const [bitrixWebhookUrl, setBitrixWebhookUrl] = useState('https://bfcshoes.bitrix24.eu/rest/52/i6l05o71ywxb8j1l');
  
  // Static Shopify webhook endpoints
  const [shopifyWebhooks, setShopifyWebhooks] = useState({
    'order/crt': '',
    'order/upd': '',
    'product/upd': '',
    'refund/crt': ''
  });
  
  const [bitrixWebhookEndpointUrl, setBitrixWebhookEndpointUrl] = useState('');
  
  // Selected webhook from dropdown
  const [selectedWebhook, setSelectedWebhook] = useState('order/crt');
  
  // Copy states
  const [shopifyCopied, setShopifyCopied] = useState(false);
  const [bitrixEndpointCopied, setBitrixEndpointCopied] = useState(false);
  const [bitrixCopied, setBitrixCopied] = useState(false);
  
  // Password states
  const [password, setPassword] = useState('');
  const [bitrixEndpointPassword, setBitrixEndpointPassword] = useState('');
  const [bitrixPassword, setBitrixPassword] = useState('');
  
  // Unlock states
  const [unlocked, setUnlocked] = useState(false);
  const [bitrixEndpointUnlocked, setBitrixEndpointUnlocked] = useState(false);
  const [bitrixUnlocked, setBitrixUnlocked] = useState(false);
  
  const CORRECT_PASSWORD = '1spotify2';

  useEffect(() => {
    // Get base URL from current origin - static paths
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setBaseUrl(origin);
    
    // Set static Shopify webhook URLs
    setShopifyWebhooks({
      'order/crt': `${origin}/api/webhook/shopify/order/crt`,
      'order/upd': `${origin}/api/webhook/shopify/order/upd`,
      'product/upd': `${origin}/api/webhook/shopify/product/upd`,
      'refund/crt': `${origin}/api/webhook/shopify/refund/crt`
    });
    
    // Set static Bitrix webhook endpoint URL
    setBitrixWebhookEndpointUrl(`${origin}/api/webhook/bitrix`);
  }, []);

  useEffect(() => {
    if (onBitrixUrlChange) {
      onBitrixUrlChange(bitrixWebhookUrl);
    }
  }, [bitrixWebhookUrl, onBitrixUrlChange]);

  const handleShopifyCopy = () => {
    const url = shopifyWebhooks[selectedWebhook];
    if (url) {
      navigator.clipboard.writeText(url);
      setShopifyCopied(true);
      setTimeout(() => setShopifyCopied(false), 2000);
    }
  };

  const handleBitrixEndpointCopy = () => {
    navigator.clipboard.writeText(bitrixWebhookEndpointUrl);
    setBitrixEndpointCopied(true);
    setTimeout(() => setBitrixEndpointCopied(false), 2000);
  };

  const handleBitrixCopy = () => {
    navigator.clipboard.writeText(bitrixWebhookUrl);
    setBitrixCopied(true);
    setTimeout(() => setBitrixCopied(false), 2000);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setUnlocked(true);
      setPassword('');
    } else {
      alert('Incorrect password');
      setPassword('');
    }
  };

  const handleBitrixEndpointPasswordSubmit = (e) => {
    e.preventDefault();
    if (bitrixEndpointPassword === CORRECT_PASSWORD) {
      setBitrixEndpointUnlocked(true);
      setBitrixEndpointPassword('');
    } else {
      alert('Incorrect password');
      setBitrixEndpointPassword('');
    }
  };

  const handleBitrixPasswordSubmit = (e) => {
    e.preventDefault();
    if (bitrixPassword === CORRECT_PASSWORD) {
      setBitrixUnlocked(true);
      setBitrixPassword('');
    } else {
      alert('Incorrect password');
      setBitrixPassword('');
    }
  };

  const selectedUrl = shopifyWebhooks[selectedWebhook] || '';

  return (
    <div className="card">
      <header className="card-header">
        <h2>Webhook Configuration</h2>
      </header>
      <div style={{ padding: '20px' }}>
        {/* Shopify Webhooks - Single password field with dropdown */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '0.9rem' }}>
            Shopify webhook endpoints (static URLs - configure once in Shopify):
          </p>
          {!unlocked ? (
            <form onSubmit={handlePasswordSubmit} style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '12px',
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #334155'
              }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to view URLs"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    padding: '4px 8px'
                  }}
                />
                <button
                  type="submit"
                  className="btn"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Unlock
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                marginBottom: '12px',
                padding: '12px',
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #334155'
              }}>
                <select
                  value={selectedWebhook}
                  onChange={(e) => setSelectedWebhook(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    padding: '8px 12px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="order/crt">Order Create (order/crt)</option>
                  <option value="order/upd">Order Update (order/upd)</option>
                  <option value="product/upd">Product Update (product/upd)</option>
                  <option value="refund/crt">Refund Create (refund/crt)</option>
                </select>
                <button
                  onClick={handleShopifyCopy}
                  className="btn"
                  style={{ whiteSpace: 'nowrap' }}
                  title="Copy webhook URL"
                >
                  {shopifyCopied ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => setUnlocked(false)}
                  className="btn"
                  style={{ whiteSpace: 'nowrap', background: '#6b7280' }}
                  title="Lock URLs"
                >
                  🔒 Lock
                </button>
              </div>
              <div style={{
                padding: '12px',
                background: '#0f172a',
                borderRadius: '8px',
                border: '1px solid #334155'
              }}>
                <code style={{
                  color: '#f1f5f9',
                  fontSize: '0.85rem',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  display: 'block'
                }}>
                  {selectedUrl}
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Bitrix24 Webhook Endpoint */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '0.9rem' }}>
            Bitrix24 webhook endpoint (static URL - for receiving events from Bitrix):
          </p>
          {!bitrixEndpointUnlocked ? (
            <form onSubmit={handleBitrixEndpointPasswordSubmit} style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '12px',
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #334155'
              }}>
                <input
                  type="password"
                  value={bitrixEndpointPassword}
                  onChange={(e) => setBitrixEndpointPassword(e.target.value)}
                  placeholder="Enter password to view URL"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    padding: '4px 8px'
                  }}
                />
                <button
                  type="submit"
                  className="btn"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Unlock
                </button>
              </div>
            </form>
          ) : (
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '12px',
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155'
            }}>
              <code style={{
                flex: 1,
                color: '#f1f5f9',
                fontSize: '0.9rem',
                wordBreak: 'break-all',
                fontFamily: 'monospace'
              }}>
                {bitrixWebhookEndpointUrl}
              </code>
              <button
                onClick={handleBitrixEndpointCopy}
                className="btn"
                style={{ whiteSpace: 'nowrap' }}
                title="Copy webhook URL"
              >
                {bitrixEndpointCopied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setBitrixEndpointUnlocked(false)}
                className="btn"
                style={{ whiteSpace: 'nowrap', background: '#6b7280' }}
                title="Lock URL"
              >
                🔒 Lock
              </button>
            </div>
          )}
        </div>

        {/* Bitrix24 Webhook (for sending events) */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '0.9rem' }}>
            Bitrix24 webhook (static URL - for sending events to Bitrix):
          </p>
          {!bitrixUnlocked ? (
            <form onSubmit={handleBitrixPasswordSubmit} style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '12px',
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #334155'
              }}>
                <input
                  type="password"
                  value={bitrixPassword}
                  onChange={(e) => setBitrixPassword(e.target.value)}
                  placeholder="Enter password to view/edit URL"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    padding: '4px 8px'
                  }}
                />
                <button
                  type="submit"
                  className="btn"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Unlock
                </button>
              </div>
            </form>
          ) : (
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '12px',
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155'
            }}>
              <input
                type="text"
                value={bitrixWebhookUrl}
                onChange={(e) => setBitrixWebhookUrl(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#f1f5f9',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  outline: 'none',
                  padding: '4px 8px'
                }}
                placeholder="Enter Bitrix webhook URL"
              />
              <button
                onClick={handleBitrixCopy}
                className="btn"
                style={{ whiteSpace: 'nowrap' }}
                title="Copy webhook URL"
              >
                {bitrixCopied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setBitrixUnlocked(false)}
                className="btn"
                style={{ whiteSpace: 'nowrap', background: '#6b7280' }}
                title="Lock URL"
              >
                🔒 Lock
              </button>
            </div>
          )}
        </div>

        <div className="alert alert-info" style={{ marginTop: '20px' }}>
          <strong>Setup Instructions:</strong>
          <ol style={{ marginTop: '12px', paddingLeft: '20px', color: '#cbd5e1' }}>
            <li style={{ marginBottom: '8px' }}>Go to your Shopify Admin</li>
            <li style={{ marginBottom: '8px' }}>Navigate to Settings → Notifications</li>
            <li style={{ marginBottom: '8px' }}>Scroll to "Webhooks" section</li>
            <li style={{ marginBottom: '8px' }}>Click "Create webhook" for each event:</li>
            <ul style={{ marginLeft: '20px', marginTop: '4px', marginBottom: '8px' }}>
              <li>Order creation → Use "order/crt" URL</li>
              <li>Order update → Use "order/upd" URL</li>
              <li>Product update → Use "product/upd" URL</li>
              <li>Refund create → Use "refund/crt" URL</li>
            </ul>
            <li style={{ marginBottom: '8px' }}>Select format: JSON</li>
            <li>Save each webhook (these URLs are static and will never change)</li>
          </ol>
        </div>

        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <p style={{ color: '#60a5fa', fontWeight: 600, marginBottom: '8px' }}>ℹ Static Webhook URLs</p>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '4px' }}>
            All webhook URLs are now static and will never change. Configure them once in Shopify and you won't need to update them.
          </p>
          <ul style={{ color: '#cbd5e1', fontSize: '0.85rem', paddingLeft: '20px', marginTop: '8px' }}>
            <li><strong>order/crt</strong> - Handles order creation events</li>
            <li><strong>order/upd</strong> - Handles order update events (main trigger for product rows, amounts, status)</li>
            <li><strong>product/upd</strong> - Updates internal product catalog (does not affect deals)</li>
            <li><strong>refund/crt</strong> - Handles refund events</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
