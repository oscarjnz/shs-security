import { useState, useCallback } from "react";
import { supabase, AGENT_URL } from "@/lib/supabase";

export interface ScanMessage {
  role: "user" | "assistant";
  content: string;
  scanResult?: ScanResultData | null;
  timestamp: Date;
}

export interface ScanResultData {
  intent: string;
  command: string;
  devices: ScanDevice[];
  summary: string;
  duration_ms: number;
}

export interface ScanDevice {
  ip: string;
  mac?: string;
  hostname?: string;
  status: string;
  os?: string;
  ports?: { port: number; service: string; state: string }[];
}

export function useScanChat() {
  const [messages, setMessages] = useState<ScanMessage[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ScanMessage = { role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsScanning(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No autenticado");

      const res = await fetch(`${AGENT_URL}/api/scan/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error de conexión con el agente" }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const json = await res.json();
      const assistantMsg: ScanMessage = {
        role: "assistant",
        content: json.data?.summary ?? json.data?.message ?? "Escaneo completado.",
        scanResult: json.data?.scanResult ?? null,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ScanMessage = {
        role: "assistant",
        content: err instanceof Error ? err.message : "Error inesperado al escanear.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isScanning, sendMessage, clearMessages };
}
