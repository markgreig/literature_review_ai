import React, { useState, useCallback, useMemo } from 'react';

// --- UTILITY FUNCTIONS FOR NEW FEATURES ---

// 1. CITATION EXPORT LOGIC
const generateCitation = (paper, format) => {
  const authorStr = paper.authors.join(' and ');
  const firstAuthor = paper.authors[0] ? paper.authors[0].split(',')[0].toLowerCase() : 'unknown';
  const id = `${firstAuthor}${paper.year}${paper.title ? paper.title.split(' ')[0].toLowerCase() : 'paper'}`;

  if (format === 'bibtex') {
    return `@article{${id},
  title={${paper.title || 'N/A'}},
  author={${authorStr}},
  journal={${paper.journal || 'N/A'}},
  year={${paper.year || 'N/A'}},
  doi={${paper.doi || ''}},
  abstract={${paper.abstract}}
}`;
  }
  
  if (format === 'ris') {
    return `TY  - JOUR
TI  - ${paper.title || 'N/A'}
${paper.authors.map(a => `AU  - ${a}`).join('\n')}
JO  - ${paper.journal || 'N/A'}
PY  - ${paper.year || 'N/A'}
DO  - ${paper.doi || ''}
AB  - ${paper.abstract}
ER  -`;
  }
};

// 2. SEMANTIC SEARCH (Vector Similarity Simulation using Jaccard Index)
const calculateSimilarity = (paperA, paperB) => {
  const tokenize = (str) => str.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const wordsA = new Set([...tokenize(paperA.title || ''), ...tokenize(paperA.abstract || ''), ...(paperA.keywords || [])]);
  const wordsB = new Set([...tokenize(paperB.title || ''), ...tokenize(paperB.abstract || ''), ...(paperB.keywords || [])]);
  
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
};

// --- DATA & CONSTANTS ---

const SAMPLE_PAPERS = [
  {
    id: 1,
    title: "Deep Learning Approaches for Rheumatological Disease Classification",
    authors: ["Chen, L.", "Williams, R.", "Park, J."],
    year: 2024,
    journal: "Journal of Medical AI",
    doi: "10.1234/jmai.2024.001",
    abstract: "This study presents a novel deep learning framework for classifying rheumatological diseases from clinical imaging data. Using a modified ResNet architecture with attention mechanisms, we achieved 94.2% accuracy on a dataset of 12,000 patient scans.",
    methodology: ["Deep Learning", "ResNet", "Attention Mechanisms", "Image Classification"],
    keywords: ["rheumatology", "deep learning", "medical imaging", "classification"],
    citations: 45,
    notes: "",
    status: "read",
    aiSummary: null,
    gaps: []
  },
  {
    id: 2,
    title: "Biomarkers in Early Arthritis: A Systematic Review",
    authors: ["Martinez, S.", "Thompson, K."],
    year: 2023,
    journal: "Rheumatology Reviews",
    doi: "10.1234/rr.2023.042",
    abstract: "We conducted a systematic review of 156 studies examining biomarkers for early detection of inflammatory arthritis. Key findings indicate that combining CRP, ESR, and anti-CCP antibodies provides the highest predictive value.",
    methodology: ["Systematic Review", "Meta-Analysis", "Biomarker Analysis"],
    keywords: ["arthritis", "biomarkers", "early detection", "systematic review"],
    citations: 89,
    notes: "Important for literature review section",
    status: "read",
    aiSummary: null,
    gaps: []
  },
  {
    id: 3,
    title: "Machine Learning for Treatment Response Prediction in RA",
    authors: ["Johnson, M.", "Lee, H.", "Brown, A."],
    year: 2024,
    journal: "Computational Medicine",
    doi: "10.1234/cm.2024.015",
    abstract: "This paper introduces an ensemble machine learning approach to predict treatment response in rheumatoid arthritis patients. Our model integrates clinical, genetic, and imaging features to achieve AUC of 0.91.",
    methodology: ["Ensemble Learning", "Random Forest", "XGBoost", "Feature Engineering"],
    keywords: ["rheumatoid arthritis", "treatment prediction", "machine learning"],
    citations: 23,
    notes: "",
    status: "unread",
    aiSummary: null,
    gaps: []
  }
];

