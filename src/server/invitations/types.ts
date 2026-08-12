/** Résultat de l'émission d'une invitation (partagé action serveur ↔ UI client). */
export type EmitResult =
  | {
      ok: true;
      code: string;
      expiresAt: string;
      waHref: string;
      message: string;
      lotReference: string;
    }
  | {
      ok: false;
      reason: 'forbidden' | 'no_active_residence' | 'no_active_attachment' | 'not_found';
    };
