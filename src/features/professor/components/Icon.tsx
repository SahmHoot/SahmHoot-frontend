import "./Icon.css";
import type { DesignScreen } from "../dashboard-types";

const assets = import.meta.glob<string>("../../../assets/professor/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

export function Icon({
  screen,
  name = "imgFrame",
  className = "",
  alt = "",
}: {
  screen: DesignScreen;
  name?: string;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={assets[`../../../assets/professor/${screen}-${name}.svg`]}
      alt={alt}
      className={`professor-icon ${className}`}
    />
  );
}
