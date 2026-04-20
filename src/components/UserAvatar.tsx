import { storage, getInitials } from "@/lib/storage";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export const UserAvatar = () => {
  const user = storage.getUser();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    storage.clearUser();
    navigate("/");
  };

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:block text-right">
        <div className="text-sm font-medium leading-tight">{user.name}</div>
        <div className="text-xs text-muted-foreground leading-tight">{user.email}</div>
      </div>
      <div className="size-10 rounded-full bg-gradient-brand flex items-center justify-center font-semibold text-primary-foreground shadow-glow">
        {getInitials(user.name) || "U"}
      </div>
      <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
        <LogOut className="size-4" />
      </Button>
    </div>
  );
};
