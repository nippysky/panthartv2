"use client";

import * as React from "react";
import { encodeMultisigSubmissionPlan } from "@/src/features/admin/warpool/encodeMultisigSubmission";
import type {
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
} from "@/src/features/admin/warpool/types";

type ExecutableAction = {
  id: string;
  target: string;
  value: string;
  data: string;
  summary: string;
  functionName: string;
  args: unknown[];
};

type Props = {
  title?: string;
  description?: string;
  actions: ExecutableAction[];
  defaultMultisigAddress?: string | null;
  defaultTokenAddress?: string | null;
  multisigResolutionSource?: WarpoolMultisigResolutionSource | null;
  multisigSummary?: WarpoolMultisigSummary | null;
};

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Label({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{children}</span>
        {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      </div>
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition",
        "placeholder:text-muted focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Kvp({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function sourceLabel(source: WarpoolMultisigResolutionSource | null | undefined) {
  switch (source) {
    case "CONFIG_OWNER_MATCH":
      return "Resolved from Warpool config owner";
    case "CONFIG_OWNER_UNREGISTERED":
      return "Config owner found on-chain but not registered in MultisigSafe";
    case "LATEST_REGISTERED_FALLBACK":
      return "Using latest registered multisig fallback";
    case "UNAVAILABLE":
      return "No multisig could be resolved automatically";
    default:
      return null;
  }
}

export default function MultisigExecutionPanel({
  title = "Multisig Execution Handoff",
  description = "Wrap the encoded admin actions into exact multisig submitTransaction and submitAndConfirm calldata.",
  actions,
  defaultMultisigAddress = "",
  defaultTokenAddress = "",
  multisigResolutionSource = null,
  multisigSummary = null,
}: Props) {
  const [multisigAddress, setMultisigAddress] = React.useState(defaultMultisigAddress ?? "");
  const [tokenAddress, setTokenAddress] = React.useState(defaultTokenAddress ?? "");

  React.useEffect(() => {
    setMultisigAddress(defaultMultisigAddress ?? "");
  }, [defaultMultisigAddress]);

  React.useEffect(() => {
    setTokenAddress(defaultTokenAddress ?? "");
  }, [defaultTokenAddress]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op
    }
  }

  const plan = React.useMemo(() => {
    if (!multisigAddress.trim()) {
      return {
        warnings: ["Enter the multisig contract address to generate execution calldata."],
        submissions: [],
      };
    }

    try {
      return encodeMultisigSubmissionPlan({
        multisigAddress,
        tokenAddress,
        actions,
      });
    } catch (error) {
      return {
        warnings: [
          error instanceof Error
            ? error.message
            : "Failed to encode multisig execution handoff.",
        ],
        submissions: [],
      };
    }
  }, [actions, multisigAddress, tokenAddress]);

  const resolvedSourceText = sourceLabel(multisigResolutionSource);

  return (
    <SectionCard title={title} description={description}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label hint="Required">Multisig address</Label>
          <TextInput
            value={multisigAddress}
            onChange={(e) => setMultisigAddress(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        <div>
          <Label hint="Optional · defaults to zero address">Token address</Label>
          <TextInput
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="0x0000000000000000000000000000000000000000"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
      </div>

      {(resolvedSourceText || multisigSummary) && (
        <div className="mt-4 rounded-3xl border border-border bg-background/70 p-4">
          {resolvedSourceText ? (
            <div className="mb-2 text-sm text-muted">{resolvedSourceText}</div>
          ) : null}

          {multisigSummary ? (
            <div className="space-y-1">
              <Kvp label="Resolved Multisig" value={multisigSummary.contract} />
              <Kvp label="Threshold" value={multisigSummary.threshold} />
              <Kvp label="Owners" value={multisigSummary.ownersCount} />
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {plan.warnings.length > 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-background/70 p-4">
            <div className="text-sm font-semibold text-foreground">
              Multisig handoff notes
            </div>
            <div className="mt-2 space-y-1 text-sm leading-6 text-muted">
              {plan.warnings.map((warning) => (
                <div key={warning}>• {warning}</div>
              ))}
            </div>
          </div>
        ) : null}

        {plan.submissions.length > 0 ? (
          <>
            {plan.submissions.map((submission, index) => (
              <div
                key={`${submission.to}-${index}`}
                className="rounded-3xl border border-border bg-background/70 p-4"
              >
                <div className="text-sm font-semibold text-foreground">
                  {index + 1}. {submission.summary}
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <div className="mb-1 font-medium text-muted">submitTransaction calldata</div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-border bg-card p-3 text-foreground">
                      {submission.submitTransactionData}
                    </pre>
                  </div>

                  <div>
                    <div className="mb-1 font-medium text-muted">submitAndConfirm calldata</div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-border bg-card p-3 text-foreground">
                      {submission.submitAndConfirmData}
                    </pre>
                  </div>

                  <div>
                    <div className="mb-1 font-medium text-muted">Submission object</div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-border bg-card p-3 text-foreground">
                      {JSON.stringify(submission, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText(JSON.stringify(plan.submissions, null, 2))}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
              >
                Copy submission JSON
              </button>

              <button
                type="button"
                onClick={() =>
                  copyText(
                    JSON.stringify(
                      plan.submissions.map((item) => item.submitTransactionData),
                      null,
                      2
                    )
                  )
                }
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
              >
                Copy submit calldata
              </button>

              <button
                type="button"
                onClick={() =>
                  copyText(
                    JSON.stringify(
                      plan.submissions.map((item) => item.submitAndConfirmData),
                      null,
                      2
                    )
                  )
                }
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
              >
                Copy submit+confirm calldata
              </button>
            </div>
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}