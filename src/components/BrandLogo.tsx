import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";

export const BrandLogo = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
  };
  return (
    <Link to="/" className="inline-flex items-center gap-2 group">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-brand rounded-lg blur-md opacity-60 group-hover:opacity-90 transition-opacity" />
        <div className="relative bg-gradient-brand rounded-lg p-1.5 shadow-glow">
          <Trophy className="size-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
      </div>
      <span className={`font-display font-bold ${sizes[size]} text-gradient`}>
        QuizMaster AI
      </span>
    </Link>
  );
};
