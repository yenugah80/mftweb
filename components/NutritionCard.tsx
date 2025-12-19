import React, { useEffect, useRef, useState } from 'react';
import { NutritionData, UnitSystem } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { Activity, Leaf, Droplet, Share2, Copy, Check, X, Moon, Sun, Waves, ThumbsUp, ThumbsDown, Zap, Wheat, Candy, Milk, Info, Flame } from 'lucide-react';

interface Props {
  data: NutritionData;
  unitSystem: UnitSystem;
}

const COLORS = ['#38bdf8', '#fbbf24', '#f87171']; // Sky (Protein), Amber (Fat), Red (Carbs)

type Theme = 'light' | 'dark';
type FeedbackState = 'up' | 'down' | null;

export const NutritionCard: React.FC<Props> = ({ data, unitSystem }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Theme State
  const [theme, setTheme] = useState<Theme>('dark');
  // Selected Ingredient State
  const [selectedIngredientIndex, setSelectedIngredientIndex] = useState<number | null>(null);

  // Share Modal State
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Feedback State
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  // Load preferences from local storage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('nutriVoice_theme') as Theme;
    if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
    }
    const savedFeedback = localStorage.getItem(`nutriVoice_feedback_${data.foodName}`) as FeedbackState;
    if (savedFeedback) setFeedback(savedFeedback);
    else setFeedback(null);
  }, [data.foodName]);

  // Handle Feedback
  const handleFeedback = (type: 'up' | 'down') => {
      const newFeedback = feedback === type ? null : type;
      setFeedback(newFeedback);
      if (newFeedback) {
          localStorage.setItem(`nutriVoice_feedback_${data.foodName}`, newFeedback);
      } else {
          localStorage.removeItem(`nutriVoice_feedback_${data.foodName}`);
      }
  };

  // Toggle theme
  const toggleTheme = () => {
      const newTheme = theme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      localStorage.setItem('nutriVoice_theme', newTheme);
  };

  const isDark = theme === 'dark';

  // Helper conversion functions
  const displayMass = (grams: number) => {
    if (unitSystem === 'metric') return `${Math.round(grams)}g`;
    return `${(grams * 0.035274).toFixed(1)}oz`;
  };

  const displayEnergy = (calories: number) => {
      return `${calories} kcal`;
  };

  const displayVolume = (grams: number) => {
    if (unitSystem === 'metric') return `${Math.round(grams)}ml`;
    return `${(grams * 0.033814).toFixed(1)}fl oz`;
  }

  const healthScore = data.healthScore ?? 0;
  
  // Calculate Net Carbs
  const netCarbs = Math.max(0, data.carbs - (data.fiber || 0) - (data.sugarAlcohols || 0));

  const macroData = [
    { name: 'Protein', value: data.protein },
    { name: 'Fat', value: data.fat },
    { name: 'Carbs', value: data.carbs },
  ];

  // Sort micros by percentage of daily needs for better visualization
  const sortedMicros = data.micros ? [...data.micros].sort((a, b) => (b.percentageOfDailyNeeds || 0) - (a.percentageOfDailyNeeds || 0)) : [];

  const shareText = `🍽️ ${data.foodName}
🔥 ${displayEnergy(data.calories)}
💪 P: ${displayMass(data.protein)} | 🧀 F: ${displayMass(data.fat)} | 🍞 C: ${displayMass(data.carbs)}
✨ Health Score: ${healthScore}/100`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Nutri-Score Color Logic
  const getScoreColor = (score: number) => {
      if (score >= 80) return '#15803d'; // Dark Green (A)
      if (score >= 60) return '#84cc16'; // Light Green (B)
      if (score >= 40) return '#eab308'; // Yellow (C)
      if (score >= 20) return '#f97316'; // Orange (D)
      return '#ef4444'; // Red (E)
  };
  
  const scoreColor = getScoreColor(healthScore);
  const ringSize = 100; // px
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  // Theme Variables
  const bgClass = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  const NutrientMiniBar = ({ label, value, total, colorClass }: { label: string, value: number, total: number, colorClass: string }) => {
      const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
      const displayVal = unitSystem === 'metric' ? Math.round(value) : (value * 0.035274).toFixed(1);
      const unit = label === 'Cals' ? '' : (unitSystem === 'metric' ? 'g' : 'oz');
      
      return (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[60px]">
              <div className="flex justify-between items-end text-[10px] font-medium">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
                  <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{displayVal}{unit}</span>
              </div>
              <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-700/50' : 'bg-slate-200'}`}>
                  <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }}></div>
              </div>
              <div className="text-[9px] text-right opacity-60">{Math.round(pct)}% of total</div>
          </div>
      );
  };

  const CustomMicroTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-3 rounded-xl shadow-xl text-xs z-50`}>
          <p className={`font-bold mb-1.5 text-sm ${textPrimary}`}>{item.name}</p>
          <div className="space-y-1">
             <div className="flex justify-between gap-4">
                 <span className={textSecondary}>Amount:</span>
                 <span className={`font-mono ${textPrimary}`}>{item.amount}{item.unit}</span>
             </div>
             {item.percentageOfDailyNeeds !== undefined && (
                 <div className="flex justify-between gap-4">
                    <span className={textSecondary}>Daily Value:</span>
                    <span className="text-indigo-400 font-bold">{item.percentageOfDailyNeeds}%</span>
                 </div>
             )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div 
        className={`w-full max-w-3xl rounded-3xl shadow-2xl border overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500 relative transition-colors duration-300 ${bgClass}`}
        role="region"
        aria-label={`Nutrition Card for ${data.foodName}`}
    >
      
      {/* Share Modal */}
      {showShare && (
        <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200" role="dialog" aria-modal="true">
           <div ref={modalRef} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-6 w-full max-w-sm shadow-2xl relative`}>
              <button onClick={() => setShowShare(false)} className={`absolute top-4 right-4 ${textSecondary} hover:${textPrimary} rounded-full p-1`}><X size={20} /></button>
              <h3 className={`text-xl font-bold ${textPrimary} mb-2`}>Share Nutrition</h3>
              <div className={`${isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-700'} p-4 rounded-lg text-sm mb-5 font-mono whitespace-pre-wrap border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>{shareText}</div>
              <button onClick={handleCopy} className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${copied ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'}`}>{copied ? 'Copied!' : 'Copy to Clipboard'}</button>
           </div>
        </div>
      )}

      {/* Header Area */}
      <div className={`p-6 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} bg-gradient-to-r ${isDark ? 'from-slate-900 via-slate-800 to-slate-900' : 'from-slate-50 via-white to-slate-50'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 uppercase tracking-wider border border-indigo-500/20">Analysis Complete</span>
                    <span className="text-xs text-slate-500">{new Date(data.timestamp || Date.now()).toLocaleTimeString()}</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <h2 className={`text-3xl font-black ${textPrimary} capitalize tracking-tight leading-none`}>{data.foodName}</h2>
                  {/* Cooking Method Badge */}
                  {data.cookingMethod && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                      <Flame size={14} className="text-orange-500" />
                      <span className="text-xs font-semibold text-orange-400 uppercase tracking-wide">{data.cookingMethod}</span>
                    </div>
                  )}
                </div>
                
                <p className={`${textSecondary} text-sm max-w-md leading-relaxed mt-2`}>{data.summary}</p>
            </div>
            
            <div className="flex items-center gap-6 self-end md:self-auto">
                 {/* Large Health Score Ring */}
                 <div className="relative group">
                    <div 
                        className="relative flex items-center justify-center rounded-full bg-slate-800/50 shadow-inner"
                        style={{ width: ringSize, height: ringSize }}
                        role="meter" aria-valuenow={healthScore} aria-label="Health Score"
                    >
                        <svg className="w-full h-full transform -rotate-90 p-1" viewBox={`0 0 ${ringSize} ${ringSize}`} aria-hidden="true">
                            {/* Define Gradient */}
                            <defs>
                                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#ef4444" /> {/* Red */}
                                    <stop offset="50%" stopColor="#eab308" /> {/* Yellow */}
                                    <stop offset="100%" stopColor="#15803d" /> {/* Green */}
                                </linearGradient>
                            </defs>
                            <circle cx={ringSize/2} cy={ringSize/2} r={radius} fill="none" stroke={isDark ? "#334155" : "#e2e8f0"} strokeWidth={strokeWidth} opacity={0.3} />
                            <circle 
                                cx={ringSize/2} cy={ringSize/2} r={radius} fill="none" stroke="url(#scoreGradient)" strokeWidth={strokeWidth} strokeLinecap="round"
                                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} 
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center text-center">
                             <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Nutri</span>
                             <span className={`text-3xl font-black tracking-tighter`} style={{ color: scoreColor }}>{healthScore}</span>
                             <span className="text-[9px] text-slate-500 font-medium">Score</span>
                        </div>
                    </div>
                 </div>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex justify-end gap-2 mt-6">
            <button onClick={toggleTheme} className={`p-2 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-black'} transition-colors`} aria-label="Toggle Theme">{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button onClick={() => setShowShare(true)} className={`p-2 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-black'} transition-colors`} aria-label="Share"><Share2 size={16} /></button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Charts & Metrics */}
        <div className="space-y-6">
            
            {/* Macro Section */}
            <div className={`p-5 rounded-2xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-50 border border-slate-100'} relative overflow-hidden`}>
                 <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className={`font-bold ${textPrimary} flex items-center gap-2`}><Activity size={18} className="text-indigo-400" /> Macros</h3>
                    <div className="text-right">
                        <span className={`block text-2xl font-black ${textPrimary}`}>{displayEnergy(data.calories).split(' ')[0]}</span>
                        <span className={`text-xs font-bold uppercase ${textSecondary}`}>{displayEnergy(data.calories).split(' ')[1]}</span>
                    </div>
                 </div>

                 {/* Macro Visuals */}
                 <div className="flex items-center gap-6 relative z-10">
                    <div className="h-40 w-40 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={macroData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                            {macroData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', background: '#1e293b', color: '#f8fafc', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} formatter={(val: number) => displayMass(val)} />
                        </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-3 flex-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><div className="w-2 h-8 rounded-full bg-sky-400"></div><span className={`${textSecondary} text-sm font-medium`}>Protein</span></div>
                            <span className={`font-bold ${textPrimary}`}>{displayMass(data.protein)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><div className="w-2 h-8 rounded-full bg-amber-400"></div><span className={`${textSecondary} text-sm font-medium`}>Fat</span></div>
                            <span className={`font-bold ${textPrimary}`}>{displayMass(data.fat)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><div className="w-2 h-8 rounded-full bg-red-400"></div><span className={`${textSecondary} text-sm font-medium`}>Carbs</span></div>
                            <span className={`font-bold ${textPrimary}`}>{displayMass(data.carbs)}</span>
                        </div>
                    </div>
                 </div>
                 {/* Decorative background element */}
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none"></div>
            </div>

            {/* Detailed Metric Pills */}
            <div className="grid grid-cols-2 gap-3">
                {/* Fiber */}
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-emerald-50 border-emerald-100'} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-500"><Leaf size={16} /></div>
                        <span className={`text-xs font-bold uppercase ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Fiber</span>
                    </div>
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{displayMass(data.fiber || 0)}</span>
                </div>
                
                {/* Net Carbs - Enhanced Visuals */}
                <div className={`p-3 rounded-xl border relative overflow-hidden flex items-center justify-between group ${isDark ? 'bg-gradient-to-br from-orange-950/40 to-amber-950/20 border-orange-500/20' : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'}`}>
                    <div className="flex items-center gap-2 relative z-10">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 text-orange-500 shadow-sm"><Wheat size={16} /></div>
                        <div className="flex flex-col">
                            <span className={`text-xs font-bold uppercase ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>Net Carbs</span>
                            <span className="text-[9px] opacity-60 font-medium">Metabolic Impact</span>
                        </div>
                    </div>
                    <span className={`font-bold relative z-10 ${isDark ? 'text-white' : 'text-slate-900'}`}>{displayMass(netCarbs)}</span>
                    {/* Subtle Glow Effect */}
                    <div className={`absolute -right-4 -bottom-4 w-12 h-12 rounded-full blur-xl opacity-20 ${isDark ? 'bg-orange-500' : 'bg-orange-400'}`}></div>
                </div>

                {/* Sugar */}
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-pink-950/20 border-pink-900/30' : 'bg-pink-50 border-pink-100'} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-500"><Candy size={16} /></div>
                        <span className={`text-xs font-bold uppercase ${isDark ? 'text-pink-300' : 'text-pink-700'}`}>Sugar</span>
                    </div>
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{displayMass(data.sugar || 0)}</span>
                </div>
                 {/* Sugar Alcohol */}
                 <div className={`p-3 rounded-xl border ${isDark ? 'bg-indigo-950/20 border-indigo-900/30' : 'bg-indigo-50 border-indigo-100'} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-500"><Milk size={16} /></div>
                        <span className={`text-xs font-bold uppercase ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>S. Alcohol</span>
                    </div>
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{displayMass(data.sugarAlcohols || 0)}</span>
                </div>
            </div>

            {/* Hydration Card */}
            <div className={`relative overflow-hidden rounded-2xl p-5 border ${isDark ? 'border-cyan-900/30' : 'border-cyan-100'}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${isDark ? 'from-cyan-950/40 to-blue-900/40' : 'from-cyan-50 to-blue-50'} z-0`}></div>
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-cyan-500/10 to-transparent opacity-50 z-0"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className={`font-bold ${isDark ? 'text-cyan-200' : 'text-cyan-800'} flex items-center gap-2`}>
                            <Waves size={18} className="text-cyan-400" /> Hydration
                        </h3>
                        {data.waterContent && <span className={`text-2xl font-black ${isDark ? 'text-cyan-100' : 'text-cyan-700'}`}>{displayVolume(data.waterContent)}</span>}
                    </div>
                    {data.electrolytes && data.electrolytes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {data.electrolytes.map((elec, i) => (
                                <span key={i} className={`text-xs font-semibold px-2 py-1 rounded-md border ${isDark ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' : 'bg-white/50 border-cyan-200 text-cyan-700'} flex items-center gap-1`}>
                                    <Zap size={10} /> {elec}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>

        {/* Right Column: Ingredients & Micros */}
        <div className="space-y-6">
            
            {/* Ingredients */}
            <div className={`p-1 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                 <div className="p-4 pb-2 border-b border-slate-800/50 flex justify-between items-center">
                    <h3 className={`${textSecondary} font-bold text-sm uppercase tracking-wider flex items-center gap-2`}>
                        <Leaf size={16} className="text-green-500" /> Ingredients Breakdown
                    </h3>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Info size={12} /> Tap for details
                    </div>
                 </div>
                 <div className="h-96 overflow-y-auto p-2 scrollbar-hide">
                    <ul className="space-y-2">
                        {data.ingredients.map((ing, idx) => {
                            // Calculate shares if not expanded
                            const calShare = data.calories > 0 && ing.calories ? (ing.calories / data.calories) * 100 : 0;
                            const isSelected = selectedIngredientIndex === idx;

                            return (
                                <li 
                                    key={idx} 
                                    onClick={() => setSelectedIngredientIndex(isSelected ? null : idx)}
                                    className={`
                                        cursor-pointer transition-all duration-300 rounded-xl p-3 border overflow-hidden
                                        ${isSelected 
                                            ? (isDark ? 'bg-slate-800 border-indigo-500/50 ring-1 ring-indigo-500/20' : 'bg-white border-indigo-200 shadow-md') 
                                            : (isDark ? 'bg-transparent border-transparent hover:bg-slate-800/50' : 'bg-transparent border-transparent hover:bg-slate-100')}
                                    `}
                                    role="listitem"
                                    tabIndex={0}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl filter drop-shadow-lg">{ing.icon || '🔸'}</span> 
                                            <div>
                                                <span className={`${isDark ? 'text-slate-200' : 'text-slate-800'} font-medium`}>{ing.name}</span>
                                                {/* Mini Bar if not selected to show caloric density */}
                                                {!isSelected && ing.calories && data.calories > 0 && (
                                                    <div className="flex items-center gap-2 mt-1" title={`${Math.round(calShare)}% of total calories`}>
                                                        <div className="w-12 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 opacity-80" style={{ width: `${calShare}%` }}></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {!isSelected && ing.calories && <span className="text-xs font-mono text-slate-500">~{Math.round(ing.calories)}cal</span>}
                                    </div>
                                    
                                    {/* Detailed Tooltip/Card View */}
                                    {isSelected && (
                                        <div className={`mt-4 pt-3 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200'} animate-in slide-in-from-top-2 fade-in duration-300`}>
                                            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'} leading-relaxed mb-4 italic`}>
                                                "{ing.description}"
                                            </p>
                                            
                                            {/* Macro Breakdown Cards */}
                                            {(ing.calories || ing.protein || ing.fat || ing.carbs) && (
                                                <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-950/30' : 'bg-slate-100'} grid grid-cols-4 gap-3`}>
                                                    <NutrientMiniBar label="Cals" value={ing.calories || 0} total={data.calories} colorClass="bg-indigo-500" />
                                                    <NutrientMiniBar label="Prot" value={ing.protein || 0} total={data.protein} colorClass="bg-sky-500" />
                                                    <NutrientMiniBar label="Fat" value={ing.fat || 0} total={data.fat} colorClass="bg-amber-500" />
                                                    <NutrientMiniBar label="Carb" value={ing.carbs || 0} total={data.carbs} colorClass="bg-red-500" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                 </div>
            </div>

            {/* Micronutrients */}
            {sortedMicros.length > 0 && (
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                     <h3 className={`${textSecondary} font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2`}>
                        <Droplet size={16} className="text-indigo-400" /> Micronutrient Profile
                     </h3>
                     <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={sortedMicros} 
                                layout="vertical" 
                                margin={{ left: 10, right: 30, top: 0, bottom: 0 }}
                                barGap={4}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} opacity={0.1} />
                                <XAxis type="number" domain={[0, 'auto']} hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    width={100} 
                                    tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 500 }} 
                                    axisLine={false} 
                                    tickLine={false} 
                                />
                                <Tooltip content={<CustomMicroTooltip />} cursor={{ fill: isDark ? '#334155' : '#e2e8f0', opacity: 0.2 }} />
                                <Bar 
                                    dataKey="percentageOfDailyNeeds" 
                                    fill="#818cf8" 
                                    radius={[0, 4, 4, 0]} 
                                    barSize={12}
                                    name="% Daily Value"
                                >
                                    {sortedMicros.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.percentageOfDailyNeeds && entry.percentageOfDailyNeeds > 50 ? '#818cf8' : '#6366f1'} 
                                            fillOpacity={entry.percentageOfDailyNeeds ? Math.min(1, 0.4 + (entry.percentageOfDailyNeeds / 50)) : 0.4}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                     </div>
                     <p className="text-[10px] text-center mt-2 text-slate-500 opacity-70">
                        * Percentage of estimated Daily Value (DV). 
                     </p>
                </div>
            )}
        </div>

      </div>
      
      {/* Feedback Section */}
      <div className={`p-4 border-t flex justify-between items-center ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
         <span className={`text-xs font-medium ${textSecondary}`}>Is this analysis accurate?</span>
         <div className="flex gap-2">
            <button onClick={() => handleFeedback('up')} className={`p-2 rounded-lg transition-colors hover:bg-slate-800 ${feedback === 'up' ? 'text-green-500 bg-green-500/10' : 'text-slate-500'}`}><ThumbsUp size={16} /></button>
            <button onClick={() => handleFeedback('down')} className={`p-2 rounded-lg transition-colors hover:bg-slate-800 ${feedback === 'down' ? 'text-red-500 bg-red-500/10' : 'text-slate-500'}`}><ThumbsDown size={16} /></button>
         </div>
      </div>
    </div>
  );
};