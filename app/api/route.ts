import { AssistantResponse } from 'ai';
import OpenAI from 'openai';

// Create an OpenAI API client (that's edge friendly!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Parse the request body
  const input: {
    threadId: string | null;
    message: string;
  } = await req.json();

  // Create a thread if needed
  const threadId = input.threadId ?? (await openai.beta.threads.create({})).id;

  // Add a message to the thread
  const createdMessage = await openai.beta.threads.messages.create(
    threadId,
    {
      role: 'user',
      content: input.message,
    },
    { signal: req.signal },
  );

  return AssistantResponse(
    { threadId, messageId: createdMessage.id },
    async ({ forwardStream, sendDataMessage }) => {
      // Run the assistant on the thread
      const runStream = openai.beta.threads.runs.stream(
        threadId,
        {
          assistant_id:
            process.env.ASSISTANT_ID ??
            (() => {
              throw new Error('ASSISTANT_ID is not set');
            })(),
        },
        { signal: req.signal },
      );

      // forward run status would stream message deltas
      let runResult = await forwardStream(runStream);

      // status can be: queued, in_progress, requires_action, cancelling, cancelled, failed, completed, or expired
      while (
        runResult?.status === 'requires_action' &&
        runResult.required_action?.type === 'submit_tool_outputs'
      ) {
        const tool_outputs =
          runResult.required_action.submit_tool_outputs.tool_calls.map(
            (toolCall: any) => {
              const parameters = JSON.parse(toolCall.function.arguments);

              switch (toolCall.function.name) {
                case 'listStocks': {
                  const stocks = listStocks();
                  return {
                    tool_call_id: toolCall.id,
                    output: JSON.stringify(stocks),
                  };
                }

                case 'showStockPrice': {
                  return {
                    tool_call_id: toolCall.id,
                    output: parameters.symbol,
                  };
                }

                case 'showStockPurchase': {
                  return {
                    tool_call_id: toolCall.id,
                    output: parameters.symbol,
                  };
                }

                case 'getEvents': {
                  return {
                    tool_call_id: toolCall.id,
                    output: 'news',
                  };
                }

                default:
                  throw new Error(
                    `Unknown tool call function: ${toolCall.function.name}`,
                  );
              }
            },
          );

        runResult = await forwardStream(
          openai.beta.threads.runs.submitToolOutputsStream(
            threadId,
            runResult.id,
            { tool_outputs },
            { signal: req.signal },
          ),
        );
      }
    },
  );
}

function listStocks() {
  return [
    { symbol: 'AAPL', price: 150, delta: 2.00 },
    { symbol: 'GOOGL', price: 2500, delta: -10.00 },
    { symbol: 'TSLA', price: 700, delta: 5.00 }
  ];
}