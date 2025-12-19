export interface Ingredient {
  name: string;
  description: string;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  icon?: string; // Emoji
}

export interface MicroNutrient {
  name: string;
  amount: number;
  unit: string;
  percentageOfDailyNeeds?: number;
}

export interface NutritionData {
  id?: string; // Unique ID for history
  timestamp?: number;
  foodName: string;
  cookingMethod?: string; // e.g. "Fried", "Steamed", "Raw"
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sugarAlcohols?: number;
  waterContent?: number; // in grams
  electrolytes?: string[];
  micros: MicroNutrient[]; // Detailed quantitative data
  ingredients: Ingredient[];
  healthScore: number;
  summary: string;
}

export interface AudioConfig {
  sampleRate: number;
  numChannels: number;
}

export type UnitSystem = 'metric' | 'imperial';