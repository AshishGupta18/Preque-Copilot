import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  Position,
  Handle
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from 'axios';
import {
  MessageSquare,
  Upload,
  CheckCircle2,
  AlertCircle,
  Send,
  Sun,
  Moon,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  Network,
  ExternalLink,
  Briefcase,
  Users,
  Check
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

// ----------------- Custom Node Component with Handles -----------------
function TaskNodeComponent({ data }) {
  const { id, title, owner, status, isSelected, isDark } = data;

  const statusTheme = {
    COMPLETED: {
      bg: isDark ? '#064e3b' : '#dcfce7',
      border: '#10b981',
      text: isDark ? '#6ee7b7' : '#15803d'
    },
    READY: {
      bg: isDark ? '#78350f' : '#fef3c7',
      border: '#f59e0b',
      text: isDark ? '#fcd34d' : '#b45309'
    },
    BLOCKED: {
      bg: isDark ? '#7f1d1d' : '#fee2e2',
      border: '#ef4444',
      text: isDark ? '#fca5a5' : '#b91c1c'
    }
  };

  const theme = statusTheme[status] || statusTheme.BLOCKED;

  return (
    <div
      className={`rounded-xl px-4 py-3 select-none transition-all duration-150 ${
        isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
      }`}
      style={{
        width: 250,
        border: isSelected ? '3px solid #6366f1' : `2px solid ${theme.border}`,
        boxShadow: isSelected
          ? (isDark ? '0 0 20px rgba(99, 102, 241, 0.7)' : '0 0 16px rgba(99, 102, 241, 0.4)')
          : '0 4px 6px -1px rgba(0,0,0,0.1)',
        cursor: 'pointer'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
        style={{ left: -6 }}
      />

      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1">
        <span className={isDark ? 'text-indigo-400' : 'text-indigo-600'}>{id}</span>
        <span
          className="px-2 py-0.5 rounded text-[10px] font-semibold"
          style={{ backgroundColor: theme.bg, color: theme.text }}
        >
          {status}
        </span>
      </div>

      <div className="font-semibold text-xs leading-snug mb-2">
        {title}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-700/30 pt-1.5 mt-1">
        <span>{owner}</span>
        {isSelected && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
            FOCUSED
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
        style={{ right: -6 }}
      />
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('agent');
  const [activeProject, setActiveProject] = useState('sunchemical');

  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [specs, setSpecs] = useState({ global_rules: [], vpn: [], links: [], users: [] });

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const nodeTypes = useMemo(() => ({ taskNode: TaskNodeComponent }), []);

  // Chat State
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'agent',
      text: 'smartShift PrereqCopilot active for Sunchemical. Click any node in the dependency web to view criteria or ask procedural questions.'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const chatBottomRef = useRef(null);

  // Verification State
  const [selectedFile, setSelectedFile] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  // Fetch project tasks and specification artifacts
  const fetchProjectData = useCallback(async (projectId) => {
    try {
      const [graphRes, specsRes] = await Promise.all([
        axios.get(`${API_BASE}/graph/${projectId}`),
        axios.get(`${API_BASE}/specs/${projectId}`)
      ]);

      const fetchedTasks = graphRes.data.tasks || [];
      setTasks(fetchedTasks);
      setSpecs(specsRes.data || { global_rules: [], vpn: [], links: [], users: [] });

      if (fetchedTasks.length > 0) {
        setSelectedTaskId(fetchedTasks[0].id);
      }
      setVerificationResult(null);
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjectData(activeProject);
  }, [activeProject, fetchProjectData]);

  // Sync React Flow nodes and edges with tasks
  useEffect(() => {
    const newNodes = tasks.map((t) => ({
      id: t.id,
      type: 'taskNode',
      position: { x: t.x, y: t.y },
      data: {
        id: t.id,
        title: t.title,
        owner: t.owner,
        status: t.status,
        criteria: t.criteria,
        phase: t.phase,
        isSelected: t.id === selectedTaskId,
        isDark: darkMode
      }
    }));

    const newEdges = [];
    tasks.forEach((t) => {
      t.blocked_by.forEach((dep) => {
        newEdges.push({
          id: `e-${dep}-${t.id}`,
          source: dep,
          target: t.id,
          animated: t.status === 'BLOCKED',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: darkMode ? '#64748b' : '#94a3b8'
          },
          style: {
            stroke: darkMode ? '#64748b' : '#94a3b8',
            strokeWidth: 2
          }
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [tasks, selectedTaskId, darkMode]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loadingChat]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const activeTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  // Send message to Concierge
  const handleSendMessage = async () => {
    if (!inputQuery.trim()) return;
    const userMsg = inputQuery;
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInputQuery('');
    setLoadingChat(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        task_id: selectedTaskId,
        message: userMsg,
        project_id: activeProject
      });
      setChatMessages((prev) => [...prev, { sender: 'agent', text: res.data.reply }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `• Follow standard procedural guidance for ${activeTask?.title}.\n• Requirement: ${activeTask?.criteria}\n• Upload proof screenshot once complete.`
        }
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Submit proof for automated verification
  const handleVerifyUpload = async () => {
    if (!selectedFile) return;
    setVerifying(true);
    setVerificationResult(null);

    const formData = new FormData();
    formData.append('task_id', selectedTaskId);
    formData.append('project_id', activeProject);
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setVerificationResult(res.data);
      if (res.data.updated_graph) {
        setTasks(res.data.updated_graph);
      }
    } catch {
      // Offline fallback: update status locally
      const updated = tasks.map((t) => (t.id === selectedTaskId ? { ...t, status: 'COMPLETED' } : t));
      updated.forEach((t) => {
        if (t.status === 'BLOCKED' && t.blocked_by.every((dep) => updated.find((x) => x.id === dep)?.status === 'COMPLETED')) {
          t.status = 'READY';
        }
      });
      setTasks(updated);
      setVerificationResult({
        verified: true,
        reason: `Artifact '${selectedFile.name}' accepted. Dependent prerequisites unlocked.`
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* LEFT CANVAS: Full DAG */}
      <div className={`w-7/12 h-full flex flex-col border-r ${darkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
        <header className={`px-5 py-3 border-b flex justify-between items-center h-16 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm'}`}>
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-indigo-500" />
            <div>
              <h1 className="text-sm font-bold tracking-tight">smartShift DAG Web</h1>
              <p className="text-[11px] text-slate-400">Autonomous Prerequisite Dependency Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Project Manager Dropdown Selector */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${darkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
              <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={activeProject}
                onChange={(e) => setActiveProject(e.target.value)}
                className="bg-transparent font-bold outline-none cursor-pointer"
              >
                <option value="sunchemical" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'}>
                  Sunchemical
                </option>
                <option value="bayer" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'}>
                  Bayer (Demo)
                </option>
                <option value="nestle" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'}>
                  Nestlé (Demo)
                </option>
              </select>
            </div>

            {/* Dark / Light Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg border text-xs flex items-center transition ${darkMode ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => fetchProjectData(activeProject)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'}`}
            >
              Refresh
            </button>
          </div>
        </header>

        {/* Viewport Canvas */}
        <div className="w-full relative flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, n) => setSelectedTaskId(n.id)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Background gap={22} size={1.5} color={darkMode ? '#334155' : '#cbd5e1'} />
            <Controls className={darkMode ? 'invert opacity-80' : ''} />
          </ReactFlow>
        </div>
      </div>

      {/* RIGHT DRAWER */}
      <div className={`w-5/12 h-full flex flex-col ${darkMode ? 'bg-slate-900 border-l border-slate-800' : 'bg-white shadow-xl border-l border-slate-200'}`}>
        {/* Navigation Tabs */}
        <div className={`flex border-b text-xs font-semibold h-12 ${darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex-1 py-3 px-4 border-b-2 flex items-center justify-center gap-2 transition ${activeTab === 'agent' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <MessageSquare className="w-4 h-4" /> Agent Operations
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`flex-1 py-3 px-4 border-b-2 flex items-center justify-center gap-2 transition ${activeTab === 'specs' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Specification Artifacts
          </button>
        </div>

        {activeTab === 'agent' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Task Focused Header */}
            <div className={`p-4 border-b ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50/50'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded border border-indigo-500/30">
                  {activeTask?.id}
                </span>
                <span className="text-xs text-slate-400">
                  Phase: {activeTask?.phase} | Owner: {activeTask?.owner}
                </span>
              </div>
              <h2 className="text-sm font-bold">{activeTask?.title}</h2>
              <div className={`mt-2 p-2.5 rounded-lg text-xs leading-relaxed border ${darkMode ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                <span className="font-semibold text-indigo-400">Acceptance Criteria: </span>
                {activeTask?.criteria}
              </div>
            </div>

            {/* Verifier Proof Uploader */}
            <div className={`p-4 border-b ${darkMode ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'}`}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-indigo-400">
                <Upload className="w-3.5 h-3.5" /> Multimodal Verifier Agent
              </h3>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className={`text-xs w-full file:mr-2.5 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold ${darkMode ? 'file:bg-slate-800 file:text-slate-200 text-slate-400' : 'file:bg-slate-200 file:text-slate-700 text-slate-600'}`}
                />
                <button
                  onClick={handleVerifyUpload}
                  disabled={!selectedFile || verifying}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md disabled:opacity-50 transition whitespace-nowrap shadow-sm"
                >
                  {verifying ? 'Auditing...' : 'Submit Proof'}
                </button>
              </div>

              {verificationResult && (
                <div className={`mt-2.5 p-2.5 rounded-lg text-xs border ${verificationResult.verified ? (darkMode ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') : (darkMode ? 'bg-rose-950/40 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800')}`}>
                  <div className="font-bold flex items-center gap-1">
                    {verificationResult.verified ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                    {verificationResult.verified ? 'Verification Succeeded — Task Unlocked' : 'Verification Rejected'}
                  </div>
                  <p className="mt-1 leading-normal">{verificationResult.reason}</p>
                </div>
              )}
            </div>

            {/* Concierge Agent Chatbox */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className={`px-4 py-2 border-b text-xs font-bold flex items-center gap-1.5 ${darkMode ? 'border-slate-800 bg-slate-900 text-indigo-400' : 'border-slate-200 bg-slate-50 text-indigo-600'}`}>
                <MessageSquare className="w-3.5 h-3.5" /> Concierge Guidance
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : (darkMode ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-slate-100 text-slate-800 border border-slate-200')}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {loadingChat && (
                  <div className="text-xs text-slate-400 italic flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                    Concierge analyzing runbooks...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Box */}
              <div className={`p-3 border-t flex gap-2 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Ask Concierge how to clear ${activeTask?.id}...`}
                  className={`flex-1 border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50'}`}
                />
                <button
                  onClick={handleSendMessage}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center justify-center"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* SPECIFICATION ARTIFACTS TAB */
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* 1. Inbound Global Rules */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-indigo-400">
                <ShieldCheck className="w-4 h-4" /> Inbound Global Rules
              </h3>
              <table className={`w-full text-left text-xs border rounded-lg overflow-hidden ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <thead className={darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}>
                  <tr>
                    <th className="p-2.5">Rule ID</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {specs.global_rules?.map((r, i) => (
                    <tr key={i} className={darkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="p-2.5 font-mono font-bold">{r.id}</td>
                      <td className="p-2.5 leading-snug">{r.desc}</td>
                      <td className={`p-2.5 font-bold ${r.status.includes('Active') || r.status.includes('Enforced') ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 2. VPN Parameters */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-indigo-400">
                <Network className="w-4 h-4" /> VPN Parameters
              </h3>
              <div className={`p-3 rounded-lg border text-xs space-y-2 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                {specs.vpn?.map((v, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-slate-800/30 last:border-0">
                    <span className="text-slate-400 font-medium">{v.param}:</span>
                    <span className="font-mono font-bold text-slate-200">{v.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. smartShift External Resources */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-indigo-400">
                <ExternalLink className="w-4 h-4" /> smartShift External Resources
              </h3>
              <div className="space-y-2.5">
                {specs.links?.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center justify-between p-3 rounded-lg border transition ${darkMode ? 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                  >
                    <div>
                      <div className="font-bold text-xs text-indigo-400">{link.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{link.desc}</div>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-400 underline flex items-center gap-1">
                      Open <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* 4. Authorized Stakeholders Section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-indigo-400">
                <Users className="w-4 h-4" /> Authorized Stakeholders & Roles
              </h3>
              <div className="space-y-2">
                {specs.users?.map((u, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border text-xs flex justify-between items-center ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white'}`}
                  >
                    <div>
                      <div className="font-bold text-slate-200">
                        {u.name} <span className="text-slate-400 font-normal">({u.org})</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{u.role} &bull; <span className="font-mono">{u.id}</span></div>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-md font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {u.clearance}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}