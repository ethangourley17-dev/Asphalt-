import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Scale, Printer, ArrowRightLeft, CheckCircle, AlertCircle, RefreshCw, Anchor } from 'lucide-react';
import { ScaleService } from '../services/scaleService';
import { identifyTruck } from '../services/geminiService';
import { Ticket, TicketStatus } from '../types';
import { saveTicket, findOpenTicketByPlate } from '../services/storageService';
import ReceiptPrinter from './ReceiptPrinter';

interface WeighingConsoleProps {
  onTicketComplete: () => void;
}

export const WeighingConsole: React.FC<WeighingConsoleProps> = ({ onTicketComplete }) => {
  // State
  const [currentWeight, setCurrentWeight] = useState<number>(0);
  const [isStable, setIsStable] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [detectedPlate, setDetectedPlate] = useState<string>('');
  const [mode, setMode] = useState<'IDLE' | 'INBOUND' | 'OUTBOUND'>('IDLE');
  const [matchedTicket, setMatchedTicket] = useState<Ticket | null>(null);
  const [material, setMaterial] = useState<string>('Mixed Metal');
  const [lastPrintedTicket, setLastPrintedTicket] = useState<Ticket | null>(null);
  const [manualWeight, setManualWeight] = useState<string>('');
  const [useManualWeight, setUseManualWeight] = useState<boolean>(false);

  // Stability Tracking
  const lastWeightRef = useRef<number>(0);
  const stabilityTimeoutRef = useRef<number | null>(null);

  // Refs
  const webcamRef = useRef<Webcam>(null);
  const scaleService = useRef<ScaleService | null>(null);

  // Logic: Check Stability
  // In real world, scales set a "Stable" bit. Here we simulate it.
  useEffect(() => {
    if (useManualWeight) {
      setIsStable(true);
      return;
    }

    // Reset stability on change
    setIsStable(false);
    
    // Clear existing timeout
    if (stabilityTimeoutRef.current) {
      window.clearTimeout(stabilityTimeoutRef.current);
    }

    // Set new timeout: if weight doesn't change for 800ms, it's stable
    stabilityTimeoutRef.current = window.setTimeout(() => {
        setIsStable(true);
    }, 800);

    return () => {
        if (stabilityTimeoutRef.current) window.clearTimeout(stabilityTimeoutRef.current);
    };
  }, [currentWeight, useManualWeight]);

  // Helper: Simulation Loop
  useEffect(() => {
    let interval: number;
    let targetWeight = 15400;
    
    if (isSimulating) {
      interval = window.setInterval(() => {
        setCurrentWeight(prev => {
           // Drift towards target
           const diff = targetWeight - prev;
           if (Math.abs(diff) < 10) return prev; // Stay stable
           
           // Random jitter
           const jitter = (Math.random() - 0.5) * 50;
           return Math.floor(prev + (diff * 0.1) + jitter);
        });

        // Change target occasionally to simulate truck getting on/off
        if (Math.random() > 0.98) {
            targetWeight = Math.random() > 0.5 ? 0 : Math.floor(12000 + Math.random() * 8000);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

  // Connect Scale
  const handleConnectScale = async () => {
    if (scaleService.current) return;

    scaleService.current = new ScaleService((weight) => {
      if (!useManualWeight) setCurrentWeight(weight);
    });

    try {
      const connected = await scaleService.current.connect();
      setIsConnected(connected);
      setIsSimulating(false);
    } catch (e) {
      alert("Failed to connect. Ensure you are on Chrome/Edge Desktop or use Simulation mode.");
    }
  };

  // Toggle Simulation
  const toggleSimulation = () => {
    setIsSimulating(!isSimulating);
    setIsConnected(false); // Can't be both
    if (scaleService.current) scaleService.current.disconnect();
    scaleService.current = null;
    setCurrentWeight(0);
  };

  // Capture & Process
  const handleCapture = async () => {
    if (!webcamRef.current) return;
    if (!isStable && !useManualWeight) {
        alert("Scale is unstable. Please wait for the STABLE indicator.");
        return;
    }

    setProcessing(true);
    setMode('IDLE');
    setMatchedTicket(null);
    setDetectedPlate('');

    try {
      // 1. Capture Image
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Camera capture failed");

      // 2. Identify Truck (Gemini)
      const recognition = await identifyTruck(imageSrc);
      setDetectedPlate(recognition.licensePlate);

      // 3. Logic: Check for Open Ticket
      const openTicket = findOpenTicketByPlate(recognition.licensePlate);

      if (openTicket) {
        setMode('OUTBOUND');
        setMatchedTicket(openTicket);
      } else {
        setMode('INBOUND');
      }

    } catch (error) {
      console.error(error);
      alert("Error processing transaction.");
    } finally {
      setProcessing(false);
    }
  };

  // Finalize Inbound
  const processInbound = () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    
    const newTicket: Ticket = {
      id: crypto.randomUUID(),
      licensePlate: detectedPlate || 'UNKNOWN',
      materialType: material,
      inboundWeight: useManualWeight ? parseFloat(manualWeight) || 0 : currentWeight,
      inboundTime: Date.now(),
      inboundImage: imageSrc || '',
      status: TicketStatus.OPEN
    };

    saveTicket(newTicket);
    resetConsole();
    onTicketComplete();
  };

  // Finalize Outbound
  const processOutbound = () => {
    if (!matchedTicket || !webcamRef.current) return;
    
    const outWeight = useManualWeight ? parseFloat(manualWeight) || 0 : currentWeight;
    const net = Math.abs(matchedTicket.inboundWeight - outWeight);
    const rate = 0.25; // Hardcoded $0.25/kg for demo
    const cost = net * rate;

    const updatedTicket: Ticket = {
      ...matchedTicket,
      outboundWeight: outWeight,
      outboundTime: Date.now(),
      outboundImage: webcamRef.current.getScreenshot() || '',
      netWeight: net,
      ratePerKg: rate,
      totalCost: cost,
      status: TicketStatus.CLOSED
    };

    saveTicket(updatedTicket);
    setLastPrintedTicket(updatedTicket);
    
    // Auto Print after short delay to allow state update
    setTimeout(() => {
        window.print();
        resetConsole();
        onTicketComplete();
    }, 500);
  };

  const resetConsole = () => {
    setMode('IDLE');
    setDetectedPlate('');
    setMatchedTicket(null);
    setManualWeight('');
    if (useManualWeight) setManualWeight('0');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <ReceiptPrinter ticket={lastPrintedTicket} />

      {/* Left: Camera Feed */}
      <div className="flex-1 bg-black rounded-2xl overflow-hidden relative shadow-2xl flex flex-col group border-4 border-slate-800">
        <div className="relative flex-grow bg-slate-900">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            className="w-full h-full object-cover opacity-80"
            videoConstraints={{ facingMode: "environment" }}
          />
          
          {/* Scanline Effect */}
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50"></div>
          
          {/* Overlays */}
          <div className="absolute top-4 left-4 flex gap-2">
            <span className={`px-3 py-1 rounded-sm text-xs font-mono font-bold tracking-wider flex items-center gap-2 uppercase border ${isConnected || isSimulating ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}`}>
              <Scale size={14} />
              {isConnected ? 'RS232: ONLINE' : isSimulating ? 'SIMULATION' : 'RS232: OFFLINE'}
            </span>
            <span className="px-3 py-1 rounded-sm text-xs font-mono font-bold tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/50 flex items-center gap-2 uppercase">
              <Camera size={14} /> CAM: LIVE
            </span>
          </div>

          {/* Target Reticle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-48 border-2 border-white/30 rounded-lg relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>
            </div>
          </div>
        </div>

        {/* Manual Weight Override */}
        <div className="bg-slate-900 p-4 flex items-center justify-between text-slate-300 border-t border-slate-800">
             <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider cursor-pointer hover:text-white transition">
                <input 
                    type="checkbox" 
                    checked={useManualWeight} 
                    onChange={e => {
                        setUseManualWeight(e.target.checked);
                        if(e.target.checked) setManualWeight('0');
                    }}
                    className="w-4 h-4 rounded text-blue-500 bg-slate-800 border-slate-600 focus:ring-offset-slate-900"
                />
                Manual Entry Mode
            </label>
            {useManualWeight && (
                <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        value={manualWeight}
                        onChange={e => setManualWeight(e.target.value)}
                        placeholder="KG"
                        className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-white w-32 font-mono text-right focus:border-blue-500 focus:outline-none"
                    />
                    <span className="text-xs font-bold">KG</span>
                </div>
            )}
        </div>
      </div>

      {/* Right: Controls */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        
        {/* Weight Display (Scale Indicator Style) */}
        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border-4 border-slate-800 relative overflow-hidden">
          {/* Glass Reflection Effect */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

          <div className="flex justify-between items-start mb-2">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gross Weight</h2>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${isStable ? 'bg-green-500 text-slate-900' : 'bg-transparent text-slate-600 border border-slate-700'}`}>
                  {isStable ? <Anchor size={10} /> : <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse"></div>}
                  {isStable ? 'STABLE' : 'MOTION'}
              </div>
          </div>
          
          <div className="flex items-baseline justify-end gap-2 my-4">
            <span className={`text-6xl font-mono font-bold tracking-tighter tabular-nums ${isStable ? 'text-green-400 text-shadow-glow' : 'text-slate-500'}`}>
              {useManualWeight ? (manualWeight || '0') : currentWeight.toLocaleString()}
            </span>
            <span className="text-xl text-slate-500 font-medium self-end mb-2">kg</span>
          </div>

          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
             <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${Math.min(((useManualWeight ? parseFloat(manualWeight) : currentWeight) / 50000) * 100, 100)}%` }}></div>
          </div>
          
          {!isConnected && !isSimulating && !useManualWeight && (
            <div className="mt-6 flex gap-2">
               <button 
                onClick={handleConnectScale}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-blue-500 transition shadow-lg shadow-blue-900/20"
              >
                Connect Serial
              </button>
              <button 
                onClick={toggleSimulation}
                className="flex-1 bg-slate-800 text-slate-400 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-slate-700 transition"
              >
                Simulate
              </button>
            </div>
          )}
        </div>

        {/* Processing State */}
        {processing ? (
          <div className="bg-white border border-slate-200 p-8 rounded-2xl flex flex-col items-center justify-center flex-1 shadow-sm text-center">
             <div className="relative">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw size={24} className="text-blue-500" />
                </div>
             </div>
            <p className="text-slate-800 font-bold text-lg">AI Processing</p>
            <p className="text-slate-500 text-sm mt-1">Identifying license plate...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            
            {/* Context Panel */}
            <div className={`flex-1 rounded-2xl p-6 border transition-all shadow-sm ${
              mode === 'IDLE' ? 'bg-white border-slate-200' : 
              mode === 'INBOUND' ? 'bg-green-50 border-green-200' : 
              'bg-amber-50 border-amber-200'
            }`}>
              
              {mode === 'IDLE' && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <ArrowRightLeft className="text-slate-400" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Ready to Weigh</h3>
                  <p className="text-slate-500 text-sm mt-1 mb-6 max-w-[200px]">Ensure truck is stationary on the scale platform.</p>
                  
                  <button 
                    onClick={handleCapture}
                    disabled={(!isStable && !useManualWeight) || (!isConnected && !isSimulating && !useManualWeight)}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-slate-200 disabled:shadow-none transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Camera size={20} />
                    CAPTURE WEIGHT
                  </button>
                  {(!isStable && !useManualWeight) && (
                      <p className="text-xs text-amber-600 font-bold mt-3 animate-pulse">WAITING FOR STABLE WEIGHT...</p>
                  )}
                </div>
              )}

              {mode === 'INBOUND' && (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-green-200">
                    <div className="bg-green-100 p-2 rounded-full">
                        <CheckCircle className="text-green-600" size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-green-900 leading-tight">Inbound Ticket</h3>
                        <p className="text-xs text-green-700">New arrival detected</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 mb-auto">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">License Plate</label>
                      <input 
                        type="text" 
                        value={detectedPlate} 
                        onChange={(e) => setDetectedPlate(e.target.value.toUpperCase())}
                        className="w-full bg-white border border-slate-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 rounded-lg p-3 font-mono text-xl font-bold tracking-wider text-slate-800" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Material Type</label>
                      <select 
                        value={material}
                        onChange={(e) => setMaterial(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-3 font-medium text-slate-700"
                      >
                        <option>Mixed Metal</option>
                        <option>Cardboard</option>
                        <option>Plastic</option>
                        <option>E-Waste</option>
                        <option>Construction Debris</option>
                        <option>Clean Wood</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <button onClick={resetConsole} className="px-4 py-3 rounded-lg font-medium text-slate-500 hover:bg-slate-100 text-sm">Cancel</button>
                    <button onClick={processInbound} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-green-200 transition-colors">
                      CREATE TICKET
                    </button>
                  </div>
                </div>
              )}

              {mode === 'OUTBOUND' && matchedTicket && (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-amber-200">
                     <div className="bg-amber-100 p-2 rounded-full">
                        <AlertCircle className="text-amber-600" size={20} />
                     </div>
                     <div>
                        <h3 className="font-bold text-amber-900 leading-tight">Outbound Ticket</h3>
                        <p className="text-xs text-amber-700">Completing transaction</p>
                    </div>
                  </div>

                  <div className="bg-white/60 rounded-xl p-4 space-y-3 mb-auto border border-amber-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase">Plate</span>
                      <span className="font-mono font-bold text-lg text-slate-800">{matchedTicket.licensePlate}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Inbound</span>
                      <span className="font-mono text-slate-700">{matchedTicket.inboundWeight} kg</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Current</span>
                      <span className="font-mono text-slate-700">{(useManualWeight ? parseFloat(manualWeight) || 0 : currentWeight)} kg</span>
                    </div>
                    <div className="border-t border-dashed border-amber-200 my-2"></div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-900">Net Weight</span>
                      <span className="font-mono font-bold text-xl text-amber-600">{Math.abs(matchedTicket.inboundWeight - (useManualWeight ? parseFloat(manualWeight) || 0 : currentWeight))} kg</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <button onClick={resetConsole} className="px-4 py-3 rounded-lg font-medium text-slate-500 hover:bg-slate-100 text-sm">Cancel</button>
                    <button onClick={processOutbound} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold shadow-lg shadow-slate-300 flex items-center justify-center gap-2 transition-colors">
                      <Printer size={18} /> PRINT TICKET
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
};