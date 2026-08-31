import {
  createMapLinkResolverFake,
  createPlacesSearchFake,
  createPushTransportFake,
  createSchedulerFake,
  createTaskQueueFake,
  ScriptedProviderFailure,
  ScriptedProviderFake,
  type ScriptedProviderOutcome,
} from './index.js';

interface SyntheticRequest {
  readonly fixture: string;
}

interface SyntheticResponse {
  readonly accepted: boolean;
}

const request: SyntheticRequest = { fixture: 'synthetic-request' };
const success: SyntheticResponse = { accepted: true };

describe('ScriptedProviderFake', () => {
  test('returns successful, partial, and malformed values in order', async () => {
    const partial = { accepted: false };
    const malformed = { unexpected: true };
    const fake = new ScriptedProviderFake<SyntheticRequest, SyntheticResponse>([
      { kind: 'success', value: success },
      { kind: 'partial', value: partial },
      { kind: 'malformed', value: malformed },
    ]);

    await expect(fake.invoke(request)).resolves.toBe(success);
    await expect(fake.invoke(request)).resolves.toBe(partial);
    await expect(fake.invoke(request)).resolves.toBe(malformed);
  });

  test.each([
    ['timeout', true],
    ['throttled', true],
    ['permanent-rejection', false],
  ] as const)(
    'returns sanitized %s failure metadata',
    async (kind, retryable) => {
      const fake = new ScriptedProviderFake<
        SyntheticRequest,
        SyntheticResponse
      >([{ kind }]);

      await expect(
        fake.invoke({ fixture: 'not-for-error-output' }),
      ).rejects.toEqual(
        expect.objectContaining<Partial<ScriptedProviderFailure>>({
          kind,
          retryable,
          message: `Scripted provider failure: ${kind}.`,
        }),
      );
    },
  );

  test('does not retry automatically after a transient failure', async () => {
    const fake = new ScriptedProviderFake<SyntheticRequest, SyntheticResponse>([
      { kind: 'timeout' },
      { kind: 'success', value: success },
    ]);

    await expect(fake.invoke(request)).rejects.toBeInstanceOf(
      ScriptedProviderFailure,
    );
    expect(fake.calls).toHaveLength(1);
    await expect(fake.invoke(request)).resolves.toBe(success);
  });

  test('records duplicate and concurrent invocations deterministically', async () => {
    const outcomes: ScriptedProviderOutcome<SyntheticResponse>[] = [
      { kind: 'success', value: success },
      { kind: 'success', value: success },
      { kind: 'success', value: success },
    ];
    const fake = new ScriptedProviderFake<SyntheticRequest, SyntheticResponse>(
      outcomes,
    );

    await Promise.all([
      fake.invoke(request),
      fake.invoke(request),
      fake.invoke(request),
    ]);

    expect(fake.calls).toEqual([request, request, request]);
  });

  test('reset clears calls and replaces remaining outcomes', async () => {
    const fake = new ScriptedProviderFake<SyntheticRequest, SyntheticResponse>([
      { kind: 'timeout' },
    ]);
    await expect(fake.invoke(request)).rejects.toBeInstanceOf(
      ScriptedProviderFailure,
    );

    fake.reset([{ kind: 'success', value: success }]);

    expect(fake.calls).toEqual([]);
    await expect(fake.invoke(request)).resolves.toBe(success);
  });

  test('fails clearly when its deterministic script is exhausted', async () => {
    const fake = new ScriptedProviderFake<SyntheticRequest, SyntheticResponse>(
      [],
    );

    await expect(fake.invoke(request)).rejects.toThrow(
      'Scripted provider fake has no remaining outcome.',
    );
  });
});

describe('application-owned provider fake factories', () => {
  test('provide every approved local provider boundary without network access', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network access is prohibited'));
    const outcome = [{ kind: 'success', value: success }] as const;
    const cases = [
      {
        invoke: () => createPlacesSearchFake(outcome).port.search(request),
      },
      {
        invoke: () => createMapLinkResolverFake(outcome).port.resolve(request),
      },
      {
        invoke: () => createPushTransportFake(outcome).port.send(request),
      },
      {
        invoke: () => createTaskQueueFake(outcome).port.enqueue(request),
      },
      {
        invoke: () => createSchedulerFake(outcome).port.schedule(request),
      },
    ];

    for (const providerCase of cases) {
      await expect(providerCase.invoke()).resolves.toBe(success);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
