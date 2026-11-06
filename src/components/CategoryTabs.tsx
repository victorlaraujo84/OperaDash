import { useRef, type KeyboardEvent } from "react";
import { Cable, Server } from "lucide-react";
import type { AlarmCategory } from "../types/operadora";
import { formatNumber } from "../lib/analytics";

interface CategoryTabsProps {
  activeTab: AlarmCategory;
  onChange: (category: AlarmCategory) => void;
  linkCount: number;
  deviceCount: number;
}

export function CategoryTabs({ activeTab, onChange, linkCount, deviceCount }: CategoryTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % 2;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex + 1) % 2;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(nextIndex === 0 ? "links" : "devices");
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="category-tabs" role="tablist" aria-label="Categoria de alarmes" aria-orientation="horizontal">
      <button
        ref={(node) => { tabRefs.current[0] = node; }}
        id="tab-links"
        type="button"
        role="tab"
        tabIndex={activeTab === "links" ? 0 : -1}
        aria-selected={activeTab === "links"}
        aria-controls="panel-links"
        className={`category-tab ${activeTab === "links" ? "category-tab--active" : ""}`}
        onClick={() => onChange("links")}
        onKeyDown={(event) => handleKeyDown(event, 0)}
      >
        <span className="category-tab__icon"><Cable size={17} /></span>
        <span className="category-tab__copy"><strong>Links</strong><small>TIPO = LINK · fallback no nome</small></span>
        <span className="category-tab__count">{formatNumber(linkCount)}</span>
      </button>
      <button
        ref={(node) => { tabRefs.current[1] = node; }}
        id="tab-devices"
        type="button"
        role="tab"
        tabIndex={activeTab === "devices" ? 0 : -1}
        aria-selected={activeTab === "devices"}
        aria-controls="panel-devices"
        className={`category-tab ${activeTab === "devices" ? "category-tab--active" : ""}`}
        onClick={() => onChange("devices")}
        onKeyDown={(event) => handleKeyDown(event, 1)}
      >
        <span className="category-tab__icon"><Server size={17} /></span>
        <span className="category-tab__copy"><strong>Dispositivos</strong><small>Demais alarmes da planilha</small></span>
        <span className="category-tab__count">{formatNumber(deviceCount)}</span>
      </button>
    </div>
  );
}
