import { FirstTimeFlowType } from '../../shared/constants/onboarding';
import {
  ONBOARDING_COMPLETION_ROUTE,
  ONBOARDING_METAMETRICS,
} from '../helpers/constants/routes';
import {
  getFirstTimeFlowTypeRouteAfterUnlock,
  getFirstTimeFlowTypeRouteAfterMetaMetricsOptIn,
} from './first-time-flow';

describe('private-key onboarding routes', () => {
  const state = {
    metamask: { firstTimeFlowType: FirstTimeFlowType.PrivateKeyImport },
  };

  it('resumes unfinished setup without asking for a recovery phrase', () => {
    expect(getFirstTimeFlowTypeRouteAfterUnlock(state)).toBe(
      ONBOARDING_METAMETRICS,
    );
  });

  it('completes setup after the metrics decision without creating a seed', () => {
    expect(getFirstTimeFlowTypeRouteAfterMetaMetricsOptIn(state)).toBe(
      ONBOARDING_COMPLETION_ROUTE,
    );
  });
});
