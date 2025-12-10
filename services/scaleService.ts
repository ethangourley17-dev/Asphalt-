import { SerialPort } from '../types';

/**
 * Handles communication with the Truck Scale via Web Serial API.
 * Typical Truck Scale Output (RS232):
 * ST,GS, +  45000 kg
 * 
 * We need to parse this continuous stream.
 */

export class ScaleService {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private readableStreamClosed: Promise<void> | null = null;
  private onWeightUpdate: (weight: number) => void;
  private isReading: boolean = false;
  private buffer: string = '';

  constructor(onWeightUpdate: (weight: number) => void) {
    this.onWeightUpdate = onWeightUpdate;
  }

  // Check if browser supports Web Serial
  static isSupported(): boolean {
    return 'serial' in (navigator as any);
  }

  async connect() {
    if (!ScaleService.isSupported()) {
      throw new Error('Web Serial API not supported in this browser.');
    }

    try {
      // Request user to select a port
      const nav = navigator as any;
      this.port = await nav.serial.requestPort();
      
      // Open port - Standard scale settings (adjust based on specific scale manual)
      // Commonly: Baud 9600, 8 data bits, 1 stop bit, no parity
      if (this.port) {
        await this.port.open({ baudRate: 9600 });
        
        this.isReading = true;
        this.readLoop();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error connecting to scale:', error);
      return false;
    }
  }

  async disconnect() {
    this.isReading = false;
    if (this.reader) {
      await this.reader.cancel();
      if (this.readableStreamClosed) {
        await this.readableStreamClosed.catch(() => { /* Ignore error */ });
      }
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  private async readLoop() {
    if (!this.port || !this.port.readable) return;

    const textDecoder = new TextDecoderStream();
    this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          this.processData(value);
        }
      }
    } catch (error) {
      console.error('Read loop error:', error);
    } finally {
      if (this.reader) {
        this.reader.releaseLock();
      }
    }
  }

  private processData(chunk: string) {
    this.buffer += chunk;
    
    // Scale messages usually end with \r or \n
    const lines = this.buffer.split(/[\r\n]+/);
    
    // Keep the last fragment in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim().length > 0) {
        const weight = this.parseWeight(line);
        if (weight !== null) {
          this.onWeightUpdate(weight);
        }
      }
    }
  }

  private parseWeight(rawString: string): number | null {
    // Look for number sequences. Remove non-numeric except dots.
    // Example: "ST,GS, + 12400 kg" -> 12400
    // Regex matches numbers possibly with decimals
    const match = rawString.match(/(\d+(\.\d+)?)/);
    if (match) {
      const val = parseFloat(match[0]);
      if (!isNaN(val)) return val;
    }
    return null;
  }
}