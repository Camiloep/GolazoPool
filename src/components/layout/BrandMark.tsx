interface Props {
  align?: "left" | "center";
  size?: "sm" | "md" | "lg";
}

const titleSizes = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl sm:text-6xl lg:text-7xl",
} as const;

const kickerSizes = {
  sm: "text-kicker-sm",
  md: "text-kicker-md",
  lg: "text-kicker-xl",
} as const;

export default function BrandMark({ align = "left", size = "md" }: Props) {
  const alignClass = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <div className={`flex flex-col ${alignClass}`}>
      <span className={`brand-kicker ${kickerSizes[size]}`}>FIFA World Cup 2026</span>
      <span className={`brand-logo ${titleSizes[size]}`}>
        Golazo<span className="text-brand-green">Pool</span>
      </span>
    </div>
  );
}
