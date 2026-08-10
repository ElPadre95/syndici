import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enforceTenantScope, TENANT_MODELS, TenantScopeError } from './tenant';

describe('enforceTenantScope — no query can escape its residence', () => {
  it('injects residenceId into where on reads', () => {
    const out = enforceTenantScope('findMany', {}, 'r1');
    expect(out.where).toEqual({ residenceId: 'r1' });
  });

  it('preserves other where filters while injecting the scope', () => {
    const out = enforceTenantScope('findMany', { where: { status: 'LATE' } }, 'r1');
    expect(out.where).toEqual({ status: 'LATE', residenceId: 'r1' });
  });

  it('injects residenceId into data on create', () => {
    const out = enforceTenantScope('create', { data: { reference: 'B3' } }, 'r1');
    expect(out.data).toEqual({ reference: 'B3', residenceId: 'r1' });
  });

  it('injects residenceId into each row of createMany', () => {
    const out = enforceTenantScope(
      'createMany',
      { data: [{ reference: 'B3' }, { reference: 'B4' }] },
      'r1',
    );
    expect(out.data).toEqual([
      { reference: 'B3', residenceId: 'r1' },
      { reference: 'B4', residenceId: 'r1' },
    ]);
  });

  it('scopes upsert where and create payload', () => {
    const out = enforceTenantScope(
      'upsert',
      { where: { id: 'x' }, create: { reference: 'B3' }, update: {} },
      'r1',
    );
    expect(out.where).toMatchObject({ id: 'x', residenceId: 'r1' });
    expect(out.create).toMatchObject({ reference: 'B3', residenceId: 'r1' });
  });

  it('THROWS when a read tries to target another residence', () => {
    expect(() => enforceTenantScope('findMany', { where: { residenceId: 'other' } }, 'r1')).toThrow(
      TenantScopeError,
    );
  });

  it('THROWS when a write tries to target another residence', () => {
    expect(() => enforceTenantScope('create', { data: { residenceId: 'other' } }, 'r1')).toThrow(
      TenantScopeError,
    );
  });

  it('fails closed on an unknown operation', () => {
    expect(() => enforceTenantScope('executeRaw', {}, 'r1')).toThrow(TenantScopeError);
  });
});

describe('tenant model coverage is exhaustive', () => {
  it('TENANT_MODELS lists every schema model that carries residenceId', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    const modelsWithResidenceId = new Set<string>();
    const modelRe = /model\s+(\w+)\s+\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = modelRe.exec(schema)) !== null) {
      const [, name, body] = m;
      // a field declaration named residenceId (not just a substring in a comment)
      if (/^\s*residenceId\s+String/m.test(body!)) modelsWithResidenceId.add(name!);
    }
    // Two-way equality: nothing missing, nothing extra.
    expect([...modelsWithResidenceId].sort()).toEqual([...TENANT_MODELS].sort());
  });
});
