// Redirected to the new India Market Module - NSE Scanner
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Scanner() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/india/scanner"); }, [navigate]);
  return null;
}
