type Option = {
  label: string;
  value: string;
};

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  filterOptions: Option[];
  searchPlaceholder: string;
  isRefreshing?: boolean;
};

export default function FilterToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  filterOptions,
  searchPlaceholder,
  isRefreshing = false,
}: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-12 w-full rounded-full border border-border bg-card px-4 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-accent/40"
        />

        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="h-12 rounded-full border border-border bg-card px-4 text-sm text-foreground outline-none transition focus:border-accent/40"
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-foreground/45">
        {isRefreshing ? "Refreshing live data..." : "Live data ready"}
      </div>
    </div>
  );
}