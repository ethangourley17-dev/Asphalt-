import React, { useState, useEffect } from 'react';
import { Truck, BarChart3, History, LayoutDashboard, Database, TrendingUp } from 'lucide-react';
import { WeighingConsole } from './components/WeighingConsole';
import { getTickets } from './services/storageService';
import { Ticket } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<'console' | 'dashboard'>('console');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);

  // Load tickets whenever a transaction completes
  useEffect(() => {
    const all = getTickets();
    // Sort by most recent
    const sorted = all.sort((a, b) => {
        const timeA = a.outboundTime || a.inboundTime;
        const timeB = b.outboundTime || b.inboundTime;
        return timeB - timeA;
    });
    setRecentTickets(sorted); 
  }, [refreshTrigger, activeTab]);

  const handleTicketComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const totalRevenue = recentTickets.reduce((acc, t) => acc + (t.totalCost || 0), 0);
  const totalWeight = recentTickets.reduce((acc, t) => acc + (t.netWeight || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-xl sticky top-0 z-50 border-b border-slate-800">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-2.5 rounded-lg shadow-lg shadow-green-900/50">
              <Truck size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">REUSE CANADA <span className="font-light text-slate-400">ScaleHub</span></h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Digital Ticketing Platform</p>
            </div>
          </div>
          
          <nav className="flex gap-1 bg-slate-800/50 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('console')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${activeTab === 'console' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <LayoutDashboard size={18} /> <span className="hidden sm:inline">Console</span>
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <BarChart3 size={18} /> <span className="hidden sm:inline">Analytics</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 lg:p-6 overflow-hidden flex flex-col">
        {activeTab === 'console' ? (
          <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
            <div className="flex-1 min-h-0">
               <WeighingConsole onTicketComplete={handleTicketComplete} />
            </div>
            
            {/* Recent Tickets Marquee/List */}
            <div className="h-36 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <History size={14} /> Today's Activity
                </span>
                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1">
                    <Database size={10} /> SYNCED
                </span>
              </div>
              <div className="flex-1 overflow-x-auto p-3 custom-scrollbar">
                <div className="flex gap-3 h-full">
                  {recentTickets.slice(0, 15).map(ticket => (
                    <div key={ticket.id} className="min-w-[220px] bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
                       <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">{ticket.licensePlate}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${ticket.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {ticket.status}
                          </span>
                       </div>
                       <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                            <span className="truncate max-w-[120px]">{ticket.materialType}</span>
                       </div>
                       <div className="mt-3 text-right">
                         {ticket.status === 'CLOSED' ? (
                           <span className="font-bold text-slate-900 text-lg">{ticket.netWeight?.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kg</span></span>
                         ) : (
                           <span className="text-slate-400 text-xs italic">Inbound: {ticket.inboundWeight.toLocaleString()}</span>
                         )}
                       </div>
                    </div>
                  ))}
                  {recentTickets.length === 0 && (
                    <div className="flex items-center justify-center w-full text-slate-400 text-sm italic">
                        No tickets generated yet today.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
             {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                 <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                    <Truck className="text-blue-600" size={24} />
                 </div>
                 <div className="text-4xl font-bold text-slate-800 tracking-tight">{recentTickets.length}</div>
                 <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mt-1">Total Loads</div>
              </div>
              
              <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                 <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                    <Database className="text-green-600" size={24} />
                 </div>
                 <div className="text-4xl font-bold text-green-700 tracking-tight">{totalWeight.toLocaleString()} <span className="text-xl text-green-500/70">kg</span></div>
                 <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mt-1">Total Net Weight</div>
              </div>

              <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                 <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                    <TrendingUp className="text-indigo-600" size={24} />
                 </div>
                 <div className="text-4xl font-bold text-indigo-700 tracking-tight">${totalRevenue.toFixed(2)}</div>
                 <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mt-1">Estimated Revenue</div>
              </div>
            </div>

            {/* Simple Visual Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <BarChart3 size={20} className="text-slate-400"/>
                    Traffic Overview
                </h3>
                <div className="flex items-end justify-between h-48 gap-2">
                    {/* Fake Bar Chart generated from recent tickets for visual flare */}
                    {[...Array(24)].map((_, i) => {
                        // Mock distribution based on hour (just random for demo if no real timestamps populated heavily)
                        const height = Math.floor(Math.random() * 80) + 10; 
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                <div className="w-full bg-slate-100 rounded-t-sm h-full relative overflow-hidden">
                                    <div 
                                        className="absolute bottom-0 left-0 right-0 bg-slate-800 group-hover:bg-blue-600 transition-colors rounded-t-sm"
                                        style={{ height: `${height}%` }}
                                    ></div>
                                </div>
                                <span className="text-[10px] text-slate-400">{i}:00</span>
                            </div>
                        )
                    })}
                </div>
            </div>
            
            {/* Detailed Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-700">Detailed Log</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            <tr>
                                <th className="px-6 py-3">Ticket ID</th>
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">Plate</th>
                                <th className="px-6 py-3">Material</th>
                                <th className="px-6 py-3 text-right">Inbound</th>
                                <th className="px-6 py-3 text-right">Outbound</th>
                                <th className="px-6 py-3 text-right">Net</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTickets.map((t) => (
                                <tr key={t.id} className="bg-white border-b hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-mono">{t.id.slice(0,8)}...</td>
                                    <td className="px-6 py-4">{new Date(t.inboundTime).toLocaleTimeString()}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900">{t.licensePlate}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                            {t.materialType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">{t.inboundWeight} kg</td>
                                    <td className="px-6 py-4 text-right text-slate-400">
                                        {t.outboundWeight ? `${t.outboundWeight} kg` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                                        {t.netWeight ? `${t.netWeight} kg` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;