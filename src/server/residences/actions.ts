'use server';

/**
 * Actions serveur des résidences (A2). La création valide l'entrée (erreurs par
 * champ), applique l'autorisation dans la couche données, pose la nouvelle
 * résidence comme active (cookie) puis redirige vers la liste. Le changement de
 * résidence active persiste le choix en cookie et revalide le layout.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { routing } from '@/i18n/routing';
import { validateResidenceInput, type CreateResidenceState } from './validation';
import { createResidence, listResidencesForPerson, ResidenceAuthError } from './data';
import { ACTIVE_RESIDENCE_COOKIE } from '@/server/session';

function resolveLocale(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : '';
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

export async function createResidenceAction(
  _prev: CreateResidenceState,
  formData: FormData,
): Promise<CreateResidenceState> {
  const session = await auth();
  const personId = session?.user?.personId;
  if (!personId) return { formError: 'unauthenticated' };

  const locale = resolveLocale(formData.get('locale'));
  const result = validateResidenceInput({
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? ''),
    city: String(formData.get('city') ?? ''),
    type: String(formData.get('type') ?? ''),
    unitsCount: String(formData.get('unitsCount') ?? ''),
    chargeAppt: String(formData.get('chargeAppt') ?? ''),
    chargeVilla: String(formData.get('chargeVilla') ?? ''),
    dueDay: String(formData.get('dueDay') ?? ''),
  });
  if (!result.ok) return { errors: result.errors };

  let newId: string;
  try {
    newId = await createResidence(result.value, personId);
  } catch (e) {
    if (e instanceof ResidenceAuthError) return { formError: 'not_owner_admin' };
    return { formError: 'server' };
  }

  const store = await cookies();
  store.set(ACTIVE_RESIDENCE_COOKIE, newId, { httpOnly: true, sameSite: 'lax', path: '/' });
  revalidatePath('/', 'layout');
  redirect(`/${locale}/residences`);
}

/** Change la résidence active (persistée en cookie), en la bornant aux résidences accessibles. */
export async function setActiveResidenceAction(residenceId: string): Promise<void> {
  const session = await auth();
  const personId = session?.user?.personId;
  if (!personId) return;
  const residences = await listResidencesForPerson(personId);
  if (!residences.some((r) => r.id === residenceId)) return;
  const store = await cookies();
  store.set(ACTIVE_RESIDENCE_COOKIE, residenceId, { httpOnly: true, sameSite: 'lax', path: '/' });
  revalidatePath('/', 'layout');
}

/** Sélectionne une résidence depuis la liste et ouvre le tableau de bord. */
export async function focusResidenceAction(formData: FormData): Promise<void> {
  const residenceId = String(formData.get('residenceId') ?? '');
  const locale = resolveLocale(formData.get('locale'));
  await setActiveResidenceAction(residenceId);
  redirect(`/${locale}`);
}
