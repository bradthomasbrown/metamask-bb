import {
  getDefaultNetworkControllerState,
  knownKeysOf,
  RpcEndpointType,
  type NetworkState,
} from '@metamask/network-controller';

/** Account-free defaults for the experimental fork. See README for providers. */
export const PUBLIC_RPC_URLS: Record<string, string> = {
  '0x1': 'https://ethereum-rpc.publicnode.com',
  '0xaa36a7': 'https://ethereum-sepolia-rpc.publicnode.com',
  '0xe705': 'https://rpc.sepolia.linea.build',
  '0xe708': 'https://rpc.linea.build',
  '0x2105': 'https://base-rpc.publicnode.com',
  '0xa4b1': 'https://arbitrum-one-rpc.publicnode.com',
  '0x38': 'https://bsc-rpc.publicnode.com',
  '0xa': 'https://optimism-rpc.publicnode.com',
  '0x89': 'https://polygon-bor-rpc.publicnode.com',
  '0x8f': 'https://rpc.monad.xyz',
};

/**
 * Replace built-in Infura endpoints only when the build has the dummy ID.
 * Keep client IDs stable so network selection and dapp permissions survive an
 * upgrade. Custom endpoints, including user-entered Infura URLs, are untouched.
 *
 * @param state - Persisted network state, or undefined on first launch.
 * @param infuraProjectId - The build's configured Infura project ID.
 * @returns Network state suitable for constructing the controller.
 */
export function getPublicRpcNetworkState(
  state: Partial<NetworkState> | undefined,
  infuraProjectId: string,
): Partial<NetworkState> | undefined {
  if (!/^0+$/u.test(infuraProjectId)) {
    return state;
  }

  const defaults = getDefaultNetworkControllerState();
  const configurations =
    state?.networkConfigurationsByChainId ??
    defaults.networkConfigurationsByChainId;
  const networksMetadata = { ...state?.networksMetadata };
  return {
    ...defaults,
    ...state,
    networksMetadata,
    networkConfigurationsByChainId: Object.fromEntries(
      knownKeysOf(configurations).map((chainId) => [
        chainId,
        {
          ...configurations[chainId],
          rpcEndpoints: configurations[chainId].rpcEndpoints.map((endpoint) => {
            const url = PUBLIC_RPC_URLS[chainId];
            const defaultEndpoint =
              defaults.networkConfigurationsByChainId[chainId]?.rpcEndpoints[0];
            if (
              url &&
              endpoint.type === RpcEndpointType.Infura &&
              endpoint.url === defaultEndpoint?.url
            ) {
              delete networksMetadata[endpoint.networkClientId];
              return {
                ...endpoint,
                type: RpcEndpointType.Custom,
                url,
                name: new URL(url).hostname,
                failoverUrls: [],
              };
            }
            return endpoint;
          }),
        },
      ]),
    ),
  };
}
