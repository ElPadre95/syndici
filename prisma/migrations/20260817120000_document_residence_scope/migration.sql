-- F3 : nouvelle portée « visible de toute la résidence ». Isolée dans sa propre
-- migration (comme l'ajout de CHEQUE) : ajouter une valeur d'enum ne peut pas être
-- consommé dans la même transaction que son usage.
ALTER TYPE "DocumentScope" ADD VALUE IF NOT EXISTS 'RESIDENCE';
