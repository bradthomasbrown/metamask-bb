import {
  getDefaultNetworkControllerState,
  RpcEndpointType,
} from '@metamask/network-controller';
import { getPublicRpcNetworkState, PUBLIC_RPC_URLS } from './public-rpc';

describe('public RPC defaults', () => {
  it('replaces every default Infura endpoint and keeps the selected client valid', () => {
    const state = getPublicRpcNetworkState(undefined, '00000000000');
    const endpoints = Object.values(
      state?.networkConfigurationsByChainId ?? {},
    ).flatMap((network) => network.rpcEndpoints);
    expect(endpoints.every(({ type }) => type === RpcEndpointType.Custom)).toBe(
      true,
    );
    expect(
      endpoints.find(
        ({ networkClientId }) =>
          networkClientId === state?.selectedNetworkClientId,
      )?.url,
    ).toBe(PUBLIC_RPC_URLS['0x1']);
    expect(Object.keys(PUBLIC_RPC_URLS)).toHaveLength(10);
  });

  it('upgrades existing defaults without changing selection, IDs, or custom RPCs', () => {
    const original = getDefaultNetworkControllerState();
    original.selectedNetworkClientId = 'my-provider';
    original.networkConfigurationsByChainId['0x1'].rpcEndpoints.push({
      type: RpcEndpointType.Custom,
      networkClientId: 'my-provider',
      url: 'https://my-provider.example/rpc',
    });
    original.networkConfigurationsByChainId['0x1'].defaultRpcEndpointIndex = 1;
    const snapshot = JSON.stringify(original);
    const state = getPublicRpcNetworkState(original, '00000000000');
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(state?.selectedNetworkClientId).toBe('my-provider');
    const ethereum = state?.networkConfigurationsByChainId?.['0x1'];
    expect(ethereum?.defaultRpcEndpointIndex).toBe(1);
    expect(ethereum?.rpcEndpoints[0]).toMatchObject({
      networkClientId: 'mainnet',
      type: RpcEndpointType.Custom,
      url: PUBLIC_RPC_URLS['0x1'],
    });
    expect(ethereum?.rpcEndpoints[1]).toEqual(
      original.networkConfigurationsByChainId['0x1'].rpcEndpoints[1],
    );
    expect(getPublicRpcNetworkState(state, '00000000000')).toEqual(state);
  });

  it('leaves user-entered Infura URLs alone', () => {
    const original = getDefaultNetworkControllerState();
    original.networkConfigurationsByChainId['0x1'].rpcEndpoints[0] = {
      type: RpcEndpointType.Custom,
      networkClientId: 'my-infura',
      url: 'https://mainnet.infura.io/v3/my-key',
    };
    expect(
      getPublicRpcNetworkState(original, '00000000000')
        ?.networkConfigurationsByChainId?.['0x1'],
    ).toEqual(original.networkConfigurationsByChainId['0x1']);
  });

  it('preserves the normal Infura configuration for builds with a real ID', () => {
    const original = getDefaultNetworkControllerState();
    expect(getPublicRpcNetworkState(original, 'configured-project')).toBe(
      original,
    );
    expect(
      getPublicRpcNetworkState(undefined, 'configured-project'),
    ).toBeUndefined();
  });
});
