import React from 'react';
import { useSelector } from 'react-redux';
import { Text } from '@metamask/design-system-react';
import { getMetaMaskHdKeyrings } from '../../../selectors';
import { useI18nContext } from '../../../hooks/useI18nContext';
import { RevealSrpList } from '../../../components/app/reveal-srp-list';

const ManageWalletRecoverySubPage = () => {
  const t = useI18nContext();
  const hdKeyrings = useSelector(getMetaMaskHdKeyrings);
  if (hdKeyrings.length === 0) {
    return <Text>{t('privateKeyOnlyRecovery')}</Text>;
  }
  return <RevealSrpList />;
};

export default ManageWalletRecoverySubPage;
