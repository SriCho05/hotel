import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { LayoutDashboard, MessageSquareText, ShieldAlert, Star, Settings, CheckCircle2, XCircle, Loader2, Upload, Send, Trash2, Plus, Save, BookOpen, Eye, EyeOff } from 'lucide-react';
import './index.css';

const socket = io('http://localhost:3001');

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState('DISCONNECTED');
  const [qrCode, setQrCode] = useState(null);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [campaignMessage, setCampaignMessage] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [config, setConfig] = useState({
    greetings: [],
    persona: '',
    geminiEnabled: true,
    autoReplyEnabled: true
  });
  const [faqs, setFaqs] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    socket.on('status', (s) => setStatus(s));
    socket.on('qr', (q) => setQrCode(q));
    socket.on('bulk-progress', (p) => setBulkProgress(p));

    const fetchData = async () => {
      try {
        const [statusRes, configRes, faqsRes, grievancesRes, reviewsRes] = await Promise.all([
          axios.get('http://localhost:3001/api/status'),
          axios.get('http://localhost:3001/api/config'),
          axios.get('http://localhost:3001/api/faqs'),
          axios.get('http://localhost:3001/api/grievances'),
          axios.get('http://localhost:3001/api/reviews')
        ]);
        setStatus(statusRes.data.status);
        setQrCode(statusRes.data.qr);
        setConfig(configRes.data);
        setFaqs(faqsRes.data);
        setGrievances(grievancesRes.data);
        setReviews(reviewsRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();

    return () => {
      socket.off('status');
      socket.off('qr');
      socket.off('bulk-progress');
    };
  }, []);

  const handleBulkSend = async () => {
    if (!excelFile) return alert('Select Excel file');
    if (!campaignMessage && mediaFiles.length === 0) {
      return alert('Please provide either a message or at least one media file.');
    }

    const formData = new FormData();
    formData.append('excel', excelFile);
    formData.append('message', campaignMessage);
    formData.append('mediaCaption', mediaCaption);
    mediaFiles.forEach(f => formData.append('media', f));
    // anchor:

    try {
      await axios.post('http://localhost:3001/api/bulk-send', formData);
      alert('Bulk send initiated');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  const saveConfig = async () => {
    setIsSaving(true);
    try {
      await axios.post('http://localhost:3001/api/config', config);
      alert('Settings saved successfully');
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const saveFaqs = async () => {
    setIsSaving(true);
    try {
      await axios.post('http://localhost:3001/api/faqs', { faqs });
      alert('Knowledge base updated successfully');
    } catch (err) {
      alert('Error saving FAQs: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFaq = () => {
    setFaqs([...faqs, { Question: '', Answer: '' }]);
  };

  const handleFaqChange = (index, field, value) => {
    const newFaqs = [...faqs];
    newFaqs[index][field] = value;
    setFaqs(newFaqs);
  };

  const handleDeleteFaq = (index) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  const renderDashboard = () => (
    <div className="grid">
      <div className="card">
        <h3>WhatsApp Connection</h3>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
          <div className={`status-badge status-${status}`}>
            {status === 'CONNECTED' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {status.replace(/_/g, ' ')}
          </div>
          {qrCode && (
            <div className="qr-container">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCode)}&size=200x200`} alt="QR Code" />
              <p style={{ color: '#000', marginTop: '0.5rem', textAlign: 'center', fontSize: '0.8rem' }}>Scan with WhatsApp</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Stats Overview</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Live messaging statistics will appear here.</p>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem' }}>0</h2>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Sent</span>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem' }}>0</h2>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Received</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBulkSender = () => (
    <div className="card">
      <h2>Bulk Message Studio</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Exclude Excel File (Numbers + Messages)</label>
          <input type="file" accept=".xlsx,.xls" onChange={e => setExcelFile(e.target.files[0])} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Campaign Message</label>
          <textarea
            placeholder="Type your message here..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', padding: '1rem', borderRadius: '8px', minHeight: '120px', resize: 'vertical' }}
            value={campaignMessage}
            onChange={e => setCampaignMessage(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Media Caption</label>
          <input
            type="text"
            placeholder="Text to show on images/videos..."
            value={mediaCaption}
            onChange={e => setMediaCaption(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Attach Media (Images/Videos/Docs)</label>
          <input type="file" multiple onChange={e => setMediaFiles(Array.from(e.target.files))} />
        </div>
        <button
          onClick={handleBulkSend}
          disabled={status !== 'CONNECTED' || !excelFile || (!campaignMessage && mediaFiles.length === 0)}
        >
          <Send size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Start Campaign
        </button>

        {bulkProgress && (
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
            <h3>Progress: {Math.round((bulkProgress.sent + bulkProgress.failed) / bulkProgress.total * 100)}%</h3>
            <div style={{ height: '8px', background: '#333', borderRadius: '4px', marginTop: '0.5rem' }}>
              <div style={{
                height: '100%',
                width: `${(bulkProgress.sent + bulkProgress.failed) / bulkProgress.total * 100}%`,
                background: 'var(--accent-color)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Sent: {bulkProgress.sent} | Failed: {bulkProgress.failed} | Total: {bulkProgress.total}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Current: {bulkProgress.current} ({bulkProgress.status})
              {bulkProgress.error && <span style={{ color: '#e74c3c', marginLeft: '0.5rem' }}> - {bulkProgress.error}</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderFaqs = () => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Knowledge Base (FAQ Manager)</h2>
        <button onClick={saveFaqs} disabled={isSaving}>
          <Save size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Save Changes
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {faqs.map((faq, index) => (
          <div key={index} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
            <button
              onClick={() => handleDeleteFaq(index)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem', background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', border: 'none' }}
            >
              <Trash2 size={16} />
            </button>
            <input
              type="text"
              placeholder="Question"
              value={faq.Question}
              onChange={(e) => handleFaqChange(index, 'Question', e.target.value)}
              style={{ width: '90%', fontSize: '0.9rem', fontWeight: '600' }}
            />
            <textarea
              placeholder="Answer"
              value={faq.Answer}
              onChange={(e) => handleFaqChange(index, 'Answer', e.target.value)}
              style={{ width: '100%', minHeight: '60px', fontSize: '0.85rem' }}
            />
          </div>
        ))}
        <button onClick={handleAddFaq} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px dashed var(--border-color)' }}>
          <Plus size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Add FAQ Item
        </button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
          <div style={{ width: 40, height: 40, background: 'var(--accent-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            <MessageSquareText size={24} />
          </div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Hotel Bot</h2>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div onClick={() => setActiveTab('dashboard')} className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <LayoutDashboard size={20} /> Dashboard
          </div>
          <div onClick={() => setActiveTab('bulk')} className={`nav-item ${activeTab === 'bulk' ? 'active' : ''}`}>
            <Upload size={20} /> Bulk Send
          </div>
          <div onClick={() => setActiveTab('faqs')} className={`nav-item ${activeTab === 'faqs' ? 'active' : ''}`}>
            <BookOpen size={20} /> Knowledge Base
          </div>
          <div onClick={() => setActiveTab('feedback')} className={`nav-item ${activeTab === 'feedback' ? 'active' : ''}`}>
            <ShieldAlert size={20} /> Grievances
          </div>
          <div onClick={() => setActiveTab('reviews')} className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`}>
            <Star size={20} /> Reviews
          </div>
          <div onClick={() => setActiveTab('settings')} className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}>
            <Settings size={20} /> Settings
          </div>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'CONNECTED' ? '#2ecc71' : '#e74c3c' }}></div>
            System Status
          </div>
          <p style={{ opacity: 0.6 }}>Version 2.0.0 Alpha</p>
        </div>
      </div>

      <main className="main-content">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'bulk' && renderBulkSender()}
        {activeTab === 'faqs' && renderFaqs()}
        {(activeTab === 'feedback' || activeTab === 'reviews') && (
          <div className="card">
            <h2>{activeTab === 'feedback' ? 'Customer Grievances' : 'Guest Reviews'}</h2>
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', opacity: 0.6 }}>
                    <th style={{ padding: '0.8rem' }}>Date</th>
                    <th style={{ padding: '0.8rem' }}>User</th>
                    {activeTab === 'reviews' && <th style={{ padding: '0.8rem' }}>Rating</th>}
                    <th style={{ padding: '0.8rem' }}>{activeTab === 'feedback' ? 'Description' : 'Comment'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'feedback' ? grievances : reviews).length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'reviews' ? 4 : 3} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                        No {activeTab === 'feedback' ? 'grievances' : 'reviews'} found yet.
                      </td>
                    </tr>
                  ) : (
                    (activeTab === 'feedback' ? grievances : reviews).slice().reverse().map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem', whiteSpace: 'nowrap' }}>{item.Date}</td>
                        <td style={{ padding: '0.8rem' }}>{item.User || item.UserNumber}</td>
                        {activeTab === 'reviews' && (
                          <td style={{ padding: '0.8rem' }}>
                            <div style={{ display: 'flex', color: '#f1c40f' }}>
                              {[...Array(5)].map((_, starI) => (
                                <Star key={starI} size={14} fill={starI < (item.Rating || 0) ? '#f1c40f' : 'none'} style={{ opacity: starI < (item.Rating || 0) ? 1 : 0.2 }} />
                              ))}
                            </div>
                          </td>
                        )}
                        <td style={{ padding: '0.8rem' }}>{item.Description || item.Review || item.Comment || item.Answer || "(No detail)"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Bot Configuration</h2>
              <button onClick={saveConfig} disabled={isSaving}>
                <Save size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Save Settings
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>Gemini AI Settings</h3>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Gemini API Key</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={config.geminiApiKey || ''}
                        onChange={e => setConfig({ ...config, geminiApiKey: e.target.value })}
                        placeholder="Enter your Gemini API Key"
                        style={{ width: '100%', paddingRight: '40px' }}
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        style={{
                          position: 'absolute',
                          right: '5px',
                          top: '50%',
                          transform: 'translateY(-65%)',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          padding: '5px'
                        }}
                      >
                        {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <button
                      onClick={async () => {
                        const btn = document.getElementById('test-btn');
                        const originalText = btn.innerText;
                        btn.innerText = 'Testing...';
                        btn.disabled = true;
                        try {
                          const res = await axios.post('http://localhost:3001/api/test-gemini', { apiKey: config.geminiApiKey });
                          alert(res.data.success ? res.data.message : 'Error: ' + res.data.error);
                        } catch (e) {
                          alert('Request Failed: ' + e.message);
                        } finally {
                          btn.innerText = originalText;
                          btn.disabled = false;
                        }
                      }}
                      id="test-btn"
                      disabled={!config.geminiApiKey}
                      style={{ background: 'var(--accent-color)', color: '#000', border: 'none' }}
                    >
                      Test Connection
                    </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Required for AI responses. Verify your key to check quota/status.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.geminiEnabled}
                      onChange={e => setConfig({ ...config, geminiEnabled: e.target.checked })}
                    />
                    Enable Gemini AI
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.autoReplyEnabled}
                      onChange={e => setConfig({ ...config, autoReplyEnabled: e.target.checked })}
                    />
                    Enable Auto-Reply
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Bot Persona & Instructions</label>
                <textarea
                  style={{ width: '100%', minHeight: '120px' }}
                  value={config.persona}
                  onChange={e => setConfig({ ...config, persona: e.target.value })}
                  placeholder="Describe how the bot should behave..."
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Greetings (One per line)</label>
                <textarea
                  style={{ width: '100%', minHeight: '100px' }}
                  value={config.greetings.join('\n')}
                  onChange={e => setConfig({ ...config, greetings: e.target.value.split('\n').filter(g => g.trim()) })}
                  placeholder="Enter greeting variants..."
                />
              </div>

              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>Tip:</strong> Use [Hotel Name] in your persona and greetings. The bot will automatically adapt to your specific hotel identity.
              </div>
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.8rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text-secondary);
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }
        .nav-item.active {
          background: rgba(212, 175, 55, 0.1);
          color: var(--accent-color);
        }
      `}} />
    </div>
  );
}

export default App;
