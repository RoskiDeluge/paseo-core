import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Paseo worker', () => {
        it('creates a pod and responds to status', async () => {
                const createReq = new IncomingRequest('http://example.com/pods', { method: 'POST' });
                const ctx = createExecutionContext();
                const createRes = await worker.fetch(createReq, env, ctx);
                await waitOnExecutionContext(ctx);
                const body = await createRes.json<{ podName: string }>();
                expect(body.podName).toMatch(/[0-9a-f-]{36}/);

                const statusReq = new IncomingRequest(`http://example.com/pods/${body.podName}`);
                const ctx2 = createExecutionContext();
                const statusRes = await worker.fetch(statusReq, env, ctx2);
                await waitOnExecutionContext(ctx2);
                expect(await statusRes.text()).toBe('PaseoPod is alive.');
        });
});
