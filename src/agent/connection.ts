import { AGENT_PATH, type AgentCall, type AgentReply } from "./tools";

type Options = {
  /** Answer a call: its result, or an error message for the agent. */
  onCall: (call: AgentCall) => Omit<AgentReply, "id">;
  createSocket?: (url: string) => WebSocket;
};

// The app's window answers agents' tool calls the relay passes to it. It
// reconnects whenever the server restarts, as the mirror connection does.
export function createAgentConnection({
  onCall,
  createSocket = (url) => new WebSocket(url),
}: Options) {
  const url = new URL(AGENT_PATH, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("role", "app");
  let socket: WebSocket | null = null;
  let disposed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 250;

  const reconnect = () => {
    if (disposed || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 4000);
  };
  const connect = () => {
    if (disposed) return;
    let connection: WebSocket;
    try {
      connection = createSocket(url.href);
    } catch {
      reconnect();
      return;
    }
    socket = connection;
    connection.addEventListener("open", () => {
      retryDelay = 250;
    });
    connection.addEventListener("message", (event) => {
      if (disposed || socket !== connection) return;
      let call: AgentCall;
      try {
        call = JSON.parse(String(event.data));
        if (typeof call?.id !== "string" || typeof call.tool !== "string")
          return;
      } catch {
        return;
      }
      let reply: Omit<AgentReply, "id">;
      try {
        reply = onCall(call);
      } catch {
        reply = { error: "Path of Grace couldn't run that tool." };
      }
      connection.send(JSON.stringify({ ...reply, id: call.id }));
    });
    connection.addEventListener("close", () => {
      if (!disposed && socket === connection) reconnect();
    });
    connection.addEventListener("error", () => connection.close());
  };
  connect();
  return {
    dispose() {
      disposed = true;
      clearTimeout(retry);
      socket?.close();
    },
  };
}
