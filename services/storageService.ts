import { Ticket, TicketStatus } from "../types";

const STORAGE_KEY = 'reuse_canada_tickets';

export const getTickets = (): Ticket[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveTicket = (ticket: Ticket): void => {
  const tickets = getTickets();
  const existingIndex = tickets.findIndex(t => t.id === ticket.id);
  
  if (existingIndex >= 0) {
    tickets[existingIndex] = ticket;
  } else {
    tickets.push(ticket);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
};

export const findOpenTicketByPlate = (plate: string): Ticket | undefined => {
  if (plate === 'UNKNOWN') return undefined;
  const tickets = getTickets();
  // Simple fuzzy match or exact match
  return tickets.find(t => 
    t.status === TicketStatus.OPEN && 
    t.licensePlate === plate
  );
};