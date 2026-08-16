import { eventPayload, getEvents, getRun } from '@/lib/agents/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const run = getRun(params.id);
  if (!run) return new Response('Not found', { status: 404 });

  const url = new URL(request.url);
  const after = Number(url.searchParams.get('after') || '0');
  const encoder = new TextEncoder();
  let lastSeq = after;
  let idle = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: 'hello', run: { id: run.id, status: run.status, phase: run.phase, progress: run.progress } });

      while (idle < 240) {
        if (request.signal.aborted) {
          controller.close();
          return;
        }
        const rows = getEvents(params.id, lastSeq);
        for (const row of rows) {
          send(eventPayload(row));
          lastSeq = row.seq;
          idle = 0;
          if (row.type === 'done') {
            controller.close();
            return;
          }
        }
        const current = getRun(params.id);
        if (current && current.status !== 'running' && lastSeq > 0) {
          send({ type: 'done', message: current.error || 'Analysis complete.', data: { status: current.status } });
          controller.close();
          return;
        }
        await sleep(450);
        idle++;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
