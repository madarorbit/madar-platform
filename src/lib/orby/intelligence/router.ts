import type { OrbyKernelRequest, OrbyModelDescriptor, OrbyProviderCapability, OrbyRuntimeConfiguration } from "../core/contracts";

type ModelCatalog = { list(filter?: { enabledOnly?: boolean; providerId?: string }): OrbyModelDescriptor[] };

export class OrbyIntelligenceRouter {
  constructor(private readonly models: ModelCatalog) {}
  decide(input: { request: OrbyKernelRequest; configuration: OrbyRuntimeConfiguration; requiredCapabilities?: readonly OrbyProviderCapability[] }) {
    return { preferredModelId: input.request.preferredModelId || input.configuration.defaultModelId };
  }
}
