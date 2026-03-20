type Props = {
  className?: string;
};

export default function LoadingPanel({ className = "" }: Props) {
  return (
    <div
      className={[
        "relative overflow-hidden border border-border bg-card/80",
        "before:absolute before:inset-0",
        "before:-translate-x-full before:animate-[shimmer_1.8s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "dark:before:via-white/5",
        className,
      ].join(" ")}
    />
  );
}