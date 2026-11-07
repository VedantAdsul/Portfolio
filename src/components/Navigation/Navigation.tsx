import { SECTIONS, type SectionId } from "../../data/sections";

export interface NavigationProps {
  activeId: SectionId;
  onNavigate: (id: SectionId) => void;
}

export function Navigation({ activeId, onNavigate }: NavigationProps) {
  const visibleSections = SECTIONS.filter((section) => section.navVisible);

  return (
    <nav
      style={{
        position: "fixed",
        top: "24px",
        right: "32px",
        zIndex: 50,
        display: "flex",
        gap: "1.25rem",
      }}
    >
      {visibleSections.map((section) => {
        const isActive = section.id === activeId;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onNavigate(section.id)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: isActive ? "var(--color-sage)" : "var(--color-parchment)",
              transition: "color 0.2s ease",
              padding: "4px 8px",
            }}
            aria-current={isActive ? "page" : undefined}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}

export default Navigation;
