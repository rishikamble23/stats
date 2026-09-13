import "server-only";
import type { ProviderId } from "../metrics/types";
import type { ServerProvider } from "./base";
import { github } from "./github";
import { lemonsqueezy } from "./lemonsqueezy";
import { manual } from "./manual";
import { npm } from "./npm";
import { plausible } from "./plausible";
import { posthog } from "./posthog";
import { pypi } from "./pypi";
import { stripe } from "./stripe";

const registry: Partial<Record<ProviderId, ServerProvider>> = {
  github,
  stripe,
  posthog,
  plausible,
  npm,
  pypi,
  lemonsqueezy,
  manual,
};

export function getServerProvider(id: string): ServerProvider | undefined {
  return registry[id as ProviderId];
}

export { ProviderError, isProviderError } from "./base";
export type { ConnectionContext, MetricRequest } from "./base";
