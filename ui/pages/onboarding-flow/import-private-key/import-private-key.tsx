import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  BoxFlexDirection,
  Button,
  ButtonVariant,
  Text,
  TextVariant,
} from '@metamask/design-system-react';
import {
  FormTextField,
  TextFieldType,
} from '../../../components/component-library';
import { useI18nContext } from '../../../hooks/useI18nContext';
import { useDispatch } from '../../../store/hooks';
import { createNewVaultAndImportPrivateKey } from '../../../store/actions';
import { getIsInitialized } from '../../../ducks/metamask/metamask';
import { getIsUnlocked } from '../../../ducks/metamask/base-selectors';
import { getConsentDecisionMade } from '../../../selectors';
import {
  ONBOARDING_COMPLETION_ROUTE,
  ONBOARDING_METAMETRICS,
  ONBOARDING_UNLOCK_ROUTE,
} from '../../../helpers/constants/routes';
// eslint-disable-next-line import-x/no-restricted-paths -- shared onboarding form
import { CreatePasswordForm } from '../../create-password-form';
import { useOnboardingReset } from '../hooks/useOnboardingReset';

/** Initial setup from a single existing EVM key; secrets stay in component memory. */
export default function ImportPrivateKey() {
  const t = useI18nContext();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const resetOnboarding = useOnboardingReset();
  const initialized = useSelector(getIsInitialized);
  const unlocked = useSelector(getIsUnlocked);
  const consentDecisionMade = useSelector(getConsentDecisionMade);
  const [privateKey, setPrivateKey] = useState('');
  const [passwordStep, setPasswordStep] = useState(false);
  const [invalidKey, setInvalidKey] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const nextRoute = consentDecisionMade
    ? ONBOARDING_COMPLETION_ROUTE
    : ONBOARDING_METAMETRICS;

  useEffect(() => {
    if (initialized && !loading) {
      navigate(unlocked ? nextRoute : ONBOARDING_UNLOCK_ROUTE, {
        replace: true,
      });
    }
  }, [initialized, unlocked, loading, navigate, nextRoute]);

  const onContinue = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = privateKey.trim().replace(/^0x/iu, '');
    // secp256k1 keys are integers in [1, n - 1]. The background validates again.
    const scalar = /^[0-9a-f]{64}$/iu.test(normalized)
      ? BigInt(`0x${normalized}`)
      : 0n;
    const curveOrder =
      0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
    if (scalar === 0n || scalar >= curveOrder) {
      setInvalidKey(true);
      return;
    }
    setPrivateKey(normalized);
    setInvalidKey(false);
    setPasswordStep(true);
  };

  const onSubmit = async (password: string) => {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setLoading(true);
    setError(false);
    try {
      await dispatch(createNewVaultAndImportPrivateKey(password, privateKey));
      setPrivateKey('');
      navigate(nextRoute, { replace: true });
    } catch {
      // Never log errors that might originate from secret-bearing input.
      setError(true);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (passwordStep) {
    return (
      <CreatePasswordForm
        isSocialLoginFlow={false}
        isPrivateKeyImport
        onSubmit={onSubmit}
        onBack={() => {
          setPasswordStep(false);
          setError(false);
        }}
        error={error}
        loading={loading}
      />
    );
  }

  return (
    <Box
      asChild
      flexDirection={BoxFlexDirection.Column}
      gap={4}
      className="w-full"
    >
      <form onSubmit={onContinue}>
        <Text variant={TextVariant.HeadingLg}>
          {t('onboardingPrivateKeyImport')}
        </Text>
        <Text>{t('privateKeySetupDetails')}</Text>
        <FormTextField
          id="onboarding-private-key"
          label={t('privateKey')}
          value={privateKey}
          type={TextFieldType.Password}
          autoComplete={false}
          error={invalidKey}
          helpText={invalidKey ? t('privateKeyInvalid') : undefined}
          onChange={(event) => {
            setPrivateKey(event.target.value);
            setInvalidKey(false);
          }}
          inputProps={{
            spellCheck: false,
            'data-testid': 'onboarding-private-key',
          }}
        />
        <Text>{t('privateKeyBackupWarning')}</Text>
        <Button
          type="submit"
          variant={ButtonVariant.Primary}
          disabled={!privateKey.trim()}
        >
          {t('continue')}
        </Button>
        <Button
          type="button"
          variant={ButtonVariant.Tertiary}
          onClick={resetOnboarding}
        >
          {t('back')}
        </Button>
      </form>
    </Box>
  );
}
