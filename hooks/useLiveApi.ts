import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { decodeBase64, pcmToAudioBuffer, float32ToPcmBlob, INPUT_SAMPLE_RATE } from '../utils/audioUtils';
import { NutritionData } from '../types';

// Define the tool for the model to use
export const showNutritionInfoDeclaration: FunctionDeclaration = {
  name: "showNutritionInfo",
  description: "Display visual nutritional info for identified food.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      foodName: { type: Type.STRING, description: "Food name" },
      cookingMethod: { type: Type.STRING, description: "The identified cooking process (e.g. Deep Fried, Steamed, Boiled, Raw). This parameter is crucial for adjusting nutrient estimates, particularly for water-soluble and heat-sensitive vitamins, to provide a more accurate micronutrient profile." },
      calories: { type: Type.NUMBER, description: "Total calories" },
      protein: { type: Type.NUMBER, description: "Protein (g)" },
      carbs: { type: Type.NUMBER, description: "Carbs (g)" },
      fat: { type: Type.NUMBER, description: "Fat (g)" },
      fiber: { type: Type.NUMBER, description: "Fiber (g)" },
      sugar: { type: Type.NUMBER, description: "Sugar (g)" },
      sugarAlcohols: { type: Type.NUMBER, description: "Sugar alcohols (g)" },
      waterContent: { type: Type.NUMBER, description: "Water content (g)" },
      electrolytes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Electrolytes list" },
      micros: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT,
          properties: {
             name: { type: Type.STRING },
             amount: { type: Type.NUMBER },
             unit: { type: Type.STRING },
             percentageOfDailyNeeds: { type: Type.NUMBER }
          },
          required: ["name", "amount", "unit"]
        },
        description: "Micronutrients (adjusted for cooking loss)" 
      },
      ingredients: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING, description: "Brief interesting fact." },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER, description: "Grams of protein in this ingredient" },
            fat: { type: Type.NUMBER, description: "Grams of fat in this ingredient" },
            carbs: { type: Type.NUMBER, description: "Grams of carbs in this ingredient" },
            icon: { type: Type.STRING, description: "Emoji" }
          },
          required: ["name", "description"]
        }, 
        description: "Ingredients list with macros" 
      },
      healthScore: { type: Type.NUMBER, description: "Score 0-100" },
      summary: { type: Type.STRING, description: "Brief summary including cooking method notes." }
    },
    required: ["foodName", "cookingMethod", "calories", "protein", "carbs", "fat", "micros", "ingredients", "healthScore", "summary"]
  }
};

interface UseLiveApiProps {
  onDataReceived: (data: NutritionData) => void;
}

interface UseLiveApiReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  volume: number; // For visualization 0-1
  error: string | null;
}

export const useLiveApi = ({ onDataReceived }: UseLiveApiProps): UseLiveApiReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  // Audio Contexts
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  
  // Streaming Logic
  const sessionPromiseRef = useRef<Promise<any> | null>(null); // Using any for session type to avoid deep import issues for now
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const disconnect = useCallback(() => {
    // 1. Close Session
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            try {
                // Try closing if method exists, otherwise just let it drop
                if(typeof session.close === 'function') session.close();
            } catch (e) {
                console.warn("Error closing session", e);
            }
        });
        sessionPromiseRef.current = null;
    }

    // 2. Stop Microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 3. Stop Audio Processing
    if (processorRef.current && inputContextRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }

    // 4. Stop Playback
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    setIsConnected(false);
    setIsConnecting(false);
    setVolume(0);
  }, []);

  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;
    setIsConnecting(true);
    setError(null);

    try {
      // Initialize Audio Contexts
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (!inputContextRef.current) {
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      }

      // Resume contexts (needed for some browsers like Chrome/Safari after user interaction)
      await audioContextRef.current.resume();
      await inputContextRef.current.resume();

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are NutriVoice. Analyze food images/audio. Call `showNutritionInfo`. IMPORTANT: Identify the cooking method (e.g. Frying, Boiling, Raw) and adjust nutrient estimates, especially micronutrients (e.g. reduce Vitamin C for boiled foods). Break down ingredients with individual macros.",
          tools: [{ functionDeclarations: [showNutritionInfoDeclaration] }]
        }
      };

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Connect to Gemini
      sessionPromiseRef.current = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            console.log("Gemini Live API Connected");
            setIsConnected(true);
            setIsConnecting(false);

            // Setup Audio Pipeline: Mic -> ScriptProcessor -> Gemini
            if (!inputContextRef.current || !streamRef.current) return;

            const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(rms * 5, 1)); // Amplify a bit for visual effect

              // Send to Gemini
              const pcmBlob = float32ToPcmBlob(inputData);
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
            
            sourceNodeRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
            // 1. Handle Tool Calls
            if (message.toolCall) {
               console.log("Received Tool Call:", message.toolCall);
               const responses = [];
               for (const fc of message.toolCall.functionCalls) {
                 if (fc.name === 'showNutritionInfo') {
                   try {
                     const args = fc.args as any;
                     if (!args) {
                        throw new Error("Missing arguments for showNutritionInfo");
                     }
                     // Validate key fields
                     if (!args.foodName) {
                        console.error("Malformed tool call: Missing foodName", args);
                        throw new Error("Missing foodName in tool arguments");
                     }

                     const data = args as NutritionData;
                     // Inject ID and timestamp
                     data.id = crypto.randomUUID();
                     data.timestamp = Date.now();
                     onDataReceived(data); // Update UI via Callback
                     responses.push({
                       id: fc.id,
                       name: fc.name,
                       response: { result: "Nutrition info displayed." }
                     });
                   } catch (error) {
                     console.error("Error handling showNutritionInfo tool call:", error);
                     responses.push({
                       id: fc.id,
                       name: fc.name,
                       response: { result: "Error: Could not process nutrition data." }
                     });
                   }
                 }
               }
               // Send confirmation back
               if (responses.length > 0 && sessionPromiseRef.current) {
                  const session = await sessionPromiseRef.current;
                  session.sendToolResponse({ functionResponses: responses });
               }
            }

            // 2. Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
               const ctx = audioContextRef.current;
               try {
                   // Ensure nextStartTime is valid relative to current time
                   nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                   
                   const audioBuffer = await pcmToAudioBuffer(decodeBase64(base64Audio), ctx);
                   const source = ctx.createBufferSource();
                   source.buffer = audioBuffer;
                   source.connect(ctx.destination);
                   
                   source.addEventListener('ended', () => {
                     sourcesRef.current.delete(source);
                   });

                   source.start(nextStartTimeRef.current);
                   nextStartTimeRef.current += audioBuffer.duration;
                   sourcesRef.current.add(source);
               } catch (err) {
                   console.error("Error decoding/playing audio chunk", err);
               }
            }
            
            // 3. Handle Interruptions
            if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log("Gemini Live API Closed");
            disconnect();
          },
          onerror: (err) => {
            console.error("Gemini Live API Error", err);
            setError(err.message || "Connection error");
            disconnect();
          }
        }
      });

    } catch (err: any) {
      console.error("Connection failed", err);
      setError(err.message || "Failed to connect to microphone or API");
      setIsConnecting(false);
      disconnect();
    }
  }, [isConnected, isConnecting, disconnect, onDataReceived]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    volume,
    error
  };
};