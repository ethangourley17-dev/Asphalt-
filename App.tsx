import React, { useState, useEffect } from 'react';
import { Truck, BarChart3, History, LayoutDashboard } from 'lucide-react';
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
    setRecentTickets(sorted.slice(0, 10)); // Last 10
  }, [refreshTrigger]);

  const handleTicketComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 p-2 rounded-lg">
              <Truck size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">REUSE CANADA <span className="font-light opacity-70">ScaleHub</span></h1>
            </div>
          </div>
          
          <nav className="flex gap-2">
            <button 
              onClick={() => setActiveTab('console')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition ${activeTab === 'console' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutDashboard size={18} /> Scale Console
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <BarChart3 size={18} /> History & Reports
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
            <div className="h-32 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <History size={14} /> Recent Activity
                </span>
                <span className="text-xs text-slate-400">Syncing to LocalStorage</span>
              </div>
              <div className="flex-1 overflow-x-auto p-2">
                <div className="flex gap-3 h-full">
                  {recentTickets.map(ticket => (
                    <div key={ticket.id} className="min-w-[200px] bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col justify-between hover:border-blue-300 transition cursor-pointer">
                       <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-sm">{ticket.licensePlate}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ticket.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                            {ticket.status}
                          </span>
                       </div>
                       <div className="text-xs text-slate-500 mt-1 truncate">{ticket.materialType}</div>
                       <div className="mt-2 text-right">
                         {ticket.status === 'CLOSED' ? (
                           <span className="font-bold text-slate-800">{ticket.netWeight} kg</span>
                         ) : (
                           <span className="text-slate-400 italic">Inbound: {ticket.inboundWeight}</span>
                         )}
                       </div>
                    </div>
                  ))}
                  {recentTickets.length === 0 && (
                    <div className="flex items-center justify-center w-full text-slate-400 text-sm">No recent tickets</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Daily Report</h2>
            <p className="text-slate-500 mb-8">Detailed analytics and export functionality would go here.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-50 rounded-xl">
                 <div className="text-4xl font-bold text-slate-800">{recentTickets.length}</div>
                 <div className="text-slate-500 text-sm uppercase mt-2">Total Tickets</div>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl">
                 <div className="text-4xl font-bold text-green-600">
                    {recentTickets.reduce((acc, t) => acc + (t.netWeight || 0), 0).toLocaleString()} kg
                 </div>
                 <div className="text-slate-500 text-sm uppercase mt-2">Total Net Weight</div>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl">
                 <div className="text-4xl font-bold text-blue-600">
                    ${recentTickets.reduce((acc, t) => acc + (t.totalCost || 0), 0).toFixed(2)}
                 </div>
                 <div className="text-slate-500 text-sm uppercase mt-2">Total Revenue</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;