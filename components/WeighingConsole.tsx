import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Scale, Printer, ArrowRightLeft, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
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

  // Refs
  const webcamRef = useRef<Webcam>(null);
  const scaleService = useRef<ScaleService | null>(null);

  // Helper: Simulation Loop
  useEffect(() => {
    let interval: number;
    if (isSimulating) {
      interval = window.setInterval(() => {
        // Simulates a fluctuating scale weight settling around 15000kg
        const noise = Math.random() * 50;
        setCurrentWeight(Math.floor(15000 + noise));
      }, 500);
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
  };

  // Capture & Process
  const handleCapture = async () => {
    if (!webcamRef.current) return;
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
      licensePlate: detectedPlate || 'MANUAL-' + Date.now().toString().slice(-4),
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
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <ReceiptPrinter ticket={lastPrintedTicket} />

      {/* Left: Camera Feed */}
      <div className="flex-1 bg-black rounded-2xl overflow-hidden relative shadow-xl flex flex-col">
        <div className="relative flex-grow">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            className="w-full h-full object-cover"
            videoConstraints={{ facingMode: "environment" }}
          />
          
          {/* Overlays */}
          <div className="absolute top-4 left-4 flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${isConnected || isSimulating ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              <Scale size={14} />
              {isConnected ? 'SCALE CONNECTED (RS232)' : isSimulating ? 'SIMULATION MODE' : 'SCALE OFFLINE'}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white flex items-center gap-2">
              <Camera size={14} /> CAMERA ACTIVE
            </span>
          </div>
        </div>

        {/* Manual Weight Override for iPad support */}
        <div className="bg-gray-900 p-4 flex items-center justify-between text-white border-t border-gray-800">
             <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={useManualWeight} 
                    onChange={e => setUseManualWeight(e.target.checked)}
                    className="w-4 h-4 rounded text-green-500 focus:ring-green-500"
                />
                Manual Weight Entry
            </label>
            {useManualWeight && (
                <input 
                    type="number" 
                    value={manualWeight}
                    onChange={e => setManualWeight(e.target.value)}
                    placeholder="Enter kg"
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white w-32"
                />
            )}
        </div>
      </div>

      {/* Right: Controls */}
      <div className="w-full lg:w-1/3 flex flex-col gap-4">
        
        {/* Weight Display */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Live Weight</h2>
          <div className="flex items-baseline gap-2">
            <span className={`text-6xl font-mono font-bold tracking-tight ${useManualWeight ? 'text-blue-600' : 'text-slate-900'}`}>
              {useManualWeight ? (manualWeight || '0') : currentWeight.toLocaleString()}
            </span>
            <span className="text-2xl text-slate-400 font-medium">kg</span>
          </div>
          
          {!isConnected && !isSimulating && !useManualWeight && (
            <div className="mt-4 flex gap-2">
               <button 
                onClick={handleConnectScale}
                className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
              >
                Connect RS232
              </button>
              <button 
                onClick={toggleSimulation}
                className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
              >
                Simulate
              </button>
            </div>
          )}
        </div>

        {/* Processing State */}
        {processing ? (
          <div className="bg-blue-50 border border-blue-100 p-8 rounded-2xl flex flex-col items-center justify-center h-64 animate-pulse">
            <RefreshCw className="animate-spin text-blue-500 mb-4" size={48} />
            <p className="text-blue-700 font-medium">Analyzing Image & Plate...</p>
            <p className="text-blue-400 text-sm mt-2">Gemini AI Processing</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            
            {/* Context Panel */}
            <div className={`flex-1 rounded-2xl p-6 border transition-all ${
              mode === 'IDLE' ? 'bg-slate-50 border-slate-200' : 
              mode === 'INBOUND' ? 'bg-green-50 border-green-200' : 
              'bg-amber-50 border-amber-200'
            }`}>
              
              {mode === 'IDLE' && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                    <ArrowRightLeft className="text-slate-400" size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700">Ready to Weigh</h3>
                  <p className="text-slate-500 text-sm mt-2 mb-6">Truck must be stationary on scale.</p>
                  <button 
                    onClick={handleCapture}
                    disabled={(!isConnected && !isSimulating && !useManualWeight)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-95"
                  >
                    CAPTURE & ANALYZE
                  </button>
                </div>
              )}

              {mode === 'INBOUND' && (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="text-green-600" />
                    <span className="font-bold text-green-800">New Inbound Load</span>
                  </div>
                  
                  <div className="space-y-4 mb-auto">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Detected Plate</label>
                      <input 
                        type="text" 
                        value={detectedPlate} 
                        onChange={(e) => setDetectedPlate(e.target.value.toUpperCase())}
                        className="w-full bg-white border border-green-200 rounded-lg p-3 font-mono text-lg font-bold" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Material Type</label>
                      <select 
                        value={material}
                        onChange={(e) => setMaterial(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 font-medium"
                      >
                        <option>Mixed Metal</option>
                        <option>Cardboard</option>
                        <option>Plastic</option>
                        <option>E-Waste</option>
                        <option>Construction Debris</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <button onClick={resetConsole} className="px-4 py-3 rounded-lg font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
                    <button onClick={processInbound} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-green-200">
                      CREATE TICKET
                    </button>
                  </div>
                </div>
              )}

              {mode === 'OUTBOUND' && matchedTicket && (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="text-amber-600" />
                    <span className="font-bold text-amber-800">Completing Ticket #{matchedTicket.id.slice(0,6)}</span>
                  </div>

                  <div className="bg-white/50 rounded-lg p-4 space-y-2 mb-auto">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Plate:</span>
                      <span className="font-mono font-bold">{matchedTicket.licensePlate}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Inbound Wgt:</span>
                      <span className="font-mono">{matchedTicket.inboundWeight} kg</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Material:</span>
                      <span className="font-medium">{matchedTicket.materialType}</span>
                    </div>
                    <div className="border-t border-amber-200 my-2"></div>
                    <div className="flex justify-between text-lg font-bold text-slate-800">
                      <span>Est. Net:</span>
                      <span>{Math.abs(matchedTicket.inboundWeight - (useManualWeight ? parseFloat(manualWeight) || 0 : currentWeight))} kg</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <button onClick={resetConsole} className="px-4 py-3 rounded-lg font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
                    <button onClick={processOutbound} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-amber-200 flex items-center justify-center gap-2">
                      <Printer size={18} /> FINISH & PRINT
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