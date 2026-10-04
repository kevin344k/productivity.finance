import {
  siApple,
  siApplemusic,
  siCrunchyroll,
  siDropbox,
  siDuolingo,
  siFigma,
  siGithub,
  siGoogledrive,
  siHbo,
  siIcloud,
  siNetflix,
  siNotion,
  siPlaystation,
  siSpotify,
  siTwitch,
  siYoutube,
  siZoom,
  type SimpleIcon,
} from "simple-icons";

interface Brand {
  keys: string[];
  color: string;
  icon?: SimpleIcon;
  mark?: string;
}

const brands: Brand[] = [
  { keys: ["spotify"], icon: siSpotify, color: "#1DB954" },
  { keys: ["netflix"], icon: siNetflix, color: "#E50914" },
  { keys: ["youtube", "yt premium"], icon: siYoutube, color: "#FF0000" },
  { keys: ["github"], icon: siGithub, color: "#8B5CF6" },
  { keys: ["apple music"], icon: siApplemusic, color: "#FA243C" },
  { keys: ["icloud"], icon: siIcloud, color: "#3693F3" },
  { keys: ["apple"], icon: siApple, color: "#555555" },
  { keys: ["hbo", "max"], icon: siHbo, color: "#5822B4" },
  { keys: ["notion"], icon: siNotion, color: "#000000" },
  { keys: ["dropbox"], icon: siDropbox, color: "#0061FF" },
  { keys: ["google drive", "google one"], icon: siGoogledrive, color: "#1FA463" },
  { keys: ["playstation", "ps plus"], icon: siPlaystation, color: "#0070D1" },
  { keys: ["twitch"], icon: siTwitch, color: "#9146FF" },
  { keys: ["crunchyroll"], icon: siCrunchyroll, color: "#F47521" },
  { keys: ["duolingo"], icon: siDuolingo, color: "#58CC02" },
  { keys: ["figma"], icon: siFigma, color: "#F24E1E" },
  { keys: ["zoom"], icon: siZoom, color: "#0B5CFF" },
  { keys: ["disney"], mark: "D+", color: "#113CCF" },
  { keys: ["chatgpt", "openai"], mark: "GPT", color: "#10A37F" },
  { keys: ["microsoft", "office"], mark: "M365", color: "#D83B01" },
  { keys: ["prime", "amazon"], mark: "prime", color: "#00A8E1" },
  { keys: ["adobe"], mark: "Ai", color: "#FA0F00" },
  { keys: ["canva"], mark: "C", color: "#00C4CC" },
];

export function findBrand(name: string) {
  const normalized = name.toLowerCase();
  return brands.find((brand) => brand.keys.some((key) => normalized.includes(key)));
}

export function BrandLogo({ name, size = 30 }: { name: string; size?: number }) {
  const brand = findBrand(name);
  const color = brand?.color ?? "#3B82F6";
  return (
    <span
      className="brand-logo"
      title={name}
      style={{ width: size, height: size, ["--brand" as string]: color }}
    >
      {brand?.icon ? (
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="currentColor" aria-hidden="true">
          <path d={brand.icon.path} />
        </svg>
      ) : (
        <span className="brand-mark" style={{ fontSize: size * (brand?.mark && brand.mark.length > 2 ? 0.28 : 0.4) }}>
          {brand?.mark ?? name.trim().slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
