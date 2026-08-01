export type SessionCommand =
  | Readonly<{ type: 'session/start'; commandId: string; workflowId: string }>
  | Readonly<{ type: 'session/pause'; commandId: string; sessionId: string }>
  | Readonly<{ type: 'session/resume'; commandId: string; sessionId: string }>
  | Readonly<{ type: 'session/stop'; commandId: string; sessionId: string }>;

export type SessionChangedMessage = Readonly<{
  type: 'session/changed';
  session: unknown;
}>;