const METHODOLOGY_CATEGORIES = [
  "Deep Learning", "Machine Learning", "Statistical Analysis", "Systematic Review",
  "Meta-Analysis", "Clinical Trial", "Cohort Study", "Case-Control", "Qualitative", 
  "Mixed Methods", "Simulation", "Natural Language Processing"
];

// --- ICONS ---
const Icons = {
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  Book: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Sparkles: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>,
  FileText: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Lightbulb: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>,
  Link: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  X: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Filter: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  BarChart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Upload: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Download: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Graph: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Robot: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
};

// --- NEW COMPONENT: LITERATURE GRAPH ---
const LiteratureGraph = ({ papers, onSelect }) => {
  const nodes = useMemo(() => {
    const centerX = 400; 
    const centerY = 300;
    const radius = papers.length > 1 ? Math.min(200, papers.length * 30) : 0;
    
    return papers.map((paper, i) => {
      const angle = (i / Math.max(1, papers.length)) * 2 * Math.PI;
      return {
        ...paper,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });
  }, [papers]);

  const links = useMemo(() => {
    const lines = [];
    for (let i = 0; i < papers.length; i++) {
      for (let j = i + 1; j < papers.length; j++) {
        const sharedAuthors = papers[i].authors.some(a => papers[j].authors.includes(a));
        const sim = calculateSimilarity(papers[i], papers[j]);
        
        if (sharedAuthors || sim > 0.1) {
          lines.push({
            source: nodes[i],
            target: nodes[j],
            strength: sim
          });
        }
      }
    }
    return lines;
  }, [papers, nodes]);

  if (papers.length < 2) {
      return (
          <div style={{textAlign: 'center', padding: '50px', color: 'var(--ink-muted)'}}>
            Need at least two related papers to build a graph.
          </div>
      );
  }

  return (
    <div className="graph-container" style={{position: 'relative'}}>
      <svg className="graph-svg" viewBox="0 0 800 600">
        <g>
          {links.map((link, i) => (
            <line 
              key={i}
              x1={link.source.x} y1={link.source.y}
              x2={link.target.x} y2={link.target.y}
              className="link-line"
              style={{ strokeWidth: 1 + link.strength * 5, opacity: 0.3 + link.strength }}
            />
          ))}
          {nodes.map((node) => (
            <g key={node.id} onClick={() => onSelect(node)}>
              <circle cx={node.x} cy={node.y} r="20" className="node-circle" />
              <text x={node.x} y={node.y + 35} className="node-text" style={{fontSize: '10px'}}>
                {node.title ? node.title.substring(0, 15) + '...' : 'Untitled'}
              </text>
              <text x={node.x} y={node.y + 5} className="node-text" style={{fill: 'var(--accent)', fontWeight: 'bold', fontSize: '12px'}}>
                {node.year}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <div style={{position: 'absolute', bottom: 20, right: 20, background: 'rgba(255,255,255,0.9)', padding: '10px', borderRadius: '8px', fontSize: '12px', border: '1px solid #ddd'}}>
        Click nodes to view details
      </div>
    </div>
  );
};


// --- STYLES ---
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap');
  
  :root {
    --ink: #1a1a1a; --ink-light: #4a4a4a; --ink-muted: #7a7a7a;
    --parchment: #faf8f5; --parchment-dark: #f0ebe3;
    --accent: #8b4513; --accent-light: #a0522d; --accent-glow: rgba(139, 69, 19, 0.1);
    --success: #2e7d32; --border: rgba(26, 26, 26, 0.1);
    --shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  }
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Source Sans 3', sans-serif; background: var(--parchment); color: var(--ink); line-height: 1.6; }
  
  .app-container { min-height: 100vh; display: flex; flex-direction: column; }
  .header { background: linear-gradient(180deg, var(--parchment) 0%, var(--parchment-dark) 100%); border-bottom: 1px solid var(--border); padding: 2rem 3rem; position: sticky; top: 0; z-index: 100; }
  .header-content { max-width: 1400px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
  .logo { display: flex; align-items: center; gap: 1rem; }
  .logo-icon { width: 48px; height: 48px; background: var(--ink); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--parchment); }
  .logo h1 { font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 600; }
  .logo span { display: block; font-size: 0.75rem; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.1em; }
  .header-actions { display: flex; gap: 1rem; align-items: center; }
  
  .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s ease; }
  .btn-primary { background: var(--ink); color: var(--parchment); }
  .btn-primary:hover { background: var(--ink-light); transform: translateY(-1px); }
  .btn-secondary { background: transparent; color: var(--ink); border: 1px solid var(--border); }
  .btn-secondary:hover { background: var(--parchment-dark); }
  .btn-accent { background: var(--accent); color: white; }
  .btn-ghost { background: transparent; color: var(--ink-muted); padding: 0.5rem; }
  .btn-ghost:hover { color: var(--ink); background: var(--parchment-dark); }
  
  .main-content { flex: 1; display: flex; max-width: 1400px; margin: 0 auto; width: 100%; padding: 2rem 3rem; gap: 2rem; position: relative; }
  .sidebar { width: 280px; flex-shrink: 0; }
  .sidebar-section { background: white; border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--shadow); }
  .sidebar-title { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .stat-item { text-align: center; padding: 1rem; background: var(--parchment); border-radius: 12px; }
  .stat-value { font-family: 'Cormorant Garamond', serif; font-size: 2rem; color: var(--accent); font-weight: 700; }
  .stat-label { font-size: 0.75rem; text-transform: uppercase; color: var(--ink-muted); }
  
  .paper-list-container { flex: 1; min-width: 0; }
  .search-bar { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
  .search-input-wrapper { flex: 1; position: relative; }
  .search-input-wrapper svg { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--ink-muted); }
  .search-input { width: 100%; padding: 0.875rem 1rem 0.875rem 3rem; border: 1px solid var(--border); border-radius: 12px; font-size: 0.95rem; }
  .search-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
  
  .paper-card { background: white; border-radius: 16px; padding: 1.75rem; margin-bottom: 1rem; box-shadow: var(--shadow); cursor: pointer; transition: all 0.2s ease; border: 1px solid transparent; }
  .paper-card:hover { transform: translateY(-2px); border-color: var(--accent-glow); }
  .paper-title { font-family: 'Cormorant Garamond', serif; font-size: 1.25rem; font-weight: 600; color: var(--ink); margin-bottom: 0.5rem; }
  .paper-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; font-size: 0.9rem; color: var(--ink-light); margin-bottom: 1rem; }
  .paper-meta-divider { width: 4px; height: 4px; background: var(--ink-muted); border-radius: 50%; opacity: 0.5; }
  .paper-abstract { font-size: 0.9rem; color: var(--ink-light); line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 1rem; }
  .paper-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .paper-tag { padding: 0.3rem 0.7rem; background: var(--parchment); border-radius: 6px; font-size: 0.75rem; color: var(--ink-muted); }
  .paper-tag.methodology { background: var(--accent-glow); color: var(--accent); font-weight: 500; }
  
  /* Detail Panel */
  .detail-panel { position: fixed; top: 0; right: 0; width: 600px; height: 100vh; background: white; box-shadow: -8px 0 32px rgba(0,0,0,0.1); z-index: 200; overflow-y: auto; transform: translateX(100%); transition: transform 0.3s ease; }
  .detail-panel.open { transform: translateX(0); }
  .detail-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 10; }
  .detail-content { padding: 2rem; }
  .detail-section { margin-bottom: 2rem; }
  .detail-section-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-muted); margin-bottom: 0.75rem; display: flex; alignItems: center; gap: 0.5rem; }
  .ai-card { background: linear-gradient(135deg, var(--parchment) 0%, var(--parchment-dark) 100%); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
  
  /* Graph View */
  .graph-container { background: white; border-radius: 16px; box-shadow: var(--shadow); height: 600px; position: relative; overflow: hidden; }
  .graph-svg { width: 100%; height: 100%; }
  .node-circle { fill: var(--parchment); stroke: var(--ink); stroke-width: 2px; cursor: pointer; transition: all 0.3s ease; }
  .node-circle:hover { fill: var(--accent-glow); stroke: var(--accent); r: 25; }
  .node-text { font-size: 10px; text-anchor: middle; pointer-events: none; fill: var(--ink); font-family: 'Source Sans 3', sans-serif; }
  .link-line { stroke: var(--border); stroke-width: 1px; }

  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 150; opacity: 0; visibility: hidden; transition: all 0.3s ease; }
  .backdrop.open { opacity: 1; visibility: visible; }
  
  .loading-dots span { width: 6px; height: 6px; background: white; border-radius: 50%; display: inline-block; animation: bounce 1.4s infinite ease-in-out both; margin: 0 2px; }
  .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
  .loading-dots span:nth-child(2) { animation-delay: -0.16s; }
  @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

  /* Modal Styles */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 300; opacity: 0; visibility: hidden; transition: all 0.2s ease; }
  .modal-overlay.open { opacity: 1; visibility: visible; }
  .modal { background: white; border-radius: 20px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
  .modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .modal-content { padding: 2rem; }
  .modal-footer { padding: 1.5rem 2rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 1rem; }
  .form-group { margin-bottom: 1.5rem; }
  .form-label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.5rem; }
  .form-input { width: 100%; padding: 0.875rem 1rem; border: 1px solid var(--border); border-radius: 10px; font-family: inherit; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .checkbox-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .checkbox-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--parchment); border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
  .checkbox-item input { display: none; }
  .checkbox-item.selected { background: var(--ink); color: var(--parchment); }
