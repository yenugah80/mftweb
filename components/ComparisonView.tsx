import React from 'react';
import { NutritionData, UnitSystem } from '../types';
import { X, Trophy, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  item1: NutritionData;
  item2: NutritionData;
  onClose: () => void;
  unitSystem: UnitSystem;
}

export const ComparisonView: React.FC<Props> = ({ item1, item2, onClose, unitSystem }) => {
  const chartData = [
    { name: 'Calories', [item1.foodName]: item1.calories, [item2.foodName]: item2.calories },
    { name: 'Protein (g)', [item1.foodName]: item1.protein, [item2.foodName]: item2.protein },
    { name: 'Fat (g)', [item1.foodName]: item1.fat, [item2.foodName]: item2.fat },
    { name: 'Carbs (g)', [item1.foodName]: item1.carbs, [item2.foodName]: item2.carbs },
  ];

  const betterHealthScore = item1.healthScore > item2.healthScore ? item1 : item2.healthScore > item1.healthScore ? item2 : null;

  const MetricRow = ({ label, val1, val2, unitLabel }: { label: string, val1: number, val2: number, unitLabel?: string }) => {
      // Conversion logic if needed, but assuming val1/val2 are already raw from data
      // We will perform conversion for display only if needed
      
      let displayVal1 = val1;
      let displayVal2 = val2;
      let finalUnit = unitLabel || '';

      if (unitLabel === 'g' && unitSystem === 'imperial') {
          displayVal1 = val1 * 0.035274;
          displayVal2 = val2 * 0.035274;
          finalUnit = 'oz';
      }

      const highlight1 = val1 > val2 ? 'font-bold text-indigo-400' : 'text-slate-400';
      const highlight2 = val2 > val1 ? 'font-bold text-sky-400' : 'text-slate-400';
      
      return (
          <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
              <span className={`w-1/4 text-right ${highlight1}`}>{unitSystem === 'imperial' && unitLabel === 'g' ? displayVal1.toFixed(1) : Math.round(displayVal1)}{finalUnit}</span>
              <span className="w-1/2 text-center text-sm text-slate-500 font-medium uppercase tracking-wider">{label}</span>
              <span className={`w-1/4 text-left ${highlight2}`}>{unitSystem === 'imperial' && unitLabel === 'g' ? displayVal2.toFixed(1) : Math.round(displayVal2)}{finalUnit}</span>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/50 p-2 rounded-full z-10">
          <X size={20} />
        </button>

        <div className="p-6 border-b border-slate-800 bg-slate-800/30">
            <h2 className="text-2xl font-bold text-white text-center mb-1">Nutrition Comparison</h2>
            <div className="flex justify-center items-center gap-8 mt-4">
                <div className="text-center w-1/3">
                    <h3 className="text-xl font-bold text-indigo-400 truncate">{item1.foodName}</h3>
                    {betterHealthScore === item1 && <div className="flex items-center justify-center gap-1 text-xs text-yellow-500 mt-1"><Trophy size={12}/> Healthier Choice</div>}
                </div>
                <div className="text-slate-600 font-mono text-sm">VS</div>
                <div className="text-center w-1/3">
                    <h3 className="text-xl font-bold text-sky-400 truncate">{item2.foodName}</h3>
                     {betterHealthScore === item2 && <div className="flex items-center justify-center gap-1 text-xs text-yellow-500 mt-1"><Trophy size={12}/> Healthier Choice</div>}
                </div>
            </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-8 flex-1">
            
            {/* Chart */}
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                            cursor={{ fill: '#334155', opacity: 0.2 }}
                        />
                        <Legend />
                        <Bar dataKey={item1.foodName} fill="#818cf8" radius={[4, 4, 0, 0]} name={item1.foodName} />
                        <Bar dataKey={item2.foodName} fill="#38bdf8" radius={[4, 4, 0, 0]} name={item2.foodName} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Metrics Table */}
            <div className="bg-slate-800/30 rounded-2xl p-4">
                <MetricRow label="Health Score" val1={item1.healthScore} val2={item2.healthScore} />
                <MetricRow label="Calories" val1={item1.calories} val2={item2.calories} />
                <MetricRow label="Protein" val1={item1.protein} val2={item2.protein} unitLabel="g" />
                <MetricRow label="Carbs" val1={item1.carbs} val2={item2.carbs} unitLabel="g" />
                <MetricRow label="Fat" val1={item1.fat} val2={item2.fat} unitLabel="g" />
                <MetricRow label="Fiber" val1={item1.fiber || 0} val2={item2.fiber || 0} unitLabel="g" />
                <MetricRow label="Sugar" val1={item1.sugar || 0} val2={item2.sugar || 0} unitLabel="g" />
            </div>

            {/* Differences Highlight */}
            <div className="grid grid-cols-2 gap-4">
                 <div className="bg-indigo-900/20 border border-indigo-500/20 p-4 rounded-xl">
                    <h4 className="text-indigo-400 text-sm font-bold mb-2 uppercase">{item1.foodName} Highlights</h4>
                    <ul className="text-xs text-slate-300 space-y-1">
                        {item1.protein > item2.protein && <li>• Higher protein content (+{(item1.protein - item2.protein).toFixed(1)}g)</li>}
                        {item1.calories < item2.calories && <li>• Lower calories (-{(item2.calories - item1.calories).toFixed(0)})</li>}
                        {item1.fiber && item2.fiber && item1.fiber > item2.fiber && <li>• More fiber (+{(item1.fiber - item2.fiber).toFixed(1)}g)</li>}
                        {item1.healthScore > item2.healthScore && <li>• Higher overall health score</li>}
                    </ul>
                 </div>
                 <div className="bg-sky-900/20 border border-sky-500/20 p-4 rounded-xl">
                    <h4 className="text-sky-400 text-sm font-bold mb-2 uppercase">{item2.foodName} Highlights</h4>
                    <ul className="text-xs text-slate-300 space-y-1">
                        {item2.protein > item1.protein && <li>• Higher protein content (+{(item2.protein - item1.protein).toFixed(1)}g)</li>}
                        {item2.calories < item1.calories && <li>• Lower calories (-{(item1.calories - item2.calories).toFixed(0)})</li>}
                        {item2.fiber && item1.fiber && item2.fiber > item1.fiber && <li>• More fiber (+{(item2.fiber - item1.fiber).toFixed(1)}g)</li>}
                        {item2.healthScore > item1.healthScore && <li>• Higher overall health score</li>}
                    </ul>
                 </div>
            </div>

        </div>
      </div>
    </div>
  );
};