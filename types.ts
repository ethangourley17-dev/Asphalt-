export enum TicketStatus {
  OPEN = 'OPEN',     // Weighed In
  CLOSED = 'CLOSED'  // Weighed Out
}

export interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

export interface Ticket {
  id: string;
  licensePlate: string;
  companyName?: string;
  materialType: string;
  
  // Inbound Data
  inboundWeight: number; // kg
  inboundTime: number;   // timestamp
  inboundImage: string;  // base64
  
  // Outbound Data (Optional until closed)
  outboundWeight?: number; // kg
  outboundTime?: number;   // timestamp
  outboundImage?: string;  // base64
  
  // Financials
  netWeight?: number;
  ratePerKg?: number;
  totalCost?: number;
  
  status: TicketStatus;
}

export interface ScaleConnectionState {
  isConnected: boolean;
  port?: SerialPort;
  reader?: ReadableStreamDefaultReader;
  isSimulated: boolean;
}

export interface RecognitionResult {
  licensePlate: string;
  confidence: number;
}