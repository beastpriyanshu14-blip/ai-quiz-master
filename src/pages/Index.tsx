import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { storage } from "@/lib/storage";
import Auth from "./Auth";

const Index = () => {
  const navigate = useNavigate();
  const user = storage.getUser();

  useEffect(() => {
    if (user) navigate("/setup", { replace: true });
  }, [user, navigate]);

  return <Auth />;
};

export default Index;
