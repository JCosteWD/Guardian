import React, { useState, useEffect } from 'react';
import { API } from './components/api';
import { AppProvider, useApp } from './components/context';
import { LoginPage } from './components/pages/LoginPage';
import { OverviewPage } from './components/pages/OverviewPage';
import { ChildrenPage } from './components/pages/ChildrenPage';
import { RulesPage } from './components/pages/RulesPage';
import { SubscriptionPage } from './components/pages/SubscriptionPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { ChildChatPage } from './components/pages/ChildChatPage';
import { ChildQuizPage } from './components/pages/ChildQuizPage';
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/layout/Toast';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a12;
    --surface: #13131f;
    --surface2: #1a1a2e;
    --border: #252540;
    --purple: #6C63FF;
    --blue: #3B82F6;
    --green: #51CF66;
    --yellow: #FFD93D;
    --red: #FF6B6B;
    --orange: #FF922B;
    --text: #F0F0FA;
    --muted: #888;
    --radius: 16px;
  }

  body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; min-height: 100vh; }

  .app { display: flex; min-height: 100vh; }

  .sidebar {
    width: 240px; background: var(--surface); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; position: fixed; height: 100vh; z-index: 10;
  }
  .sidebar-logo {
    padding: 28px 24px 20px; display: flex; align-items: center; gap: 10;
    border-bottom: 1px solid var(--border);
  }
  .logo-shield { font-size: 28px; }
  .logo-text { font-size: 20px; font-weight: 800; background: linear-gradient(135deg,#6C63FF,#3B82F6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  .logo-plan { font-size: 10px; background: var(--purple); color:#fff; border-radius:6px; padding:2px 6px; margin-left:4px; font-weight:700; }

  .nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 4; }
  .nav-item {
    display: flex; align-items: center; gap: 10; padding: 10px 14px;
    border-radius: 12px; cursor: pointer; color: var(--muted);
    font-size: 14px; font-weight: 500; transition: all .15s; border: none; background: none; width: 100%; text-align: left;
  }
  .nav-item:hover { background: var(--surface2); color: var(--text); }
  .nav-item.active { background: linear-gradient(135deg,#6C63FF22,#3B82F622); color: var(--purple); font-weight: 700; }
  .nav-item .icon { font-size: 18px; width: 24px; text-align: center; }

  .sidebar-bottom { padding: 16px 12px; border-top: 1px solid var(--border); }

  .main { margin-left: 240px; flex: 1; padding: 32px; max-width: calc(100vw - 240px); }

  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 28px;
  }
  .page-title { font-size: 26px; font-weight: 800; }
  .page-sub { font-size: 14px; color: var(--muted); margin-top: 4px; text-transform: capitalize; }

  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 24px;
  }
  .card-header { font-size: 15px; font-weight: 700; margin-bottom: 18px; display: flex; align-items: center; gap: 8; }

  .grid { display: grid; gap: 16px; }
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }

  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px;
    display: flex; flex-direction: column; gap: 6;
  }
  .stat-label { font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .8px; }
  .stat-value { font-size: 28px; font-weight: 800; }
  .stat-sub { font-size: 12px; color: var(--muted); }

  .child-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px;
    cursor: pointer; transition: border-color .15s;
  }
  .child-card:hover { border-color: var(--purple); }
  .child-card-header { display: flex; align-items: center; gap: 14; margin-bottom: 16; }
  .child-avatar {
    width: 48px; height: 48px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 800; color: #fff; position: relative;
  }
  .online-dot {
    position: absolute; bottom: 1px; right: 1px;
    width: 11px; height: 11px; border-radius: 50%;
    background: var(--green); border: 2px solid var(--surface);
  }
  .child-name { font-size: 17px; font-weight: 700; }
  .child-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }

  .progress-bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
  .progress-fill { height: 100%; border-radius: 4px; transition: width .5s; }

  .qa-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8; margin-top: 14; }
  .qa-btn {
    display: flex; flex-direction: column; align-items: center; gap: 4;
    padding: 10px 6px; border-radius: 12px; cursor: pointer;
    border: 1px solid var(--border); background: var(--surface2);
    transition: all .15s; font-size: 13px; font-weight: 600; color: var(--muted);
  }
  .qa-btn:hover { transform: translateY(-2px); border-color: currentColor; }
  .qa-btn .qa-icon { font-size: 20px; }

  .badge { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; }

  .btn {
    display: inline-flex; align-items: center; gap: 6; padding: 10px 18px;
    border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer;
    border: none; transition: all .15s;
  }
  .btn-primary { background: linear-gradient(135deg,var(--purple),var(--blue)); color: #fff; }
  .btn-primary:hover { opacity: .9; transform: translateY(-1px); }
  .btn-ghost { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
  .btn-danger { background: #FF6B6B22; color: var(--red); border: 1px solid var(--red); }

  .input {
    width: 100%; padding: 11px 14px; background: var(--surface2);
    border: 1px solid var(--border); border-radius: 12px;
    color: var(--text); font-size: 14px; font-family: inherit; outline: none;
    transition: border-color .15s;
  }
  .input:focus { border-color: var(--purple); }
  .input::placeholder { color: var(--muted); }

  .toggle { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-slider {
    position: absolute; inset: 0; background: var(--border); border-radius: 24px; transition: .3s;
  }
  .toggle-slider::before {
    content: ''; position: absolute; width: 18px; height: 18px;
    background: #fff; border-radius: 50%; top: 3px; left: 3px; transition: .3s;
  }
  .toggle input:checked + .toggle-slider { background: var(--purple); }
  .toggle input:checked + .toggle-slider::before { transform: translateX(20px); }

  .table { width: 100%; border-collapse: collapse; }
  .table th { text-align: left; padding: 10px 14px; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .8px; border-bottom: 1px solid var(--border); }
  .table td { padding: 12px 14px; font-size: 14px; border-bottom: 1px solid var(--border); }
  .table tr:last-child td { border-bottom: none; }
  .table tr:hover td { background: var(--surface2); }

  .plan-card { border-radius: var(--radius); padding: 24px; border: 2px solid var(--border); position: relative; }
  .plan-card.featured { border-color: var(--purple); }
  .plan-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--purple); color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .plan-price { font-size: 36px; font-weight: 900; margin: 12px 0 4px; }
  .plan-period { font-size: 14px; color: var(--muted); }
  .plan-features { list-style: none; margin-top: 16px; display: flex; flex-direction: column; gap: 10; }
  .plan-features li { display: flex; align-items: center; gap: 8; font-size: 14px; }

  .toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 200;
    padding: 14px 20px; border-radius: 14px; font-weight: 600; font-size: 14px;
    animation: slideIn .3s ease;
  }
  @keyframes slideIn { from { transform: translateX(100px); opacity:0; } to { transform: translateX(0); opacity:1; } }

  @media (max-width: 900px) {
    .sidebar { width: 60px; }
    .sidebar .logo-text, .sidebar .logo-plan, .nav-item span, .sidebar-bottom span { display: none; }
    .nav-item { justify-content: center; padding: 12px; }
    .main { margin-left: 60px; }
    .grid-4 { grid-template-columns: repeat(2,1fr); }
  }
`;

function AppContent() {
  const [parent, setParent] = useState(null);
  const [page, setPage] = useState('overview');
  const { toast, showToast, loadChildren } = useApp();

  useEffect(() => {
    const token = localStorage.getItem('guardian_token');
    if (token) {
      API.get('/children').then(r => {
        setParent({ firstName: 'Parent' });
      }).catch(() => localStorage.removeItem('guardian_token'));
    }
  }, []);

  if (!parent) {
    return <LoginPage onLogin={setParent} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'overview': return <OverviewPage />;
      case 'children': return <ChildrenPage />;
      case 'rules': return <RulesPage />;
      case 'subscription': return <SubscriptionPage />;
      case 'settings': return <SettingsPage />;
      case 'child-chat': return <ChildChatPage />;
      default: return <OverviewPage />;
    }
  };

  return (
    <div className="app">
      <style>{css}</style>
      <Sidebar page={page} setPage={setPage} />
      <div className="main">
        {renderPage()}
      </div>
      <Toast toast={toast} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
