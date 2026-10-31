import { isKeyNotConfigured } from '@lifetracker/core';

// An error from asking OpenAI (an insight or advice): with no key set up, how to set one; otherwise
// the API's own friendly message.
export default function OpenAIError({ error }: { error: string }) {
  if (!isKeyNotConfigured(error)) return <>{error}</>;
  return (
    <>
      <p className="font-medium">No OpenAI key is set up yet.</p>
      <p className="mt-1">
        In the <code className="font-mono">api</code> folder, run{' '}
        <code className="font-mono break-all">dotnet user-secrets set "OpenAI:ApiKey" "&lt;your key&gt;"</code>{' '}
        and restart the API. The key stays in the API; this page never sees it.
      </p>
    </>
  );
}
