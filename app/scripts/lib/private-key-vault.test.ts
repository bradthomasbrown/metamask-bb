import { webcrypto } from 'node:crypto';
import { it } from '@jest/globals';
import {
  KeyringController,
  KeyringControllerMessenger,
  AccountImportStrategy,
} from '@metamask/keyring-controller';
import { Messenger } from '@metamask/messenger';
import * as encryptor from '@metamask/browser-passworder';

// Public disposable test key. Never use this address for funds.
const privateKey = '1'.padStart(64, '0');
const address = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
const password = 'disposable-test-password';

function createController(vault?: string) {
  const messenger: KeyringControllerMessenger = new Messenger({
    namespace: 'KeyringController',
  });
  return new KeyringController({
    messenger,
    encryptor,
    state: vault ? { vault } : undefined,
  });
}

describe('private-key-only vault', () => {
  beforeAll(async () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
    const key = await webcrypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    Object.defineProperty(globalThis, 'CryptoKey', {
      value: key.constructor,
      configurable: true,
    });
  });

  it('contains exactly the supplied account and no seed-backed keyring', async () => {
    const controller = createController();
    await controller.createNewVaultAndImportPrivateKey(
      password,
      `  0x${privateKey}  `,
    );
    expect(await controller.getAccounts()).toStrictEqual([address]);
    expect(controller.state.keyrings).toHaveLength(1);
    expect(controller.state.keyrings[0].type).toBe('Simple Key Pair');
    expect(controller.state.vault).not.toContain(privateKey);
    const serialized = await encryptor.decrypt(
      password,
      controller.state.vault ?? '',
    );
    expect(serialized).toEqual([
      expect.objectContaining({ type: 'Simple Key Pair', data: [privateKey] }),
    ]);
  });

  it('unlocks from persisted storage and signs with the existing key', async () => {
    const controller = createController();
    await controller.createNewVaultAndImportPrivateKey(password, privateKey);
    const reopened = createController(controller.state.vault);
    await expect(reopened.submitPassword('wrong-password')).rejects.toThrow();
    expect(reopened.state.isUnlocked).toBe(false);
    await reopened.submitPassword(password);
    expect(await reopened.getAccounts()).toStrictEqual([address]);
    const signature = await reopened.signPersonalMessage({
      from: address,
      data: '0x68656c6c6f',
    });
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/u);
    await reopened.setLocked();
    await expect(
      reopened.signPersonalMessage({ from: address, data: '0x68656c6c6f' }),
    ).rejects.toThrow();
    await reopened.submitPassword(password);
    expect(await reopened.getAccounts()).toStrictEqual([address]);
  });

  it('keeps the same key through password changes and additional imports', async () => {
    const controller = createController();
    await controller.createNewVaultAndImportPrivateKey(password, privateKey);
    await controller.changePassword('new-disposable-password');
    await controller.importAccountWithStrategy(
      AccountImportStrategy.privateKey,
      ['2'.padStart(64, '0')],
    );
    const reopened = createController(controller.state.vault);
    await expect(reopened.submitPassword(password)).rejects.toThrow();
    await reopened.submitPassword('new-disposable-password');
    expect(await reopened.getAccounts()).toHaveLength(2);
    expect(await reopened.getAccounts()).toContain(address);
    expect(
      reopened.state.keyrings.every(
        (keyring) => keyring.type === 'Simple Key Pair',
      ),
    ).toBe(true);
  });

  it('protects the primary private-key account in both removal APIs', async () => {
    const controller = createController();
    await controller.createNewVaultAndImportPrivateKey(password, privateKey);
    await expect(controller.removeAccount(address)).rejects.toThrow();
    const { id } = controller.state.keyrings[0].metadata;
    await expect(
      controller.withController(async (view) => view.removeKeyring(id)),
    ).rejects.toThrow();
    expect(await controller.getAccounts()).toStrictEqual([address]);
  });

  it.each([
    '',
    '0'.repeat(64),
    'f'.repeat(64),
    'g'.repeat(64),
    '1'.repeat(63),
    '1'.repeat(66),
  ])(
    'rejects malformed or out-of-range key %# without creating a vault',
    async (key) => {
      const controller = createController();
      await expect(
        controller.createNewVaultAndImportPrivateKey(password, key),
      ).rejects.toThrow();
      expect(controller.state.vault).toBeUndefined();
      expect(controller.state.keyrings).toStrictEqual([]);
      expect(controller.state.isUnlocked).toBe(false);
    },
  );

  it('rejects an empty password without creating a vault', async () => {
    const controller = createController();
    await expect(
      controller.createNewVaultAndImportPrivateKey('', privateKey),
    ).rejects.toThrow();
    expect(controller.state.vault).toBeUndefined();
  });

  it('cannot replace an existing vault, including when locked', async () => {
    const controller = createController();
    await controller.createNewVaultAndImportPrivateKey(password, privateKey);
    const { vault } = controller.state;
    await controller.setLocked();
    await expect(
      controller.createNewVaultAndImportPrivateKey(
        'replacement-password',
        '2'.padStart(64, '0'),
      ),
    ).rejects.toThrow();
    expect(controller.state.vault).toBe(vault);
    await controller.submitPassword(password);
    expect(await controller.getAccounts()).toStrictEqual([address]);
  });

  it('serializes concurrent initialization attempts without replacing the winner', async () => {
    const controller = createController();
    const results = await Promise.allSettled([
      controller.createNewVaultAndImportPrivateKey(password, privateKey),
      controller.createNewVaultAndImportPrivateKey(
        'other-password',
        '2'.padStart(64, '0'),
      ),
    ]);
    expect(results.map((result) => result.status)).toStrictEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(await controller.getAccounts()).toStrictEqual([address]);
  });
});
