export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          role: "admin" | "normal" | "guest";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: "admin" | "normal" | "guest";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: "admin" | "normal" | "guest";
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          user_id: string;
          section: SectionKey;
          level: PermLevel;
        };
        Insert: {
          user_id: string;
          section: SectionKey;
          level?: PermLevel;
        };
        Update: {
          user_id?: string;
          section?: SectionKey;
          level?: PermLevel;
        };
        Relationships: [
          { foreignKeyName: "permissions_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      network_metrics: {
        Row: {
          id: string;
          user_id: string;
          download_speed: number;
          upload_speed: number;
          latency: number;
          packet_loss: number;
          connected_devices: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          download_speed?: number;
          upload_speed?: number;
          latency?: number;
          packet_loss?: number;
          connected_devices?: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          download_speed?: number;
          upload_speed?: number;
          latency?: number;
          packet_loss?: number;
          connected_devices?: number;
          recorded_at?: string;
        };
        Relationships: [
          { foreignKeyName: "network_metrics_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      devices: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          ip: string | null;
          mac: string | null;
          status: string;
          last_seen: string;
          bandwidth: number | null;
          os: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          type?: string;
          ip?: string | null;
          mac?: string | null;
          status?: string;
          last_seen?: string;
          bandwidth?: number | null;
          os?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          ip?: string | null;
          mac?: string | null;
          status?: string;
          last_seen?: string;
          bandwidth?: number | null;
          os?: string | null;
        };
        Relationships: [
          { foreignKeyName: "devices_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      threats: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          source: string | null;
          target: string | null;
          severity: string;
          status: string;
          description: string | null;
          detected_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          source?: string | null;
          target?: string | null;
          severity?: string;
          status?: string;
          description?: string | null;
          detected_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          source?: string | null;
          target?: string | null;
          severity?: string;
          status?: string;
          description?: string | null;
          detected_at?: string;
        };
        Relationships: [
          { foreignKeyName: "threats_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      vulnerability_scans: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          cve: string | null;
          severity: string;
          affected: string | null;
          status: string;
          cvss: number | null;
          description: string | null;
          discovered_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          cve?: string | null;
          severity?: string;
          affected?: string | null;
          status?: string;
          cvss?: number | null;
          description?: string | null;
          discovered_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          cve?: string | null;
          severity?: string;
          affected?: string | null;
          status?: string;
          cvss?: number | null;
          description?: string | null;
          discovered_at?: string;
        };
        Relationships: [
          { foreignKeyName: "vulnerability_scans_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          level: string;
          event: string;
          source: string | null;
          ip: string | null;
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          level?: string;
          event: string;
          source?: string | null;
          ip?: string | null;
          details?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          level?: string;
          event?: string;
          source?: string | null;
          ip?: string | null;
          details?: string | null;
        };
        Relationships: [
          { foreignKeyName: "activity_logs_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      reports: {
        Row: {
          id: string;
          title: string;
          type: "weekly" | "threat" | "vulnerability" | "network" | "custom";
          generated_at: string;
          generated_by: string;
          summary: string | null;
          sections: Json;
          threat_count: number;
          device_count: number;
          open_port_count: number;
          security_score: number;
          previous_security_score: number | null;
          status: "draft" | "sent" | "archived";
          recipients: string[] | null;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          type?: "weekly" | "threat" | "vulnerability" | "network" | "custom";
          generated_at?: string;
          generated_by: string;
          summary?: string | null;
          sections?: Json;
          threat_count?: number;
          device_count?: number;
          open_port_count?: number;
          security_score?: number;
          previous_security_score?: number | null;
          status?: "draft" | "sent" | "archived";
          recipients?: string[] | null;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          type?: "weekly" | "threat" | "vulnerability" | "network" | "custom";
          generated_at?: string;
          generated_by?: string;
          summary?: string | null;
          sections?: Json;
          threat_count?: number;
          device_count?: number;
          open_port_count?: number;
          security_score?: number;
          previous_security_score?: number | null;
          status?: "draft" | "sent" | "archived";
          recipients?: string[] | null;
          sent_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "reports_generated_by_fkey"; columns: ["generated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      email_config: {
        Row: {
          id: string;
          user_id: string;
          notify_threats: boolean;
          notify_vulns: boolean;
          notify_reports: boolean;
          recipient_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notify_threats?: boolean;
          notify_vulns?: boolean;
          notify_reports?: boolean;
          recipient_email?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          notify_threats?: boolean;
          notify_vulns?: boolean;
          notify_reports?: boolean;
          recipient_email?: string | null;
        };
        Relationships: [
          { foreignKeyName: "email_config_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      scheduled_reports: {
        Row: {
          id: string;
          user_id: string;
          frequency: string;
          day_of_week: number;
          hour_utc: number | null;
          send_email: boolean;
          is_active: boolean;
          last_sent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          frequency?: string;
          day_of_week?: number;
          hour_utc?: number | null;
          send_email?: boolean;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          frequency?: string;
          day_of_week?: number;
          hour_utc?: number | null;
          send_email?: boolean;
          is_active?: boolean;
        };
        Relationships: [
          { foreignKeyName: "scheduled_reports_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          theme: string;
          notifications: boolean;
          compact_mode: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: string;
          notifications?: boolean;
          compact_mode?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          theme?: string;
          notifications?: boolean;
          compact_mode?: boolean;
        };
        Relationships: [
          { foreignKeyName: "user_preferences_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          description: string | null;
          type: string;
          read: boolean;
          created_at: string;
          category: string;
          link: string | null;
          dismissed: boolean;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          description?: string | null;
          type?: string;
          read?: boolean;
          category?: string;
          link?: string | null;
          dismissed?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          description?: string | null;
          type?: string;
          read?: boolean;
          category?: string;
          link?: string | null;
          dismissed?: boolean;
        };
        Relationships: [
          { foreignKeyName: "notifications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      scan_results: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          intent: string;
          command: string;
          raw_output: string | null;
          parsed_result: Json;
          device_count: number;
          duration_ms: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          query: string;
          intent: string;
          command: string;
          raw_output?: string | null;
          parsed_result?: Json;
          device_count?: number;
          duration_ms?: number;
          status?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          query?: string;
          intent?: string;
          command?: string;
          raw_output?: string | null;
          parsed_result?: Json;
          device_count?: number;
          duration_ms?: number;
          status?: string;
        };
        Relationships: [
          { foreignKeyName: "scan_results_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: "admin" | "normal" | "guest";
      perm_section: SectionKey;
      perm_level: PermLevel;
      report_type: "weekly" | "threat" | "vulnerability" | "network" | "custom";
      report_status: "draft" | "sent" | "archived";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type SectionKey =
  | "dashboard"
  | "network"
  | "devices"
  | "threats"
  | "vulnerabilities"
  | "logs"
  | "ai_analysis"
  | "reports"
  | "settings";

export type PermLevel = "none" | "view" | "full";
export type UserRole = "admin" | "normal" | "guest";
export type Permissions = Record<SectionKey, PermLevel>;

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ThreatRow = Database["public"]["Tables"]["threats"]["Row"];
export type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
export type NetworkMetricRow = Database["public"]["Tables"]["network_metrics"]["Row"];
export type ActivityLogRow = Database["public"]["Tables"]["activity_logs"]["Row"];
export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type VulnRow = Database["public"]["Tables"]["vulnerability_scans"]["Row"];
export type ScanResultRow = Database["public"]["Tables"]["scan_results"]["Row"];
export type PermissionRow = Database["public"]["Tables"]["permissions"]["Row"];
