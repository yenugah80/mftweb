import React, { useState, useRef, useEffect } from 'react';
import { useLiveApi, showNutritionInfoDeclaration } from './hooks/useLiveApi';
import { Visualizer } from './components/Visualizer';
import { NutritionCard } from './components/NutritionCard';
import { ComparisonView } from './components/ComparisonView';
import { Mic, MicOff, Loader2, Sparkles, AlertCircle, RefreshCw, Send, Image as ImageIcon, X, History, Scale, Menu, ChevronLeft, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import { NutritionData, UnitSystem } from './types';

const App: React.FC = () => {
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  
  // History State
  const [history, setHistory] = useState<NutritionData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Settings State
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');

  // Load settings
  useEffect(() => {
    const savedUnits = localStorage.getItem('nutriVoice_units') as UnitSystem;
    if (savedUnits === 'metric' || savedUnits === 'imperial') {
        setUnitSystem(savedUnits);
    }
  }, []);

  const toggleUnitSystem = () => {
    const next = unitSystem === 'metric' ? 'imperial' : 'metric';
    setUnitSystem(next);
    localStorage.setItem('nutriVoice_units', next);
  };

  // Update history when new data arrives
  const handleDataReceived = (data: NutritionData) => {
    setNutritionData(data);
    setHistory(prev => {
        // Prevent duplicate entries if ID exists
        if (data.id && prev.some(item => item.id === data.id)) return prev;
        return [data, ...prev];
    });
  };

  // Pass state setter to hook so Live API can update it
  const { isConnected, isConnecting, connect, disconnect, volume, error: liveError } = useLiveApi({
      onDataReceived: handleDataReceived
  });

  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on load
  useEffect(() => {
    if (!isConnected) {
        inputRef.current?.focus();
    }
  }, [isConnected]);

  // Comparison Logic
  const toggleCompareSelection = (id: string) => {
      setSelectedForCompare(prev => {
          if (prev.includes(id)) return prev.filter(i => i !== id);
          if (prev.length >= 2) return [prev[1], id]; // Keep max 2, rotate
          return [...prev, id];
      });
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() && !selectedImage) return;
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    setNutritionData(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const parts: any[] = [];
        if (selectedImage) {
            const base64Data = selectedImage.split(',')[1];
            const mimeType = selectedImage.split(';')[0].split(':')[1];
            parts.push({ inlineData: { data: base64Data, mimeType } });
        }
        
        let promptText = "";
        if (inputText && selectedImage) {
             promptText = `Analyze image. Context: "${inputText}". Identify food and cooking method (fried, boiled, etc.). Estimate nutrients considering cooking loss (e.g. vitamins). Break down ingredients with individual macros (P/F/C) and calories. Identify micros, hydration, health score (0-100). Call showNutritionInfo.`;
        } else if (inputText) {
            promptText = `Analyze food: "${inputText}". Identify cooking method and adjust micronutrients for cooking losses. Return nutrition data using showNutritionInfo. Breakdown ingredients with macros.`;
        } else if (selectedImage) {
            promptText = `Scan food image. Identify food and cooking method. Adjust micronutrients based on cooking process. Identify ingredients with macros/calories, total macros, micros, hydration. Call showNutritionInfo.`;
        }
        parts.push({ text: promptText });

        const result = await ai.models.generateContent({
             model: "gemini-2.5-flash",
             contents: [{ role: 'user', parts }],
             config: {
                tools: [{ functionDeclarations: [showNutritionInfoDeclaration] }],
                toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } } 
             }
        });
        
        const call = result.functionCalls?.[0];
        if (call && call.name === 'showNutritionInfo') {
            const data = call.args as unknown as NutritionData;
            data.id = crypto.randomUUID();
            data.timestamp = Date.now();
            
            handleDataReceived(data);
            setInputText('');
            setSelectedImage(null);
        } else {
             setAnalysisError("Could not identify food data. Please try again.");
        }

    } catch (err: any) {
        console.error("Analysis Error", err);
        setAnalysisError("Failed to analyze. Please check your connection.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) setSelectedImage(ev.target.result as string);
          };
          reader.readAsDataURL(file);
      }
      if (e.target) e.target.value = '';
  };

  const error = liveError || analysisError;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
         <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl opacity-50"></div>
         <div className="absolute top-1/2 -left-1/4 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl opacity-50"></div>
      </div>

      {/* Comparison View Modal */}
      {showComparison && selectedForCompare.length === 2 && (
          <ComparisonView 
            item1={history.find(h => h.id === selectedForCompare[0])!} 
            item2={history.find(h => h.id === selectedForCompare[1])!} 
            onClose={() => setShowComparison(false)}
            unitSystem={unitSystem}
          />
      )}

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between border-b border-slate-800/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setShowHistory(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Open History Menu"
            >
                <Menu size={24} />
            </button>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Sparkles className="text-white w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        NutriVoice AI
                    </h1>
                    <p className="text-xs text-slate-500">Multimodal Food Analysis</p>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${isConnected ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {isConnected ? 'Live Connected' : 'Ready'}
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center p-4 md:p-8 overflow-y-auto pb-32 w-full scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {/* Error Banner */}
            {error && (
                <div className="w-full max-w-lg mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 shadow-lg shadow-red-900/20">
                    <div className="flex items-center gap-3">
                        <AlertCircle size={20} className="shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                    <button 
                        onClick={() => { setAnalysisError(null); if (liveError) connect(); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs rounded-lg transition-colors border border-red-500/20"
                    >
                        <RefreshCw size={12} />
                        Retry
                    </button>
                </div>
            )}
            
            {/* Loading State */}
            {isAnalyzing && (
                <div className="w-full max-w-2xl flex flex-col items-center justify-center py-20 animate-in fade-in">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                        <Loader2 className="w-16 h-16 text-indigo-400 animate-spin relative z-10" />
                    </div>
                    <p className="mt-6 text-slate-300 font-medium text-lg">Analyzing food...</p>
                    <p className="text-slate-500 text-sm">Identifying ingredients & nutrients</p>
                </div>
            )}

            {/* Content Card */}
            {!isAnalyzing && nutritionData && (
                <NutritionCard data={nutritionData} unitSystem={unitSystem} />
            )}
            
            {/* Empty State */}
            {!isAnalyzing && !nutritionData && !isConnected && (
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-80 mt-10 md:mt-0">
                    <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800 shadow-xl group">
                        <Sparkles className="text-slate-600 w-8 h-8 group-hover:text-indigo-400 transition-colors duration-500" />
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-200 mb-2">
                        What are you eating?
                    </h2>
                    <p className="text-slate-400 leading-relaxed mb-6">
                        Type, speak, or snap a photo. NutriVoice analyzes your meal instantly.
                    </p>
                    <div className="flex gap-2 text-xs text-slate-500">
                        <span className="bg-slate-800 px-2 py-1 rounded-md">Try: "Avocado Toast"</span>
                        <span className="bg-slate-800 px-2 py-1 rounded-md">Try: Upload Photo</span>
                    </div>
                </div>
            )}

            {/* Visualizer for Live Mode */}
            {isConnected && (
                <div className="w-full max-w-md mt-auto mb-4">
                    <Visualizer isActive={isConnected} volume={volume} />
                </div>
            )}
      </main>

      {/* History Drawer (Hamburger Menu) */}
      <>
        {/* Backdrop */}
        {showHistory && (
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={() => setShowHistory(false)}
            />
        )}
        
        {/* Drawer */}
        <div className={`
            fixed inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-800 shadow-2xl transform transition-transform duration-300 z-50 flex flex-col
            ${showHistory ? 'translate-x-0' : '-translate-x-full'}
        `}>
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                    <History size={18} /> History
                </div>
                <button 
                    onClick={() => setShowHistory(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                    <ChevronLeft size={20} />
                </button>
            </div>

            {/* Compare Action Bar inside Drawer */}
            {selectedForCompare.length > 0 && (
                <div className="p-3 bg-indigo-900/20 border-b border-indigo-500/20">
                    <div className="flex items-center justify-between text-xs mb-2 text-indigo-200">
                        <span>{selectedForCompare.length}/2 Selected</span>
                        {selectedForCompare.length === 2 && (
                            <button 
                                onClick={() => setShowComparison(true)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md font-medium flex items-center gap-1 transition-colors"
                            >
                                <Scale size={12} /> Compare Now
                            </button>
                        )}
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-indigo-500 transition-all duration-300" 
                            style={{ width: `${(selectedForCompare.length / 2) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {history.length === 0 ? (
                    <div className="text-center text-slate-500 mt-10 text-sm p-4">
                        <p>No history yet.</p>
                        <p className="text-xs mt-1">Analyze some food to see it here.</p>
                    </div>
                ) : (
                    history.map(item => (
                        <div 
                            key={item.id} 
                            onClick={() => { setNutritionData(item); setShowHistory(false); }}
                            className={`
                                group relative p-3 rounded-xl border cursor-pointer transition-all duration-200
                                ${nutritionData?.id === item.id 
                                    ? 'bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-900/10' 
                                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800'}
                            `}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-slate-200 truncate pr-2">{item.foodName}</span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.healthScore > 70 ? 'bg-green-500/10 text-green-400' : item.healthScore > 40 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {item.healthScore}
                                </span>
                            </div>
                            <div className="flex justify-between items-end mt-2">
                                 <div className="text-xs text-slate-500 flex flex-col">
                                    <span>{item.calories} kcal</span>
                                    <span className="text-[10px] opacity-70">{new Date(item.timestamp || 0).toLocaleDateString()}</span>
                                 </div>
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); if(item.id) toggleCompareSelection(item.id); }}
                                    className={`
                                        p-1.5 rounded-lg border transition-all
                                        ${selectedForCompare.includes(item.id!) 
                                            ? 'bg-indigo-600 text-white border-indigo-500 opacity-100' 
                                            : 'bg-slate-800 text-slate-500 border-slate-700 opacity-0 group-hover:opacity-100 hover:bg-slate-700 hover:text-indigo-400'}
                                    `}
                                    title="Compare"
                                 >
                                    <Scale size={14} />
                                 </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            {/* Settings Section */}
            <div className="p-4 border-t border-slate-800 bg-slate-900">
                <div className="flex items-center gap-2 text-slate-500 font-semibold mb-3 text-xs uppercase tracking-wider">
                    <Settings size={14} /> Preferences
                </div>
                <button
                    onClick={toggleUnitSystem}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all text-slate-300"
                >
                    <span className="text-sm font-medium">Unit System</span>
                    <div className="flex items-center gap-2 text-xs">
                        <span className={`transition-colors ${unitSystem === 'metric' ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}>Metric</span>
                        {unitSystem === 'metric' ? (
                            <ToggleLeft size={24} className="text-indigo-500" />
                        ) : (
                            <ToggleRight size={24} className="text-indigo-500" />
                        )}
                        <span className={`transition-colors ${unitSystem === 'imperial' ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}>Imperial</span>
                    </div>
                </button>
            </div>

            <div className="p-4 border-t border-slate-800 text-[10px] text-center text-slate-600">
                NutriVoice AI v1.0
            </div>
        </div>
      </>

      {/* Bottom Control Bar */}
      <div className="relative z-20 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 p-4 md:p-6 pb-6 md:pb-8">
        <div className="max-w-3xl mx-auto">
            
            <div className="flex items-end gap-3 bg-slate-800/50 p-2 rounded-3xl border border-slate-700/50 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all shadow-lg">
                
                {/* File Input (Hidden) */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handleFileSelect}
                />

                {/* Left Action Button (Camera/Image) */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isConnected || isAnalyzing}
                    className={`p-3 rounded-full transition-all duration-200 shrink-0 ${isConnected ? 'opacity-30 cursor-not-allowed text-slate-600' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50'}`}
                    title="Upload Photo or Take Picture"
                >
                    <ImageIcon size={22} />
                </button>

                {/* Unified Input Area */}
                <div className="flex-1 flex flex-col gap-2 min-h-[44px] justify-center">
                    
                    {/* Inline Image Preview */}
                    {selectedImage && (
                        <div className="relative inline-block w-fit group">
                            <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-slate-600 shadow-sm" />
                            <button 
                                onClick={() => setSelectedImage(null)}
                                className="absolute -top-1.5 -right-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-full p-0.5 border border-slate-600 shadow-sm transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}

                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={isConnected ? "Listening..." : selectedImage ? "Add context... (optional)" : "Describe your food..."}
                        className={`w-full bg-transparent border-none text-slate-200 placeholder-slate-500 focus:outline-none text-sm md:text-base ${isConnected ? 'animate-pulse' : ''}`}
                        onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                        disabled={isConnected || isAnalyzing}
                    />
                </div>

                {/* Right Action Button (Mic or Send) */}
                {inputText || selectedImage ? (
                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-wait shrink-0"
                    >
                        {isAnalyzing ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />}
                    </button>
                ) : (
                    <button
                        onClick={isConnected ? disconnect : connect}
                        disabled={isConnecting}
                        className={`p-3 rounded-full transition-all duration-200 shadow-lg shrink-0 ${
                            isConnected 
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25 animate-pulse' 
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                        }`}
                    >
                        {isConnecting ? <Loader2 size={22} className="animate-spin" /> : isConnected ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>
                )}
            </div>
            
        </div>
      </div>
    </div>
  );
};

export default App;
