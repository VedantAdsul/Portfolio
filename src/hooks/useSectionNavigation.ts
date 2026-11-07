import { useCallback, useRef, useState } from "react";
import { SECTIONS, type SectionConfig, type SectionId } from "../data/sections";

export interface UseSectionNavigationReturn {
  activeSection: SectionConfig;
  currentIndex: number;
  totalSections: number;
  goToSection: (targetId: SectionId) => void;
  nextSection: () => void;
  prevSection: () => void;
  isTransitioning: React.RefObject<boolean>;
}

export function useSectionNavigation(initialIndex = 0): UseSectionNavigationReturn {
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(initialIndex);
  const isTransitioning = useRef<boolean>(false);

  const goToSection = useCallback((targetId: SectionId) => {
    if (isTransitioning.current) return;

    const targetIndex = SECTIONS.findIndex((section) => section.id === targetId);
    if (targetIndex === -1) return;

    isTransitioning.current = true;
    setCurrentSectionIndex(targetIndex);

    setTimeout(() => {
      isTransitioning.current = false;
    }, 800);
  }, []);

  const nextSection = useCallback(() => {
    if (isTransitioning.current) return;

    isTransitioning.current = true;
    setCurrentSectionIndex((prevIndex) =>
      prevIndex < SECTIONS.length - 1 ? prevIndex + 1 : prevIndex
    );

    setTimeout(() => {
      isTransitioning.current = false;
    }, 800);
  }, []);

  const prevSection = useCallback(() => {
    if (isTransitioning.current) return;

    isTransitioning.current = true;
    setCurrentSectionIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));

    setTimeout(() => {
      isTransitioning.current = false;
    }, 800);
  }, []);

  return {
    activeSection: SECTIONS[currentSectionIndex],
    currentIndex: currentSectionIndex,
    totalSections: SECTIONS.length,
    goToSection,
    nextSection,
    prevSection,
    isTransitioning,
  };
}

export default useSectionNavigation;
