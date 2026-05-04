// src/types/index.ts
// All app-level types used across the project

export type UserRole = 'operator' | 'admin'

export type MatchType = 
  | 'auto_entry'    // no trucks waiting — must be new entry
  | 'auto_return'   // plate found in waiting with high confidence
  | 'fuzzy_return'  // plate possibly matches — operator selects
  | 'unknown'       // ambiguous — operator decides

export type PendingStatus = 'pending' | 'confirmed' | 'dismissed'
export type WeighingStatus = 'waiting' | 'complete' | 'flagged' | 'incomplete'
export type TokenStatus = 'available' | 'active'

// ── Pending confirmation from Supabase ─────────────────────────
export interface PendingConfirmation {
  id:                    string
  type:                  string
  status:                PendingStatus
  plate_ocr:             string | null
  token_id:              string | null
  token_number:          string | null
  plate_conf:            number | null
  plate_reliable:        boolean | null
  weight_ocr:            string | null
  weight_conf:           number | null
  weight_reliable:       boolean | null
  weight_stable:         boolean | null
  needs_operator:        boolean
  outdoor_snapshot_url:  string | null
  indoor_snapshot_url:   string | null
  match_type:            MatchType | null
  matched_weighing_id:   string | null
  matched_plate:         string | null
  matched_loaded_weight: number | null
  waiting_list:          WaitingEntry[] | null
  triggered_at:          string
  created_at:            string
}

// ── Waiting entry (truck on site) ──────────────────────────────
export interface WaitingEntry {
  id : string
  weighing_id:   string
  token_number:  string
  plate_number:  string
  loaded_weight: number
  entry_at:      string
}

// ── Weighing record ────────────────────────────────────────────
export interface Weighing {
  id:                      string
  token_number:            string
  plate_number:            string | null
  plate_ocr_raw:           string | null
  plate_ocr_confidence:    number | null
  plate_edited_by_operator: boolean
  loaded_weight:           number | null
  empty_weight:            number | null
  net_load:                number | null
  loaded_weight_edited:    boolean
  empty_weight_edited:     boolean
  entry_snapshot_url:      string | null
  return_snapshot_url:     string | null
  status:                  WeighingStatus
  flag_reason:             string | null
  entry_at:                string
  return_at:               string | null
}

// ── Confirm entry payload ──────────────────────────────────────
export interface ConfirmEntryPayload {
  p_pending_id:       string
  p_plate:            string
  p_weight_kg:        number
  p_plate_edited:     boolean
  p_weight_edited:    boolean
  p_plate_ocr_raw:    string
  p_plate_ocr_conf:   number
  p_weight_ocr_raw:   string
  p_weight_ocr_conf:  number
  p_operator_id:      string | null
  p_outdoor_snapshot: string | null
  p_indoor_snapshot:  string | null
}

// ── Confirm return payload ─────────────────────────────────────
export interface ConfirmReturnPayload {
  p_pending_id:          string
  p_weighing_id:         string
  p_empty_weight_kg:     number
  p_weight_edited:       boolean
  p_operator_id:         string | null
  p_ocr_plate_back:      string
  p_ocr_plate_back_conf: number
  p_match_method:        string
  p_weight_ocr_raw:      string
  p_weight_ocr_conf:     number
  p_return_snapshot:     string | null
  p_indoor_snapshot:     string | null
}

// ── RPC function response ──────────────────────────────────────
export interface RpcResult {
  success:      boolean
  error?:       string
  weighing_id?: string
  token_number?: string
  plate?:       string
  weight_kg?:   number
  loaded_kg?:   number
  empty_kg?:    number
  net_load_kg?: number
  message?:     string
}

// ── Daily summary view ─────────────────────────────────────────
export interface DailySummary {
  date:              string
  total_vehicles:    number
  completed:         number
  waiting:           number
  incomplete:        number
  flagged:           number
  avg_net_load_kg:   number | null
  total_net_load_kg: number | null
}