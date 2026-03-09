"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Modal } from "@/src/ui/Modal";

const schema = z.object({
  to: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM address."),
  valueEtn: z
    .string()
    .trim()
    .min(1, "Enter a number.")
    .refine((v) => /^\d*\.?\d*$/.test(v), "Enter a number."),
  data: z
    .union([z.literal(""), z.string().trim()])
    .refine(
      (v) => v === "" || /^0x([a-fA-F0-9]{2})*$/.test(v),
      "Data must be 0x-hex."
    ),
});

export type NewTxDraft = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit?: (draft: NewTxDraft) => Promise<void> | void;
};

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
    </label>
  );
}

export default function NewTxDialog({
  open,
  onOpenChange,
  onSubmit,
}: Props) {
  const form = useForm<NewTxDraft>({
    resolver: zodResolver(schema),
    defaultValues: { to: "", valueEtn: "0", data: "" },
    mode: "onSubmit",
  });

  const [submitting, setSubmitting] = React.useState(false);

  const inputClass =
    "h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20";

  const textareaClass =
    "min-h-[140px] w-full rounded-[18px] border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20";

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="New Transaction"
      size="lg"
      maxHeightClass="max-h-[82vh]"
    >
      <div className="space-y-5">
        <div className="text-sm leading-6 text-muted">
          Propose a new multisig transaction. This prepares the target address,
          ETN value, and optional calldata for on-chain submission.
        </div>

        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(async (values: NewTxDraft) => {
            try {
              setSubmitting(true);
              await onSubmit?.(values);
            } finally {
              setSubmitting(false);
            }
          })}
        >
          <Field
            label="To"
            htmlFor="multisig-tx-to"
            error={form.formState.errors.to?.message}
          >
            <input
              id="multisig-tx-to"
              placeholder="0x..."
              className={inputClass}
              {...form.register("to")}
            />
          </Field>

          <Field
            label="Value (ETN)"
            htmlFor="multisig-tx-value"
            error={form.formState.errors.valueEtn?.message}
          >
            <input
              id="multisig-tx-value"
              placeholder="0.0"
              className={inputClass}
              {...form.register("valueEtn")}
            />
          </Field>

          <Field
            label="Data (optional, 0x-hex)"
            htmlFor="multisig-tx-data"
            error={form.formState.errors.data?.message}
          >
            <textarea
              id="multisig-tx-data"
              placeholder="0x..."
              className={textareaClass}
              {...form.register("data")}
            />
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-card"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Transaction"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}