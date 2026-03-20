type Props = {
  message?: string | null;
};

export default function ActionNotice({ message }: Props) {
  if (!message) return null;

  return (
    <div className="rounded-[20px] border border-border bg-card px-4 py-3 text-sm text-foreground/72">
      {message}
    </div>
  );
}