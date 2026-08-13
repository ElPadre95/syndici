/** Résultats des actions de campagne (partagés action serveur ↔ UI). */
import type { CampaignPreview, CampaignGenResult } from './campaigns';

export type CampaignActionError =
  'forbidden' | 'no_active_residence' | 'invalid_period' | 'not_found';

export type PreviewCampaignResult =
  { ok: true; preview: CampaignPreview } | { ok: false; error: CampaignActionError };

export type GenerateCampaignResult =
  { ok: true; result: CampaignGenResult } | { ok: false; error: CampaignActionError };
