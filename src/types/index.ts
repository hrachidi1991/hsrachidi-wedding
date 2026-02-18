export interface TimelineItem {
  id: string;
  time: string;
  labelEn: string;
  labelAr: string;
  sortOrder: number;
}

export interface Guest {
  id: string;
  firstName: string;
  familyName: string;
  phone?: string | null;
  side: 'bride' | 'groom';
  relation: string;
  groupCode: string;
}

export interface GuestGroup {
  id: string;
  groupCode: string;
  maxGuests: number;
  token: string;
  side: string;
  rsvpResponse?: RsvpResponse | null;
}

export interface RsvpResponse {
  id: string;
  groupId: string;
  attending: boolean;
  numberAttending: number;
  guestNames: string[];
  language: string;
  submittedAt: string;
  updatedAt: string;
}

export interface RsvpSubmitData {
  token: string;
  attending: boolean;
  numberAttending: number;
  guestNames: string[];
  language: string;
}
