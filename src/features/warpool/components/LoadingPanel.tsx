type Props = {
  className?: string;
};

export default function LoadingPanel({ className = "" }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-[30px] bg-foreground/8 before:absolute before:inset-0 before:animate-[panth-shimmer_1.6s_ease-in-out_infinite] before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] dark:before:bg-[linear-gradient(90deg,transparent,rgba(77,238,84,0.08),transparent)] ${className}`}
    />
  );
}