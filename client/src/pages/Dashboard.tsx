// Redirected to the new Home Dashboard
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/"); }, [navigate]);
  return null;
}
