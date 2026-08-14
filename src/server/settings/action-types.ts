import type { ResidenceEditField, ReminderRuleField } from './validation';

export type SettingsFormError = 'forbidden' | 'no_active_residence' | 'not_found';

export type ResidenceSettingsResult =
  | { ok: true }
  | {
      ok: false;
      formError?: SettingsFormError;
      errors?: Partial<Record<ResidenceEditField, string>>;
    };

export type ReminderRuleSettingsResult =
  | { ok: true }
  | {
      ok: false;
      formError?: SettingsFormError;
      errors?: Partial<Record<ReminderRuleField, string>>;
    };

export type CategoryActionResult =
  { ok: true } | { ok: false; error: SettingsFormError | 'label_required' | 'duplicate' };