`;


// --- MAIN APP COMPONENT ---
function ResearchLiteratureAssistant() {
  const [papers, setPapers] = useState(SAMPLE_PAPERS);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'graph'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiKey, setApiKey] = useState(''); 
  
  // --- FEATURE HANDLERS ---

  // 1. REAL AI ANALYSIS (Calls Backend)
  const analyzeWithClaude = async (paper) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('https://literature-review-ai-2.onrender.com/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: paper.title, 
          abstract: paper.abstract 
        })
      });

      if (!response.ok) throw new Error('Server responded with error.');
      
      const data = await response.json();
      
      const summary = {
        keyFindings: data.keyFindings,
        relevanceScore: data.relevanceScore,
        // For connections, we'll temporarily use local similarity based on new AI keywords
        suggestedConnections: papers
          .filter(p => p.id !== paper.id)
          .map(p => ({ ...p, score: calculateSimilarity(paper, p) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map(p => p.title) 
      };

      setPapers(prev => prev.map(p => 
        p.id === paper.id 
          ? { ...p, aiSummary: summary, gaps: data.gaps, keywords: [...p.keywords, ...(data.keywords || [])] } 
          : p
      ));
      
      setSelectedPaper(prev => ({ ...prev, aiSummary: summary, gaps: data.gaps }));

    } catch (e) {
      console.error("AI/Server Error:", e);
      alert(`AI Analysis failed or server is down. Check console. (Requires server on port 3001 and ANTHROPIC_API_KEY set).`);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // 2. PDF IMPORT (Calls Backend)
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      alert("Parsing PDF with AI... (This uses the backend).");
      
      const response = await fetch('https://literature-review-ai-2.onrender.com/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Server failed to process file.');

      const data = await response.json();
      
      const newPaper = {
        id: Date.now(),
        title: data.title || file.name.replace('.pdf', ''),
        authors: data.authors || ["Unknown"], 
        year: data.year || new Date().getFullYear(),
        journal: data.journal || "Imported PDF",
        doi: "",
        abstract: data.abstract || "Content extracted from uploaded PDF.",
        methodology: data.methodology || ["PDF Analysis"],
        keywords: data.keywords || ["imported"],
        citations: 0,
        notes: "Imported via PDF parser.",
        status: 'unread',
        aiSummary: null,
        gaps: []
      };
      
      setPapers([newPaper, ...papers]);
      event.target.value = null; // Reset input
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to parse PDF. Is the backend running on port 3001?");
    }
  };

  // 3. CITATION EXPORT
  const exportCitation = (paper, format) => {
    let content = "";
    const titlePart = paper.title ? paper.title.split(' ')[0] : 'Paper';
    const filename = `${paper.authors[0]?.split(',')[0] || 'Author'}_${paper.year}_${titlePart}`;

    if (format === 'bibtex') {
      const key = `${paper.authors[0]?.split(',')[0].toLowerCase()}${paper.year}${titlePart.toLowerCase()}`;
      content = `@article{${key},\n  title = {${paper.title || 'N/A'}},\n  author = {${paper.authors.join(' and ')}},\n  journal = {${paper.journal || 'N/A'}},\n  year = {${paper.year || 'N/A'}},\n  doi = {${paper.doi || ''}},\n  abstract = {${paper.abstract}}\n}`;
    } else if (format === 'ris') {
      content = `TY  - JOUR
