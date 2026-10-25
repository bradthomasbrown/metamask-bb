import { it } from '@jest/globals';
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import initializedMockState from '../../../../test/data/mock-state.json';
import { renderWithProvider } from '../../../../test/lib/render-helpers-navigate';
import * as Actions from '../../../store/actions';
import { ONBOARDING_METAMETRICS } from '../../../helpers/constants/routes';
import ImportPrivateKey from './import-private-key';

const mockNavigate = jest.fn();
const mockReset = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('../hooks/useOnboardingReset', () => ({
  useOnboardingReset: () => mockReset,
}));
jest.mock('../../create-password-form', () => ({
  CreatePasswordForm: ({
    onSubmit,
    onBack,
    error,
    isPrivateKeyImport,
  }: {
    onSubmit: (password: string) => Promise<void>;
    onBack: () => void;
    error: boolean;
    isPrivateKeyImport: boolean;
  }) => (
    <div>
      <span>{isPrivateKeyImport ? 'Private key backup' : 'Seed backup'}</span>
      <button onClick={() => onSubmit('disposable-password')}>
        Submit password
      </button>
      <button onClick={onBack}>Back to key</button>
      {error && <span role="alert">Setup failed</span>}
    </div>
  ),
}));

const privateKey = '1'.padStart(64, '0');

function renderPage() {
  const store = configureMockStore([thunk])({
    ...initializedMockState,
    metamask: {
      ...initializedMockState.metamask,
      isInitialized: false,
      isUnlocked: false,
      participateInMetaMetrics: null,
      consentDecisionMade: false,
    },
  });
  return { ...renderWithProvider(<ImportPrivateKey />, store), store };
}

describe('ImportPrivateKey', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('masks the key and explains that no seed or extra account is generated', () => {
    const { getByTestId, getByText } = renderPage();
    expect(getByTestId('onboarding-private-key')).toHaveAttribute(
      'type',
      'password',
    );
    expect(getByTestId('onboarding-private-key')).toHaveAttribute(
      'autocomplete',
      'off',
    );
    expect(
      getByText(/No Secret Recovery Phrase or additional account/iu),
    ).toBeInTheDocument();
  });

  it.each(['0'.repeat(64), 'f'.repeat(64), 'abc', 'g'.repeat(64)])(
    'rejects invalid key %# before password setup',
    (key) => {
      const { getByTestId, getByText, queryByText } = renderPage();
      fireEvent.change(getByTestId('onboarding-private-key'), {
        target: { value: key },
      });
      fireEvent.click(getByText('Continue'));
      expect(getByText(/Enter a valid 32-byte/iu)).toBeInTheDocument();
      expect(queryByText('Submit password')).not.toBeInTheDocument();
    },
  );

  it('submits the supplied key directly to the background action without Redux payloads', async () => {
    const importKey = jest
      .spyOn(Actions, 'createNewVaultAndImportPrivateKey')
      .mockImplementation(() => async () => undefined);
    const { getByTestId, getByText, store } = renderPage();
    fireEvent.change(getByTestId('onboarding-private-key'), {
      target: { value: `  0x${privateKey}  ` },
    });
    fireEvent.click(getByText('Continue'));
    expect(getByText('Private key backup')).toBeInTheDocument();
    fireEvent.click(getByText('Submit password'));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(ONBOARDING_METAMETRICS, {
        replace: true,
      }),
    );
    expect(importKey).toHaveBeenCalledWith('disposable-password', privateKey);
    expect(JSON.stringify(store.getActions())).not.toContain(privateKey);
  });

  it('stays on the password step after failure and permits a retry', async () => {
    const importKey = jest
      .spyOn(Actions, 'createNewVaultAndImportPrivateKey')
      .mockImplementation(() => async () => {
        throw new Error('failure');
      });
    const { getByTestId, getByText, findByRole } = renderPage();
    fireEvent.change(getByTestId('onboarding-private-key'), {
      target: { value: privateKey },
    });
    fireEvent.click(getByText('Continue'));
    fireEvent.click(getByText('Submit password'));
    expect(await findByRole('alert')).toHaveTextContent('Setup failed');
    expect(mockNavigate).not.toHaveBeenCalled();
    importKey.mockImplementation(() => async () => undefined);
    fireEvent.click(getByText('Submit password'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });
});
