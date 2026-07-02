// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôt bibliothèque factice partagé par les tests de commandes (écritures immédiates M5).
import { vi } from 'vitest';
import type { SampleRepository, TagRepository } from '../../src/storage/types';

export function fakeSampleRepository() {
  return {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    readBytes: vi.fn().mockResolvedValue(new Uint8Array()),
  } satisfies SampleRepository;
}

/** Dépôt de tags factice partagé (M8). */
export function fakeTagRepository() {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    assignments: vi.fn().mockResolvedValue(new Map()),
    assign: vi.fn().mockResolvedValue(undefined),
    unassign: vi.fn().mockResolvedValue(undefined),
  } satisfies TagRepository;
}
