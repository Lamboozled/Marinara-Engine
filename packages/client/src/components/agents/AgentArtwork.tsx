import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface AgentArtworkProps {
  imageUrl?: string | null;
  alt: string;
  iconSize: string;
}

export function AgentArtwork({ imageUrl, alt, iconSize }: AgentArtworkProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [imageUrl]);

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className="h-full w-full object-cover"
        draggable={false}
        data-component="AgentArtwork"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <Sparkles size={iconSize} aria-hidden="true" data-component="AgentArtworkFallback" />;
}
