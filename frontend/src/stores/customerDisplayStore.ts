import { create } from "zustand";

function detectWebSerial(): boolean {
  return typeof navigator !== "undefined" && !!navigator.serial;
}

interface CustomerDisplayState {
  webSerialSupported: boolean;
  serialConnected: boolean;
  setSerialConnected: (v: boolean) => void;
}

export const useCustomerDisplayStore = create<CustomerDisplayState>((set) => ({
  webSerialSupported: detectWebSerial(),
  serialConnected: false,
  setSerialConnected: (v) => set({ serialConnected: v }),
}));