TI  - ${paper.title || 'N/A'}
${paper.authors.map(a => `AU  - ${a}`).join('\n')}
JO  - ${paper.journal || 'N/A'}
PY  - ${paper.year || 'N/A'}
DO  - ${paper.doi || ''}
AB  - ${paper.abstract}
ER  -`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${format === 'bibtex' ? 'bib' : 'ris'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  // Filtering and Stats
  const filteredPapers = useMemo(() => papers.filter(paper => 
    paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.abstract.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.keywords?.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
  ), [papers, searchQuery]);

  const stats = {
    total: papers.length,
    read: papers.filter(p => p.status === 'read').length,
    unread: papers.filter(p => p.status === 'unread').length,
    analyzed: papers.filter(p => p.aiSummary).length
  };
  
  // State Toggles (kept for completeness)
  const toggleReadStatus = (paper) => {
    const newStatus = paper.status === 'read' ? 'unread' : 'read';
    setPapers(prev => prev.map(p => (p.id === paper.id ? { ...p, status: newStatus } : p)));
    if (selectedPaper?.id === paper.id) {
      setSelectedPaper(prev => ({ ...prev, status: newStatus }));
    }
  };


  // --- RENDER ---
  return (
    <>
      <style>{styles}</style>
      <div className="app-container">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <div className="logo">
              <div className="logo-icon"><Icons.Book /></div>
              <div>
                <h1>Literatus</h1>
                <span>Research Literature Assistant</span>
              </div>
            </div>
            <div className="header-actions">
              {/* PDF Import Button */}
              <label className="btn btn-secondary" style={{cursor: 'pointer'}}>
                <input type="file" className="file-input" accept=".pdf" onChange={handleFileUpload} />
                <Icons.Upload /> Import PDF
              </label>
              
              {/* View Toggle */}
              <button className="btn btn-secondary" onClick={() => setViewMode(viewMode === 'list' ? 'graph' : 'list')}>
                {viewMode === 'list' ? <><Icons.Graph /> Graph View</> : <><Icons.BarChart /> List View</>}
              </button>
              
              {/* Add Manual Paper Button */}
              <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                <Icons.Plus /> Add Paper
              </button>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="main-content">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-section">
              <h3 className="sidebar-title"><Icons.Robot /> AI Integration</h3>
              <div style={{fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '1rem'}}>
                API Key for Claude (Optional):
              </div>
              <input 
                type="password" 
                placeholder="sk-ant-..." 
                className="search-input" 
                style={{marginBottom: '1rem', padding: '0.5rem'}}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <div className="stat-grid">
                <div className="stat-item">
                  <div className="stat-value">{stats.total}</div>
                  <div className="stat-label">Total</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{stats.analyzed}</div>
                  <div className="stat-label">AI Analyzed</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{stats.unread}</div>
                  <div className="stat-label">Unread</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{stats.read}</div>
                  <div className="stat-label">Read</div>
                </div>
              </div>
            </div>
          </aside>
          
          {/* Paper List / Graph View */}
          <div className="paper-list-container">
            
            {viewMode === 'list' && (
              <div className="search-bar">
                <div className="search-input-wrapper">
                  <Icons.Search />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Semantic search by title, abstract, or keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            )}

            {viewMode === 'graph' ? (
              <div className="graph-container">
                  {filteredPapers.length > 1 ? (
                    <LiteratureGraph papers={filteredPapers} onSelect={setSelectedPaper} />
                  ) : (
                    <div className="empty-state">
                       <div className="empty-state-icon"><Icons.Graph /></div>
                       <h3>Graph View requires at least two papers to show connections.</h3>
                    </div>
                  )}
              </div>
            ) : (
              // LIST VIEW RENDER
              filteredPapers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Icons.Book /></div>
                  <h3>No papers match your criteria</h3>
                  <p>Try clearing your search query.</p>
                </div>
              ) : (
                filteredPapers.map(paper => (
                  <article key={paper.id} className="paper-card" onClick={() => setSelectedPaper(paper)}>
                    <div className="paper-header">
                      <h2 className="paper-title">{paper.title}</h2>
                      <span className={`paper-status ${paper.status}`}>
                        {paper.status === 'read' ? <Icons.Check /> : <Icons.Clock />} {paper.status}
                      </span>
                    </div>
                    <div className="paper-meta">
                      <span>{paper.authors[0]} et al.</span>
                      <span className="paper-meta-divider" />
                      <span>{paper.year}</span>
                      <span className="paper-meta-divider" />
                      <span>{paper.journal}</span>
                    </div>
                    <p className="paper-abstract">{paper.abstract}</p>
                    <div className="paper-tags">
                      {paper.methodology.slice(0, 2).map(m => (
                        <span key={m} className="paper-tag methodology">{m}</span>
                      ))}
                    </div>
                  </article>
                ))
              )
            )}
          </div>
        </main>
        
        {/* Detail Panel Backdrop */}
        <div 
          className={`backdrop ${selectedPaper ? 'open' : ''}`}
          onClick={() => setSelectedPaper(null)}
        />
        
        {/* Detail Panel */}
        <aside className={`detail-panel ${selectedPaper ? 'open' : ''}`}>
          {selectedPaper && (
            <>
              <div className="detail-header">
                <h2>Paper Details</h2>
                <button className="btn btn-ghost" onClick={() => setSelectedPaper(null)}><Icons.X /></button>
              </div>
              <div className="detail-content">
                <h1 className="detail-title">{selectedPaper.title}</h1>
                
                <div className="detail-section">
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-accent"
                      onClick={() => analyzeWithClaude(selectedPaper)}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <div className="loading-dots"><span></span><span></span><span></span></div>
                      ) : (
                        <><Icons.Sparkles /> Analyze with AI</>
                      )}
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => toggleReadStatus(selectedPaper)}
                    >
                      {selectedPaper.status === 'read' ? 'Mark Unread' : 'Mark as Read'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => exportCitation(selectedPaper, 'bibtex')}>
                        <Icons.Download /> BibTeX
                    </button>
                    <button className="btn btn-secondary" onClick={() => exportCitation(selectedPaper, 'ris')}>
                        <Icons.Download /> RIS Export
                    </button>
                  </div>
                </div>

                <div className="detail-section">
                  <div className="paper-meta" style={{marginBottom: '0.5rem'}}>
                    <span>{selectedPaper.authors.join(', ')}</span>
                    <span className="paper-meta-divider" />
                    <span>{selectedPaper.year}</span>
                  </div>
                  <div className="paper-meta">
                    <span>{selectedPaper.journal}</span>
                    {selectedPaper.doi && (
                      <>
                        <span className="paper-meta-divider" />
                        <a 
                          href={`https://doi.org/${selectedPaper.doi}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icons.Link /> DOI
                        </a>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="detail-section">
                  <h3 className="detail-section-title"><Icons.FileText /> Abstract</h3>
                  <p style={{fontSize: '0.95rem', lineHeight: '1.8', color: 'var(--ink-light)'}}>{selectedPaper.abstract}</p>
                </div>

                {selectedPaper.aiSummary && (
                  <>
                    <div className="detail-section">
                      <h3 className="detail-section-title"><Icons.Robot /> AI Analysis (Claude)</h3>
                      <div className="ai-card">
                        <div style={{color: 'var(--accent)', fontWeight: 600, marginBottom: '0.5rem', display:'flex', alignItems:'center', gap:'0.5rem'}}>
                            <Icons.Sparkles /> Key Insights
                        </div>
                        <ul style={{listStyle: 'none', padding: 0}}>
                          {selectedPaper.aiSummary.keyFindings.map((f, i) => (
                            <li key={i} style={{padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem'}}>{f}</li>
                          ))}
                        </ul>
                      </div>
                      <div style={{marginBottom: '1rem'}}>
                        <span style={{display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--accent)', color: 'white', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem'}}>
                          Relevance: {selectedPaper.aiSummary.relevanceScore}%
                        </span>
                      </div>
                      <div className="ai-card">
                        <div style={{color: 'var(--accent)', fontWeight: 600, marginBottom: '0.5rem', display:'flex', alignItems:'center', gap:'0.5rem'}}>
                            <Icons.Link /> Semantic Connections
                        </div>
                        <ul style={{listStyle: 'none', padding: 0}}>
                          {selectedPaper.aiSummary.suggestedConnections.map((c, i) => (
                            <li key={i} style={{padding: '0.5rem 0', fontSize: '0.9rem', display: 'flex', gap: '0.5rem'}}>
                              <Icons.ChevronRight /> {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <div className="detail-section">
                      <h3 className="detail-section-title"><Icons.Lightbulb /> Identified Gaps</h3>
                      {(selectedPaper.gaps || []).map((gap, i) => (
                        <div key={i} style={{padding: '0.75rem', background: 'rgba(139, 69, 19, 0.05)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--ink-light)'}}>{gap}</div>
                      ))}
                    </div>
                  </>
                )}
                
                <div className="detail-section">
                  <h3 className="detail-section-title">Your Notes</h3>
                  <textarea
                    style={{width: '100%', minHeight: '120px', padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '0.9rem', resize: 'vertical'}}
                    value={selectedPaper.notes}
                    onChange={(e) => {
                      const notes = e.target.value;
                      setPapers(prev => prev.map(p => p.id === selectedPaper.id ? { ...p, notes } : p));
                      setSelectedPaper(prev => ({ ...prev, notes }));
                    }}
                    placeholder="Add your notes..."
                  />
                </div>
              </div>
            </>
          )}
        </aside>
        
        {/* Add Paper Modal */}
        <div className={`modal-overlay ${isAddModalOpen ? 'open' : ''}`}>
          <div className="modal">
            <div className="modal-header">
              <h2>Add New Paper</h2>
              <button className="btn btn-ghost" onClick={() => setIsAddModalOpen(false)}><Icons.X /></button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input type="text" className="form-input" id="new-title" placeholder="Enter paper title" />
              </div>
              
              <div className="form-group">
                <label className="form-label">Authors (comma-separated)</label>
                <input type="text" className="form-input" id="new-authors" placeholder="e.g., Smith, J., Johnson, M." />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input type="number" className="form-input" defaultValue={2024} id="new-year" />
                </div>
                <div className="form-group">
                  <label className="form-label">Journal</label>
                  <input type="text" className="form-input" id="new-journal" placeholder="Journal name" />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Abstract</label>
                <textarea className="form-input" style={{ minHeight: '100px', resize: 'vertical' }} id="new-abstract" placeholder="Paste the paper abstract..." />
              </div>
              
              <div className="form-group">
                <label className="form-label">Methodology</label>
                <div className="checkbox-group">
                  {METHODOLOGY_CATEGORIES.map(method => (
                    <label key={method} className="checkbox-item">
                      <input type="checkbox" name="methodology" value={method} />
                      {method}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  const title = document.getElementById('new-title').value;
                  const authorsStr = document.getElementById('new-authors').value;
                  const abstract = document.getElementById('new-abstract').value;
                  const year = document.getElementById('new-year').value;
                  
                  const checkboxes = document.querySelectorAll('input[name="methodology"]:checked');
                  const methods = Array.from(checkboxes).map(cb => cb.value);

                  if(title) {
                    const newP = {
                      id: Date.now(),
                      title, 
                      authors: authorsStr ? authorsStr.split(',').map(a => a.trim()) : [title.split(' ')[0]], 
                      year: parseInt(year), 
                      abstract,
                      methodology: methods,
                      journal: document.getElementById('new-journal').value,
                      citations: 0, status: 'unread', keywords: [], aiSummary: null
                    };
                    setPapers([newP, ...papers]);
                    setIsAddModalOpen(false);
                  } else {
                    alert("Title is required.");
                  }
                }}
              >
                Add Paper
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ResearchLiteratureAssistant;
