import type {
  MapLinkResolverPort,
  PlacesSearchPort,
  PushTransportPort,
  SchedulerPort,
  TaskQueuePort,
} from './provider-ports.js';

export type ProviderFailureKind =
  'permanent-rejection' | 'throttled' | 'timeout';

export type ScriptedProviderOutcome<Response> =
  | { readonly kind: 'success' | 'partial'; readonly value: Response }
  | { readonly kind: 'malformed'; readonly value: unknown }
  | { readonly kind: ProviderFailureKind };

const RETRYABLE_FAILURES = new Set<ProviderFailureKind>([
  'throttled',
  'timeout',
]);

export class ScriptedProviderFailure extends Error {
  readonly retryable: boolean;

  constructor(readonly kind: ProviderFailureKind) {
    super(`Scripted provider failure: ${kind}.`);
    this.name = 'ScriptedProviderFailure';
    this.retryable = RETRYABLE_FAILURES.has(kind);
  }
}

export class ScriptedProviderFake<Request, Response> {
  private readonly recordedCalls: Readonly<Request>[] = [];
  private outcomes: ScriptedProviderOutcome<Response>[];

  constructor(outcomes: readonly ScriptedProviderOutcome<Response>[]) {
    this.outcomes = [...outcomes];
  }

  get calls(): readonly Readonly<Request>[] {
    return [...this.recordedCalls];
  }

  invoke(request: Readonly<Request>): Promise<Response> {
    this.recordedCalls.push(request);
    const outcome = this.outcomes.shift();
    if (outcome === undefined) {
      return Promise.reject(
        new Error('Scripted provider fake has no remaining outcome.'),
      );
    }

    if (
      outcome.kind === 'success' ||
      outcome.kind === 'partial' ||
      outcome.kind === 'malformed'
    ) {
      return Promise.resolve(outcome.value as Response);
    }

    return Promise.reject(new ScriptedProviderFailure(outcome.kind));
  }

  reset(outcomes: readonly ScriptedProviderOutcome<Response>[] = []): void {
    this.recordedCalls.length = 0;
    this.outcomes = [...outcomes];
  }
}

export interface ScriptedProviderHandle<Port, Request, Response> {
  readonly port: Port;
  readonly script: ScriptedProviderFake<Request, Response>;
}

export function createPlacesSearchFake<Request, Response>(
  outcomes: readonly ScriptedProviderOutcome<Response>[],
): ScriptedProviderHandle<
  PlacesSearchPort<Request, Response>,
  Request,
  Response
> {
  const script = new ScriptedProviderFake<Request, Response>(outcomes);
  return {
    port: { search: (request) => script.invoke(request) },
    script,
  };
}

export function createMapLinkResolverFake<Request, Response>(
  outcomes: readonly ScriptedProviderOutcome<Response>[],
): ScriptedProviderHandle<
  MapLinkResolverPort<Request, Response>,
  Request,
  Response
> {
  const script = new ScriptedProviderFake<Request, Response>(outcomes);
  return {
    port: { resolve: (request) => script.invoke(request) },
    script,
  };
}

export function createPushTransportFake<Request, Response>(
  outcomes: readonly ScriptedProviderOutcome<Response>[],
): ScriptedProviderHandle<
  PushTransportPort<Request, Response>,
  Request,
  Response
> {
  const script = new ScriptedProviderFake<Request, Response>(outcomes);
  return {
    port: { send: (request) => script.invoke(request) },
    script,
  };
}

export function createTaskQueueFake<Request, Response>(
  outcomes: readonly ScriptedProviderOutcome<Response>[],
): ScriptedProviderHandle<TaskQueuePort<Request, Response>, Request, Response> {
  const script = new ScriptedProviderFake<Request, Response>(outcomes);
  return {
    port: { enqueue: (request) => script.invoke(request) },
    script,
  };
}

export function createSchedulerFake<Request, Response>(
  outcomes: readonly ScriptedProviderOutcome<Response>[],
): ScriptedProviderHandle<SchedulerPort<Request, Response>, Request, Response> {
  const script = new ScriptedProviderFake<Request, Response>(outcomes);
  return {
    port: { schedule: (request) => script.invoke(request) },
    script,
  };
}
