// Redirected to the new India Market Module - Sector Rotation Engine
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SectorRotation() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/india/sectors"); }, [navigate]);
  return null;
}
