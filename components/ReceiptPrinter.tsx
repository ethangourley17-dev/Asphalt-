import React from 'react';
import { Ticket } from '../types';

interface ReceiptPrinterProps {
  ticket: Ticket | null;
}

const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({ ticket }) => {
  if (!ticket) return null;

  return (
    <div id="printable-ticket" className="hidden print:block p-4 font-mono text-sm">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold uppercase">Reuse Canada</h1>
        <p>123 Industrial Parkway</p>
        <p>Vancouver, BC</p>
        <p>Tel: (555) 123-4567</p>
      </div>

      <div className="border-b border-black pb-2 mb-2">
        <p><strong>Ticket #:</strong> {ticket.id.slice(0, 8)}</p>
        <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
        <p><strong>License:</strong> {ticket.licensePlate}</p>
        <p><strong>Material:</strong> {ticket.materialType}</p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between">
          <span>Inbound:</span>
          <span>{ticket.inboundWeight} kg</span>
        </div>
        <div className="text-xs text-gray-500 mb-1">
          {new Date(ticket.inboundTime).toLocaleTimeString()}
        </div>

        {ticket.outboundWeight && (
          <>
            <div className="flex justify-between">
              <span>Outbound:</span>
              <span>{ticket.outboundWeight} kg</span>
            </div>
             <div className="text-xs text-gray-500 mb-1">
              {new Date(ticket.outboundTime || 0).toLocaleTimeString()}
            </div>
            
            <div className="border-t border-black border-dashed my-2"></div>
            
            <div className="flex justify-between font-bold text-lg">
              <span>Net Weight:</span>
              <span>{ticket.netWeight} kg</span>
            </div>
          </>
        )}
      </div>

      {ticket.totalCost && (
        <div className="border-t-2 border-black pt-2 mb-4">
           <div className="flex justify-between font-bold text-xl">
              <span>TOTAL:</span>
              <span>${ticket.totalCost.toFixed(2)}</span>
            </div>
        </div>
      )}

      <div className="text-center text-xs mt-8">
        <p>Thank you for recycling with Reuse Canada!</p>
        <p>Please drive safely.</p>
      </div>
      
      {/* Thumbnails for record */}
      <div className="mt-4 flex justify-between gap-2 grayscale opacity-70">
          <img src={ticket.inboundImage} className="w-1/2 h-auto object-cover border border-black" />
          {ticket.outboundImage && <img src={ticket.outboundImage} className="w-1/2 h-auto object-cover border border-black" />}
      </div>
    </div>
  );
};

export default ReceiptPrinter;